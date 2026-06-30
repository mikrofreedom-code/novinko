// ============================================================
// 04. Collector
// ------------------------------------------------------------
// ROLA:          Stiahne plný obsah položiek čo prešli bránou (celý text článku, metadáta). Stále bez AI.
// VSTUP status:  filtered
// VÝSTUP status: collected
// STAV:          🟢 LIVE (Layer A normalizácia)
// AI vrstva:     0 žiadna
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================
//
// Pre Layer A (čísla z API) niet čo „dosťahovať" — collector len NORMALIZUJE
// surovú snímku na kontrakt, ktorý číta 05-verification:
//   { source_name, source_url, source_type, layer, entity, metrics }
// Keď pribudnú Layer B/C (text), tu sa doplní reálne sťahovanie HTML→text.

import { claim, advance } from '../_shared/queue.js';

export const STAGE = {
  index: 4,
  name: "Collector",
  input: "filtered",
  output: "collected",
};

const AGENT = '04-collector';

// CoinGecko snímka → kontrakt pre 05.
function normalizeCoingecko(coin) {
  const metrics = {
    price_usd: coin.price_usd,
    change_24h_pct: coin.change_24h_pct,
  };
  if (typeof coin.volume_24h_usd === 'number') metrics.volume_24h_usd = coin.volume_24h_usd;
  if (typeof coin.market_cap_usd === 'number') metrics.market_cap_usd = coin.market_cap_usd;

  return {
    source_name: 'CoinGecko',
    source_url: `https://www.coingecko.com/en/coins/${coin.id}`,
    source_type: 'primary',
    layer: 'A',
    entity: coin.name,
    metrics,
  };
}

// DefiLlama protokol → kontrakt pre 05 (Layer A, TVL).
function normalizeDefiLlama(p) {
  return {
    source_name: 'DefiLlama',
    source_url: `https://defillama.com/protocol/${p.id}`,
    source_type: 'primary',
    layer: 'A',
    entity: p.name,
    metrics: { tvl_usd: p.tvl_usd, change_24h_pct: p.change_24h_pct },
  };
}

// Fear & Greed → kontrakt pre 05 (Layer A, nálada).
function normalizeFearGreed(fng) {
  return {
    source_name: 'Fear & Greed Index',
    source_url: 'https://alternative.me/crypto/fear-and-greed-index/',
    source_type: 'primary',
    layer: 'A',
    entity: 'Krypto trh',
    metrics: { fng_value: fng.value },
    fng_classification: fng.classification,
  };
}

// Feed položka → kontrakt pre 05 (text). Pôvodný text zdroja sa tu ešte SMIE
// niesť (zdrojový text zahodí až 05); Writer ho NIKDY neuvidí.
function normalizeFeed(rd) {
  return {
    source_name: rd.source_name,
    source_url: rd.source_url,
    source_type: rd.source_type ?? 'primary',
    layer: rd.layer ?? 'B',
    entity: rd.entity_hint ?? null,
    title: rd.title,
    text: rd.text ?? '',
  };
}

export async function run(item) {
  const rd = item.raw_data ?? {};
  let collected;

  if (rd._src === 'coingecko' && rd.coin) {
    collected = normalizeCoingecko(rd.coin);
  } else if (rd._src === 'defillama' && rd.protocol) {
    collected = normalizeDefiLlama(rd.protocol);
  } else if (rd._src === 'feargreed' && rd.fng) {
    collected = normalizeFearGreed(rd.fng);
  } else if (rd._src === 'feed') {
    collected = normalizeFeed(rd);
  } else {
    throw new Error(`neznámy zdroj raw_data (_src=${rd._src ?? '?'})`);
  }

  // Zachovaj provenienciu (dedup_key, pôvodný zdroj) popri kontrakte.
  collected._src = rd._src;
  collected.dedup_key = rd.dedup_key ?? null;

  await advance(item.id, STAGE.output, { raw_data: collected });
  return collected;
}

export async function runBatch(limit = 100) {
  const items = await claim(STAGE.input, limit);
  const res = { ok: 0, failed: 0 };
  for (const item of items) {
    try {
      await run(item);
      res.ok++;
    } catch (err) {
      res.failed++;
      await advance(item.id, 'error', { error: `${AGENT}: ${err.message}` });
    }
  }
  return res;
}
