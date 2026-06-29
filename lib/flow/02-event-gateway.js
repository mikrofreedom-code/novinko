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
const MIN_MOVE_PCT = Number(process.env.MIN_MOVE_PCT ?? 5);   // prah hrubého šumu
const DEDUP_WINDOW_H = Number(process.env.DEDUP_WINDOW_H ?? 6); // okno proti opakovaniu

// Už bol tento dedup_key vpustený ďalej (status mimo raw/rejected/error) v okne?
async function alreadyAdmitted(dedupKey) {
  if (!dedupKey) return false;
  const since = new Date(Date.now() - DEDUP_WINDOW_H * 3600e3).toISOString();
  const { data, error } = await db.from('queue')
    .select('id')
    .filter('raw_data->>dedup_key', 'eq', dedupKey)
    .not('status', 'in', '(raw,rejected,error)')
    .gte('created_at', since)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function run(item) {
  const coin = item.raw_data?.coin;

  // 1. WHITELIST: musí to byť coingecko coin s číselnou 24h zmenou.
  if (item.raw_data?._src !== 'coingecko' || typeof coin?.change_24h_pct !== 'number') {
    await advance(item.id, 'rejected', { error: `${AGENT}: neznámy tvar/žiadna 24h zmena` });
    return 'rejected';
  }

  // 2. PRAH: malý pohyb = šum.
  if (Math.abs(coin.change_24h_pct) < MIN_MOVE_PCT) {
    await advance(item.id, 'rejected', { error: `${AGENT}: pohyb ${coin.change_24h_pct.toFixed(2)}% < ${MIN_MOVE_PCT}%` });
    return 'rejected';
  }

  // 3. DEDUP: rovnaká udalosť už prešla nedávno.
  if (await alreadyAdmitted(item.raw_data.dedup_key)) {
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
