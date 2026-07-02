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
import { topProtocols } from '../_shared/defillama.js';
import { fearGreed } from '../_shared/feargreed.js';
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

async function insertRows(rows) {
  if (rows.length === 0) return 0;
  const { error } = await db.from('queue').insert(rows);
  if (error) throw error;
  return rows.length;
}

// --- CoinGecko (Layer A, čísla) ---
async function scoutCoingecko() {
  const coins = await topMarkets({ perPage: TOP_N });
  const rows = coins
    .filter((c) => typeof c.current_price === 'number')
    .map((c) => ({
      status: 'raw',
      raw_data: {
        _src: 'coingecko',
        section: 'krypto',
        // dedup podľa mince; opakovaniu bráni časové okno v 02-gateway (DEDUP_WINDOW_H).
        dedup_key: `cg:${c.id}`,
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

// --- DefiLlama (Layer A, TVL protokolov) ---
async function scoutDefiLlama() {
  const protos = await topProtocols({ limit: TOP_N });
  const rows = protos
    .filter((p) => typeof p.change_24h_pct === 'number')
    .map((p) => ({
      status: 'raw',
      raw_data: {
        _src: 'defillama',
        section: 'krypto',
        dedup_key: `dl:${p.id}`,
        protocol: {
          id: p.id, name: p.name, chain: p.chain,
          tvl_usd: p.tvl_usd, change_24h_pct: p.change_24h_pct,
        },
      },
    }));
  return insertRows(rows);
}

// --- Fear & Greed (nálada trhu) — vloží len pri EXTRÉME, raz denne ---
async function scoutFearGreed() {
  const fng = await fearGreed();
  if (!fng || !/Extreme/i.test(fng.classification)) return 0;
  const day = new Date().toISOString().slice(0, 10);
  return insertRows([{
    status: 'raw',
    raw_data: {
      _src: 'feargreed',
      section: 'krypto',
      dedup_key: `fng:${day}:${fng.classification}`, // raz denne na klasifikáciu
      fng,
    },
  }]);
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
            section: feed.section ?? 'krypto',          // desk položky (krypto|ai|…)
            source_name: feed.name,
            source_url: it.link,
            source_type: feed.source_type,
            layer: feed.layer,
            entity_hint: feed.entity ?? null,
            // brána pustí len témy danej sekcie (cross-topic feedy: regulátori, NVIDIA…)
            keyword_filter: feed.keywordFilter ?? feed.cryptoFilter ?? false,
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

// Stiahne všetky zdroje a vloží ako `raw`. Každý zdroj samostatne (chyba
// jedného nezhodí ostatné).
export async function run() {
  const safe = async (fn) => { try { return await fn(); } catch { return 0; } };
  const cg = await safe(scoutCoingecko);
  const dl = await safe(scoutDefiLlama);
  const fng = await safe(scoutFearGreed);
  const feeds = await scoutFeeds();
  return {
    coingecko: cg,
    defillama: dl,
    feargreed: fng,
    feeds: feeds.inserted,
    feedErrors: feeds.feedErrors.length ? feeds.feedErrors : undefined,
    total: cg + dl + fng + feeds.inserted,
  };
}
