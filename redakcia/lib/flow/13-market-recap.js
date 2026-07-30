// ============================================================
// 13. Market Recap  (denný „čo sa dialo na trhu / prečo rastie–klesá")
// ------------------------------------------------------------
// ROLA:          Raz denne ráno zhrnie stav celého krypto trhu a pokúsi sa
//                naznačiť PREČO — výhradne z dát, ktoré sme sami nazbierali
//                (CoinGecko, Fear & Greed, DefiLlama) + z UDALOSTÍ dňa, ktoré
//                už prešli našou frontou (regulácie, oznámenia…).
// VSTUP:         — (nečíta z queue; sám je producent ako 01-scout)
// VÝSTUP status: written   (ďalej ho odfotí 11-image a zverejní 12-publisher)
// STAV:          🟢 MVP
// AI vrstva:     3 Sonnet (1× za deň; bez udalostí → dátová šablóna ZADARMO)
// ------------------------------------------------------------
// LEGAL (CLAUDE.md → Model 2):
//   - AI dostáva LEN naše štruktúrované čísla + NAŠE vlastné titulky/fakty udalostí
//     (nie cudzí zdrojový text). Kauzalitu netvrdí ako istotu — len „môže súvisieť".
//   - Sekundárne udalosti nesú source_type → recap ich atribuuje „podľa X".
// ============================================================

import { db } from '../_shared/queue.js';
import { ask } from '../_shared/ai-gateway.js';
import { topMarkets } from '../_shared/coingecko.js';
import { fearGreed, FNG_SK } from '../_shared/feargreed.js';
import { topProtocols } from '../_shared/defillama.js';

export const STAGE = {
  index: 13,
  name: "MarketRecap",
  output: "written",
};

const AGENT = '13-market-recap';
const RECAP_HOUR = Number(process.env.RECAP_HOUR ?? 7);   // od ktorej hodiny ráno smie vzniknúť
const RECAP_TIER = process.env.RECAP_TIER ?? 'smart';     // 'smart' (Sonnet) | 'cheap' (Haiku)

// Stablecoiny a wrapped tokeny do „top pohybov" nepatria (pohyb ~0, nie je to story).
const STABLE = new Set(['usdt','usdc','dai','fdusd','tusd','usde','usds','pyusd','busd','usdd','frax','gusd']);
const WRAPPED = new Set(['wbtc','weth','wsteth','steth','weeth','reth','cbbtc','wbeth']);

// Slovenské formátovanie.
function nf(x, d = 1) {
  return Number(x).toLocaleString('sk-SK', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pct(x) { return `${x >= 0 ? '+' : '−'}${nf(Math.abs(x), 1)} %`; }
function fmtBig(x) {
  if (x >= 1e12) return `${nf(x / 1e12, 2)} bil. USD`;
  if (x >= 1e9) return `${nf(x / 1e9, 1)} mld. USD`;
  if (x >= 1e6) return `${nf(x / 1e6, 1)} mil. USD`;
  return `${nf(x, 0)} USD`;
}

// F&G aj za včera (na zmenu nálady). Vlastný malý fetch (limit=2).
async function fearGreedPair() {
  const today = await fearGreed();
  let prev = null;
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=2', { headers: { accept: 'application/json' } });
    if (res.ok) {
      const d = (await res.json())?.data?.[1];
      if (d) prev = { value: Number(d.value), classification: d.value_classification };
    }
  } catch { /* nepodstatné, ide ďalej bez včerajška */ }
  return { today, prev };
}

// Štruktúrovaný obraz trhu z dát, ktoré už máme. Bez AI.
async function gatherMarket() {
  const [markets, fg, protos] = await Promise.all([
    topMarkets({ perPage: 100 }).catch(() => []),
    fearGreedPair().catch(() => ({ today: null, prev: null })),
    topProtocols({ limit: 60 }).catch(() => []),
  ]);

  const byId = Object.fromEntries(markets.map((c) => [c.id, c]));
  const btc = byId.bitcoin;
  const eth = byId.ethereum;

  // Šírka trhu: koľko z top100 rastie vs. klesá (breadth).
  const moves = markets.map((c) => c.price_change_percentage_24h).filter((x) => typeof x === 'number');
  const up = moves.filter((x) => x > 0).length;
  const down = moves.filter((x) => x < 0).length;

  // Top pohyby (bez stablecoinov a wrapped; len reálne mince z top100).
  const real = markets.filter((c) => {
    const s = (c.symbol || '').toLowerCase();
    return !STABLE.has(s) && !WRAPPED.has(s) && typeof c.price_change_percentage_24h === 'number';
  });
  const gainers = [...real].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h).slice(0, 3);
  const losers = [...real].sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h).slice(0, 3);

  // Najväčší TVL pohyb dňa (kontext DeFi).
  const tvlMover = [...protos]
    .filter((p) => typeof p.change_24h_pct === 'number' && Math.abs(p.change_24h_pct) >= 8)
    .sort((a, b) => Math.abs(b.change_24h_pct) - Math.abs(a.change_24h_pct))[0] ?? null;

  return {
    btc: btc ? { change: btc.price_change_percentage_24h, price: btc.current_price } : null,
    eth: eth ? { change: eth.price_change_percentage_24h, price: eth.current_price } : null,
    breadth: { up, down, total: up + down },
    gainers: gainers.map((c) => ({ name: c.name, change: c.price_change_percentage_24h })),
    losers: losers.map((c) => ({ name: c.name, change: c.price_change_percentage_24h })),
    fng: fg.today, fngPrev: fg.prev,
    tvlMover: tvlMover ? { name: tvlMover.name, change: tvlMover.change_24h_pct, tvl: tvlMover.tvl_usd } : null,
  };
}

