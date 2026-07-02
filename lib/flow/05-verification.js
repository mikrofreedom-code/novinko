// ============================================================
// 05. Verification
// ------------------------------------------------------------
// ROLA:          LEGÁLNE KRITICKÝ. Overí a vytiahne LEN fakty do JSON. Zahodí vyjadrenie zdroja. = náš "Fact Extractor". Toto je to čo nás chráni.
// VSTUP status:  collected
// VÝSTUP status: facts_ready
// STAV:          🟢 MVP
// AI vrstva:     2 Haiku (LEN pre textové zdroje; Layer A ide bez AI)
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================
//
// LEGAL (CLAUDE.md → Sourcing model, Model 2):
//   - Výstup `facts` NIKDY neobsahuje pôvodné vety zdroja, len atomické fakty.
//   - Atribúciu (source_name/url/type) kladieme KÓDOM z metadát položky,
//     AI ju nikdy negeneruje → nedá sa halucinovať.
//   - Ak je medzi faktami secondary zdroj → attribution_required = true
//     (Writer potom MUSÍ napísať „podľa X").
//
// KONTRAKT raw_data (produkuje 04-collector):
//   {
//     source_name, source_url,
//     source_type: 'primary' | 'secondary',
//     layer: 'A' | 'B' | 'C',
//     entity?: string,            // best-guess subjekt
//     metrics?: { key: number },  // Layer A: štruktúrované čísla
//     title?: string, text?: string  // Layer B/C: ľudský text
//   }
// ============================================================

import { claim, advance } from '../_shared/queue.js';
import { ask } from '../_shared/ai-gateway.js';
import { groundFacts } from '../_shared/grounding.js';

export const STAGE = {
  index: 5,
  name: "Verification",
  input: "collected",
  output: "facts_ready",
};

const AGENT = '05-verification';

const EVENT_TYPES = [
  'price_move', 'tvl_shift', 'listing', 'protocol_release',
  'regulatory', 'governance', 'announcement', 'other',
];

// Jednotky pre bežné Layer A metriky (mapovanie kódom, žiadne AI).
const METRIC_UNITS = {
  price_usd: 'USD', market_cap_usd: 'USD', volume_24h_usd: 'USD',
  tvl_usd: 'USD', liquidity_usd: 'USD', fdv_usd: 'USD',
  change_24h_pct: '%', change_7d_pct: '%', change_1h_pct: '%',
};

// ---------- Layer A: čísla → fakty (BEZ AI) ----------
function factsFromMetrics(metrics, meta) {
  return Object.entries(metrics)
    .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
    .map(([key, value]) => ({
      claim: key,
      statement: null,
      value,
      unit: METRIC_UNITS[key] ?? null,
      source_name: meta.source_name,
      source_url: meta.source_url,
      source_type: meta.source_type,
      confidence: 0.99, // priame API číslo
    }));
}

// ---------- Layer B/C: text → atomické fakty (Haiku) ----------
const EXTRACT_SYSTEM = `You are a legally-critical fact extractor for a crypto news desk.
Output ONLY valid JSON, no prose, no code fences.
Schema: {"entity": string|null, "event_type": one of [${EVENT_TYPES.join(', ')}], "facts": [{"statement": string, "value": number|null, "unit": string|null, "confidence": number}]}
Rules:
- Extract ATOMIC, verifiable facts only. One fact = one statement.
- NEVER copy the source's original sentences or phrasing. Rephrase into a neutral, minimal factual claim.
- Do NOT include opinions, speculation, marketing language, or the source's framing.
- "statement" must be a short neutral fact in English, max ~15 words.
- If a fact carries a number, put it in "value" + "unit" and keep "statement" qualitative.
- Do NOT invent sources, names, or URLs. Output no attribution fields.`;

