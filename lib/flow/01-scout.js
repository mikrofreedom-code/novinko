// ============================================================
// 01. Scout
// ------------------------------------------------------------
// ROLA:          Iba objavuje udalosti. Nikdy nepíše, neoveruje, nepublikuje. Vloží surovú položku do queue.
// VSTUP status:  —
// VÝSTUP status: raw
// STAV:          🟢 LIVE (CoinGecko, Layer A)
// AI vrstva:     0 žiadna
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================
//
// Scout NEROBÍ žiadne editorské rozhodnutie — len stiahne snímku trhu
// a vloží KAŽDÚ mincu ako `raw`. Filtrovanie (prah, dedup) je úloha 02-gateway.
// dedup_key počíta tu (coin + hodinový bucket), gateway ho len vynucuje.

import { db } from '../_shared/queue.js';
import { topMarkets } from '../_shared/coingecko.js';

export const STAGE = {
  index: 1,
  name: "Scout",
  input: "—",
  output: "raw",
};

const TOP_N = Number(process.env.SCOUT_TOP_N ?? 100);

function hourBucket(d = new Date()) {
  return d.toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

// Stiahne top trhy z CoinGecku a vloží ich ako `raw`.
export async function run() {
  const coins = await topMarkets({ perPage: TOP_N });
  const bucket = hourBucket();

  const rows = coins
    .filter((c) => typeof c.current_price === 'number')
    .map((c) => ({
      status: 'raw',
      raw_data: {
        _src: 'coingecko',
        dedup_key: `cg:${c.id}:${bucket}`,
        coin: {
          id: c.id, symbol: c.symbol, name: c.name,
          price_usd: c.current_price,
          change_24h_pct: c.price_change_percentage_24h ?? null,
          volume_24h_usd: c.total_volume ?? null,
          market_cap_usd: c.market_cap ?? null,
        },
      },
    }));

  if (rows.length === 0) return { inserted: 0 };
  const { error } = await db.from('queue').insert(rows);
  if (error) throw error;
  return { inserted: rows.length, source: 'coingecko', top_n: TOP_N };
}