// Udalosti dňa = NAŠE články, čo dnes prešli frontou (kandidáti na „prečo").
// Len skutočné udalosti (regulácie/oznámenia/listingy/upgrady), nie čistá dáta.
const CAUSE_TYPES = new Set(['regulatory', 'announcement', 'listing', 'protocol_release', 'governance']);

async function gatherTodaysEvents() {
  const since = new Date(Date.now() - 22 * 3600 * 1000).toISOString();
  const { data } = await db.from('queue')
    .select('article, facts, status, updated_at')
    .in('status', ['written', 'imaged', 'published'])
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(40);

  const events = [];
  for (const r of data ?? []) {
    if (!r.article || r.article.kind === 'market_recap') continue;     // nie my sami
    const et = r.facts?.event_type ?? r.article?.event_type ?? 'other';
    if (!CAUSE_TYPES.has(et)) continue;
    const src = (r.article.sources ?? [])[0] ?? {};
    events.push({
      headline: r.article.headline,
      entity: r.article.entity ?? r.facts?.entity ?? null,
      event_type: et,
      importance: r.facts?.importance ?? r.article?.importance ?? 0,
      source_name: src.name ?? null,
      source_type: src.type ?? 'primary',
    });
  }
  return events.sort((a, b) => b.importance - a.importance).slice(0, 5);
}

// ---------- Smer trhu (software) ----------
function marketDirection(m) {
  const anchor = m.btc?.change ?? 0;
  const breadthUp = m.breadth.total ? m.breadth.up / m.breadth.total : 0.5;
  if (anchor >= 1.5 || (anchor >= 0.3 && breadthUp >= 0.65)) return 'up';
  if (anchor <= -1.5 || (anchor <= -0.3 && breadthUp <= 0.35)) return 'down';
  return 'mixed';
}