function stripFences(s) {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

async function factsFromText(item, meta) {
  const text = [item.raw_data?.title, item.raw_data?.text].filter(Boolean).join('\n\n');
  if (!text) return { entity: meta.entity ?? null, event_type: 'other', facts: [] };

  const raw = await ask({
    tier: 'cheap',
    agent: AGENT,
    queueId: item.id,
    system: EXTRACT_SYSTEM,
    prompt: text,
    maxTokens: 1200,
    temperature: 0,
  });

  let parsed;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    throw new Error(`Fact extractor returned non-JSON: ${raw.slice(0, 200)}`);
  }

  const event_type = EVENT_TYPES.includes(parsed.event_type) ? parsed.event_type : 'other';
  const facts = (Array.isArray(parsed.facts) ? parsed.facts : []).map((f) => ({
    claim: typeof f.statement === 'string' ? f.statement.slice(0, 200) : 'fact',
    statement: typeof f.statement === 'string' ? f.statement.slice(0, 200) : null,
    value: typeof f.value === 'number' && Number.isFinite(f.value) ? f.value : null,
    unit: typeof f.unit === 'string' ? f.unit : null,
    // Atribúcia VŽDY z metadát položky, nikdy nie z AI:
    source_name: meta.source_name,
    source_url: meta.source_url,
    source_type: meta.source_type,
    confidence: typeof f.confidence === 'number' ? Math.max(0, Math.min(1, f.confidence)) : 0.6,
  }));

  // KONTROLA PRAVDY: zahoď fakty, ktorých čísla nie sú v zdrojovom texte
  // (chytá halucinácie — vymyslené štatistiky/dátumy). Kým máme zdroj.
  // TODO (Fáza 2, AI): kvalitatívne fakty (bez čísel) by overil Haiku (yes/no).
  const { kept, dropped } = groundFacts(facts, text);
  if (dropped.length) {
    console.warn(`[${AGENT}] grounding: zahodených ${dropped.length} faktov s číslami mimo zdroja`);
  }

  return { entity: parsed.entity ?? meta.entity ?? null, event_type, facts: kept };
}

// ---------- Spoluj fakty do finálneho facts JSON ----------
function buildFacts({ entity, event_type, facts, section }) {
  const attribution_required = facts.some((f) => f.source_type === 'secondary');
  return {
    entity: entity ?? null,
    event_type: event_type ?? 'other',
    section: section ?? 'krypto',   // desk položky → 06 vyberie importance profil, 12 kategóriu
    lang_source: 'en',
    extracted_at: new Date().toISOString(),
    attribution_required,
    facts,
  };
}

function readMeta(rd) {
  if (!rd || !rd.source_url || !rd.source_name) {
    throw new Error('raw_data chýba povinné polia source_name/source_url');
  }
  return {
    source_name: rd.source_name,
    source_url: rd.source_url,
    source_type: rd.source_type === 'secondary' ? 'secondary' : 'primary',
    entity: rd.entity ?? null,
    layer: rd.layer ?? null,
    section: rd.section ?? 'krypto',
  };
}

// ---------- Spracuj JEDNU položku ----------
export async function run(item) {
  const rd = item.raw_data ?? {};
  const meta = readMeta(rd);

  const collected = [];
  let entity = meta.entity;
  let event_type = 'other';

  // Layer A: čísla bez AI.
  if (rd.metrics && typeof rd.metrics === 'object') {
    collected.push(...factsFromMetrics(rd.metrics, meta));
  }

  // Layer B/C: text cez Haiku.
  if (rd.text || rd.title) {
    const fromText = await factsFromText(item, meta);
    entity = fromText.entity ?? entity;
    event_type = fromText.event_type;
    collected.push(...fromText.facts);
  }

  if (collected.length === 0) {
    throw new Error('Žiadne fakty sa nepodarilo extrahovať (prázdne metrics aj text)');
  }
  // Typ udalosti podľa metrík (Layer A): TVL → tvl_shift, nálada → sentiment, inak cena.
  if (event_type === 'other' && rd.metrics) {
    if (rd.metrics.tvl_usd != null) event_type = 'tvl_shift';
    else if (rd.metrics.fng_value != null) event_type = 'sentiment';
    else event_type = 'price_move';
  }

  const facts = buildFacts({ entity, event_type, facts: collected, section: meta.section });
  // Prenes klasifikáciu nálady pre šablónu (F&G).
  if (rd.fng_classification) facts.fng_classification = rd.fng_classification;
  await advance(item.id, STAGE.output, { facts });
  return facts;
}

// ---------- Dávkové spracovanie celej fronty v stave `collected` ----------
export async function runBatch(limit = 10) {
  const aiEnabled = process.env.AI_ENABLED !== 'false';
  const items = await claim(STAGE.input, limit);
  const results = { ok: 0, failed: 0, parked: 0 };
  for (const item of items) {
    const rd = item.raw_data ?? {};
    // Zberový režim: textové položky (potrebujú Haiku) NEspracúvaj, nech čakajú.
    // Číselné (Layer A) sú zadarmo → spracuj vždy.
    if (!aiEnabled && (rd.text || rd.title) && !rd.metrics) { results.parked++; continue; }
    try {
      await run(item);
      results.ok++;
    } catch (err) {
      results.failed++;
      await advance(item.id, 'error', { error: `${AGENT}: ${err.message}` });
    }
  }
  return results;
}
