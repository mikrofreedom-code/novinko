// ============================================================
// 01. Scout
// ------------------------------------------------------------
// ROLA:          Iba objavuje udalosti. Nikdy nepíše, neoveruje, nepublikuje. Vloží surovú položku do queue.
// VSTUP status:  —
// VÝSTUP status: raw
// STAV:          🟢 LIVE (CoinGecko Layer A + RSS/Atom feedy Layer B/C)
// AI vrstva:     0 žiadna
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================
//
// Scout NEROBÍ editorské rozhodnutie — len stiahne a vloží KAŽDÚ položku ako `raw`.
// Filtrovanie (prah, dedup, čerstvosť) je úloha 02-gateway.
// Dva zdroje: CoinGecko (čísla, Layer A) + RSS/Atom feedy (text, Layer B/C).

import { db } from '../_shared/queue.js';
import { topMarkets } from '../_shared/coingecko.js';
import { FEEDS } from '../_shared/feeds.js';
import { fetchFeed } from '../_shared/rss.js';

export const STAGE = {
  index: 1,
  name: "Scout",
  input: "—",
  output: "raw",
};

const TOP_N = Number(process.env.SCOUT_TOP_N ?? 100);
const FEED_MAX_ITEMS = Number(process.env.FEED_MAX_ITEMS ?? 20); // najnovších N na feed (feedy sú zoradené od najnovších)

function hourBucket(d = new Date()) {
  return d.toISOString().slice(0, 13); // YYYY-MM-DDTHH
}

async function insertRows(rows) {
  if (rows.length === 0) return 0;
  const { error } = await db.from('queue').insert(rows);
  if (error) throw error;
  return rows.length;
}

// --- CoinGecko (Layer A, čísla) ---
async function scoutCoingecko() {
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
  return insertRows(rows);
}

// --- RSS/Atom feedy (Layer B/C, text) ---
async function scoutFeeds() {
  let total = 0;
  const errors = [];
  for (const feed of FEEDS) {
    try {
      const items = (await fetchFeed(feed.url)).slice(0, FEED_MAX_ITEMS);
      const rows = items
        .filter((it) => it.title && it.guid)
        .map((it) => ({
          status: 'raw',
          raw_data: {
            _src: 'feed',
            dedup_key: `feed:${it.guid}`,
            source_name: feed.name,
            source_url: it.link,
            source_type: feed.source_type,
            layer: feed.layer,
            entity_hint: feed.entity ?? null,
            title: it.title,
            text: it.text,
            published: it.published,
          },
        }));
      total += await insertRows(rows);
    } catch (err) {
      errors.push(`${feed.name}: ${err.message}`);
    }
  }
  return { inserted: total, feedErrors: errors };
}

// Stiahne oba zdroje a vloží ako `raw`.
export async function run() {
  const cg = await scoutCoingecko();
  const feeds = await scoutFeeds();
  return {
    coingecko: cg,
    feeds: feeds.inserted,
    feedErrors: feeds.feedErrors.length ? feeds.feedErrors : undefined,
    total: cg + feeds.inserted,
  };
}