// ---------- Dátová šablóna (ZADARMO, fallback bez AI / bez udalostí) ----------
function recapTemplate(m, dir) {
  const dirWord = dir === 'up' ? 'rástol' : dir === 'down' ? 'oslaboval' : 'bol zmiešaný';
  const headline = dir === 'up' ? 'Krypto trh dnes rástol' :
                   dir === 'down' ? 'Krypto trh dnes oslaboval' : 'Krypto trh dnes bez jasného smeru';
  const parts = [];
  if (m.btc) parts.push(`Bitcoin sa za 24 hodín zmenil o ${pct(m.btc.change)} na ${fmtBig(m.btc.price)}`
    + `${m.eth ? `, ethereum o ${pct(m.eth.change)}` : ''}.`);
  parts.push(`Z prvej stovky najväčších kryptomien rástlo ${m.breadth.up} a klesalo ${m.breadth.down}.`);

  const perex = `Krypto trh ${dirWord}. ${m.btc ? `Bitcoin ${pct(m.btc.change)} za 24 hodín.` : ''}`.trim();

  const p2 = [];
  if (m.gainers.length) p2.push(`Najviac rástli: ${m.gainers.map((g) => `${g.name} (${pct(g.change)})`).join(', ')}.`);
  if (m.losers.length) p2.push(`Najviac klesali: ${m.losers.map((g) => `${g.name} (${pct(g.change)})`).join(', ')}.`);

  const p3 = [];
  if (m.fng) {
    const sk = FNG_SK[m.fng.classification] ?? m.fng.classification;
    const moveTxt = m.fngPrev && m.fngPrev.value !== m.fng.value
      ? ` (včera ${m.fngPrev.value})` : '';
    p3.push(`Index strachu a chamtivosti ukazuje „${sk}" s hodnotou ${m.fng.value} zo 100${moveTxt}.`);
  }
  if (m.tvlMover) {
    p3.push(`Z DeFi protokolov sa najvýraznejšie pohlo ${m.tvlMover.name} — TVL ${pct(m.tvlMover.change)} `
      + `na ${fmtBig(m.tvlMover.tvl)}.`);
  }

  const body = [parts.join(' '), p2.join(' '), p3.join(' ')].filter(Boolean).join('\n\n');
  return { headline, perex, body, attribution_used: false, generated_by: 'template' };
}

// ---------- AI verzia (Sonnet) — vplete do dát aj udalosti dňa ----------
const RECAP_SYSTEM = `Si slovenský redaktor krypto denníka. Píšeš KRÁTKY ranný prehľad trhu pre bežného čitateľa.
Dostaneš IBA štruktúrované dáta (čísla) a zoznam UDALOSTÍ, ktoré sa dnes stali. Nič iné nevieš.
Výstup je IBA validný JSON, bez code fences: {"headline": string, "perex": string, "body": string, "attribution_used": boolean}

ÚLOHA:
- Povedz ľudsky, ČO trh dnes robil (rástol / klesal / bez smeru) a uveď pár podstatných čísel (Bitcoin, nálada).
- Skús naznačiť, ČO za tým môže byť — ALE LEN cez poskytnuté udalosti dňa. NETVRDÍ kauzalitu ako istotu:
  použi opatrné formulácie „k nálade mohlo prispieť", „v pozadí rezonovalo", „medzi témami dňa bolo".
- Ak žiadne udalosti nie sú, kauzalitu NEVYMÝŠĽAJ — napíš len faktický stav trhu.

PRAVIDLÁ:
- Použi VÝHRADNE poskytnuté čísla a udalosti. Žiadne vonkajšie poznatky, žiadne dohady o cenách.
- Žiadne investičné rady, žiadne predpovede, žiadny marketing.
- Ak má udalosť source_type "secondary", uveď pri nej „podľa {source_name}". Potom attribution_used=true.
- "headline": max ~10 slov. "perex": 1–2 vety. "body": 2–4 krátke odseky (prázdny riadok medzi nimi).
- Píš plynulo a striedmo, radšej kratšie. Žiadny markdown nadpis.`;

