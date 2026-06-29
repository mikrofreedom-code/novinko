// ============================================================
// 02. Event Gateway
// ------------------------------------------------------------
// ROLA:          Filtre PRED AI: whitelist, blacklist, dedup (hash/URL), keywords, priorita. Tu padne 90-95% objemu. Bez AI.
// VSTUP status:  raw
// VÝSTUP status: filtered
// STAV:          🟢 LIVE
// AI vrstva:     0 žiadna
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================
//
// Filtre (poradie):
//   1. WHITELIST  — položka musí mať známy tvar (coingecko coin s 24h zmenou).
//   2. PRAH       — |24h zmena| >= MIN_MOVE_PCT, inak šum → rejected.
//   3. DEDUP      — ak rovnaký dedup_key už prešiel ďalej v poslednom okne → rejected.
// Čo prejde → filtered. Toto je LACNÁ hrubá brána; jemné rozhodnutie robí 06.

import { claim, advance, db } from '../_shared/queue.js';

export const STAGE = {
  index: 2,
  name: "Event Gateway",
  input: "raw",
  output: "filtered",
};

const AGENT = '02-event-gateway';
const MIN_MOVE_PCT = Number(process.env.MIN_MOVE_PCT ?? 5);        // prah hrubého šumu (Layer A)
const DEDUP_WINDOW_H = Number(process.env.DEDUP_WINDOW_H ?? 6);    // okno proti opakovaniu (Layer A)
const FEED_MAX_AGE_DAYS = Number(process.env.FEED_MAX_AGE_DAYS ?? 7); // text: ako staré ešte berieme

// Už bol tento dedup_key vpustený ďalej (status mimo raw/rejected/error) v okne?
// Okno sa líši podľa zdroja: feedy re-listujú položky dni → dlhé okno (= max vek),
// aby sme o tom istom vydaní nespravili duplicitný článok.
async function alreadyAdmitted(dedupKey, windowHours) {
  if (!dedupKey) return false;
  const since = new Date(Date.now() - windowHours * 3600e3).toISOString();
  const { data, error } = await db.from('queue')
    .select('id')
    .filter('raw_data->>dedup_key', 'eq', dedupKey)
    .not('status', 'in', '(raw,rejected,error)')
    .gte('created_at', since)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// --- Layer A (CoinGecko, čísla): prah + dedup ---
async function gateCoingecko(item) {
  const coin = item.raw_data?.coin;
  if (typeof coin?.change_24h_pct !== 'number') {
    return { ok: false, reason: 'žiadna 24h zmena' };
  }
  if (Math.abs(coin.change_24h_pct) < MIN_MOVE_PCT) {
    return { ok: false, reason: `pohyb ${coin.change_24h_pct.toFixed(2)}% < ${MIN_MOVE_PCT}%` };
  }
  return { ok: true };
}

// --- Layer B/C (feed, text): čerstvosť (dedup rieši spoločná vetva) ---
function gateFeed(item) {
  const rd = item.raw_data;
  if (!rd?.title) return { ok: false, reason: 'feed bez titulku' };
  if (rd.published) {
    const ageDays = (Date.now() - new Date(rd.published).getTime()) / 86400e3;
    if (ageDays > FEED_MAX_AGE_DAYS) {
      return { ok: false, reason: `staré ${Math.round(ageDays)}d > ${FEED_MAX_AGE_DAYS}d` };
    }
  }
  return { ok: true };
}

export async function run(item) {
  const src = item.raw_data?._src;

  // 1. WHITELIST + typovo špecifické filtre.
  let gate;
  if (src === 'coingecko') gate = await gateCoingecko(item);
  else if (src === 'feed') gate = gateFeed(item);
  else gate = { ok: false, reason: `neznámy zdroj (_src=${src ?? '?'})` };

  if (!gate.ok) {
    await advance(item.id, 'rejected', { error: `${AGENT}: ${gate.reason}` });
    return 'rejected';
  }

  // 2. DEDUP (spoločné): rovnaká udalosť už prešla nedávno. Okno podľa zdroja.
  const dedupWindowH = src === 'feed' ? FEED_MAX_AGE_DAYS * 24 + 24 : DEDUP_WINDOW_H;
  if (await alreadyAdmitted(item.raw_data.dedup_key, dedupWindowH)) {
    await advance(item.id, 'rejected', { error: `${AGENT}: duplicita (${item.raw_data.dedup_key})` });
    return 'rejected';
  }

  await advance(item.id, STAGE.output);
  return 'filtered';
}

export async function runBatch(limit = 500) {
  const items = await claim(STAGE.input, limit);
  const res = { filtered: 0, rejected: 0, failed: 0 };
  for (const item of items) {
    try {
      const r = await run(item);
      res[r]++;
    } catch (err) {
      res.failed++;
      await advance(item.id, 'error', { error: `${AGENT}: ${err.message}` });
    }
  }
  return res;
}