function stripFences(s) {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function aiPayload(m, events, dir) {
  return JSON.stringify({
    market_direction: dir,
    bitcoin_24h_pct: m.btc?.change ?? null,
    ethereum_24h_pct: m.eth?.change ?? null,
    breadth: m.breadth,
    top_gainers: m.gainers,
    top_losers: m.losers,
    fear_greed: m.fng ? { value: m.fng.value, label: FNG_SK[m.fng.classification] ?? m.fng.classification } : null,
    fear_greed_yesterday: m.fngPrev?.value ?? null,
    biggest_tvl_move: m.tvlMover,
    todays_events: events.map((e) => ({
      headline: e.headline, entity: e.entity, type: e.event_type,
      source_name: e.source_name, source_type: e.source_type,
    })),
  }, null, 2);
}

// Zdroje pod článok: vždy naše dátové zdroje + zdroje udalostí, ktoré recap použil.
function recapSources(events) {
  const out = [
    { name: 'CoinGecko', url: 'https://www.coingecko.com/', type: 'primary' },
    { name: 'Fear & Greed Index', url: 'https://alternative.me/crypto/fear-and-greed-index/', type: 'primary' },
    { name: 'DefiLlama', url: 'https://defillama.com/', type: 'primary' },
  ];
  const seen = new Set(out.map((s) => s.name));
  for (const e of events) {
    if (e.source_name && !seen.has(e.source_name)) {
      seen.add(e.source_name);
      out.push({ name: e.source_name, url: null, type: e.source_type ?? 'primary' });
    }
  }
  return out;
}

// ---------- Vytvor recap a vlož ho do fronty ako 'written' ----------
async function buildAndInsert({ dryRun = false } = {}) {
  const m = await gatherMarket();
  if (!m.btc) throw new Error('Nepodarilo sa získať dáta trhu (CoinGecko)');
  const dir = marketDirection(m);
  const events = dryRun ? [] : await gatherTodaysEvents();

  let base;
  const aiOn = !dryRun && process.env.AI_ENABLED !== 'false';
  // AI len keď je zmysel ju mať: máme udalosti, ktoré vieme vpliesť. Inak šablóna zadarmo.
  if (aiOn && events.length > 0) {
    const raw = await ask({
      tier: RECAP_TIER, agent: AGENT,
      system: RECAP_SYSTEM, prompt: aiPayload(m, events, dir),
      maxTokens: 1100, temperature: 0.5,
    });
    let parsed = null;
    try { parsed = JSON.parse(stripFences(raw)); } catch { parsed = null; }
    if (parsed?.headline && parsed?.body) {
      base = {
        headline: String(parsed.headline).trim(),
        perex: parsed.perex ? String(parsed.perex).trim() : null,
        body: String(parsed.body).trim(),
        attribution_used: parsed.attribution_used === true,
        generated_by: 'ai',
      };
    }
  }
  if (!base) base = recapTemplate(m, dir);   // fallback (bez AI / zlyhanie parse)

  const article = {
    ...base,
    kind: 'market_recap',                    // marker — nech sa nepočíta sám medzi udalosti
    lang: 'sk',
    entity: 'Krypto trh',
    event_type: 'market_recap',
    importance: 100,                         // vždy prejde cap-om publishera (priorita dňa)
    sources: recapSources(events),
    word_count: base.body.trim().split(/\s+/).filter(Boolean).length,
    written_at: new Date().toISOString(),
  };

  if (dryRun) return { dryRun: true, direction: dir, events: events.length, article };

  // Vlož rovno ako 'written' — ďalej to nesie 11-image + 12-publisher.
  const { error } = await db.from('queue').insert({
    source_id: null,
    status: 'written',
    raw_data: { _src: 'market_recap', day: dayKey() },
    facts: { entity: 'Krypto trh', event_type: 'market_recap', importance: 100 },
    article,
  });
  if (error) throw error;
  return { headline: article.headline, generated_by: article.generated_by, events: events.length };
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);   // YYYY-MM-DD (UTC)
}

// Už existuje dnešný recap? (idempotencia — hodinový cron ho nesmie spraviť 24×)
async function recapExistsToday() {
  const { data } = await db.from('queue')
    .select('id')
    .eq('raw_data->>_src', 'market_recap')
    .eq('raw_data->>day', dayKey())
    .limit(1);
  return (data ?? []).length > 0;
}

// ---------- Vstupný bod pre pipeline ----------
// Vyrobí MAX 1 recap za deň, a to až od RECAP_HOUR ráno. Inak no-op.
export async function run({ force = false, dryRun = false } = {}) {
  if (dryRun) return buildAndInsert({ dryRun: true });
  const hour = new Date().getHours();
  if (!force && hour < RECAP_HOUR) return { skipped: `pred ${RECAP_HOUR}:00` };
  if (!force && await recapExistsToday()) return { skipped: 'dnešný recap už existuje' };
  return buildAndInsert();
}
