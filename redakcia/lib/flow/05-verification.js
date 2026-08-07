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
import { askFull } from '../_shared/ai-gateway.js';
import { groundFacts, quoteGrounded } from '../_shared/grounding.js';
import { prescore } from '../_shared/prescore.js';
import { fetchFullArticleText } from '../_shared/fetch-article.js';

// Pod touto dĺžkou RSS súhrnu skús dotiahnuť celý článok zo zdroja (viac
// materiálu pre Fact Extractor). Nad týmto stropom má feed už dosť textu,
// netreba sťahovať nič navyše. Stiahnutý text sa NIKDY neukladá do DB —
// použije sa len dočasne nižšie ako vstup pre AI extrakciu.
const MIN_TEXT_FOR_RICH_EXTRACTION = 400;

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
      kind: 'fact',
      claim: key,
      statement: null,
      quote_speaker: null,
      value,
      unit: METRIC_UNITS[key] ?? null,
      source_name: meta.source_name,
      source_url: meta.source_url,
      source_type: meta.source_type,
      confidence: 0.99, // priame API číslo
    }));
}

// ---------- Layer B/C: text → atomické fakty (Haiku) ----------
// `desk` = zdroj je research desk búrzy/analytického domu (viď feeds.js).
// LEN takýto zdroj smie priniesť fakt kind="analysis" — teda VÝKLAD, prečo sa
// niečo na trhu stalo. Bežné oznámenie (release, regulátor, governance) žiadnu
// príčinu neprináša a nesmie: inak by sme publikovali dohad ako fakt.
const kindsFor = (desk) => desk
  ? '"fact"|"quote"|"background"|"analysis"'
  : '"fact"|"quote"|"background"';

const ANALYSIS_RULE = `
- kind="analysis" (ONLY for this source type): the desk's own market commentary
  explaining WHY something moved — drivers, positioning, flows, macro context.
  Rephrase into a neutral claim (do NOT copy their sentences), max ~25 words.
  Extract these ONLY when the source actually argues a cause. Never infer a
  cause yourself, never merge two unrelated statements into a causal one.
  This is the ONLY kind allowed to express causality. Everything the desk
  presents as its own reading of the market belongs here, NOT in kind="fact".`;

// Bez tohto pravidla model príčinu jednoducho prepašuje ako obyčajný fakt —
// overené 2026-08-01: z vety „our desk believes the decline was driven by
// liquidations" vyrobil fact „Leveraged long liquidations contributed to the
// price decline". Writer by to potom podal ako overený fakt BEZ atribúcie,
// teda presne to, čomu má celá táto architektúra brániť.
const NO_CAUSALITY_RULE = `
- MARKET CAUSALITY IS NOT A FACT: never extract a statement that explains WHY a
  price, volume, flow or market moved ("liquidations drove the decline", "fell
  due to ETF outflows", "amid macro uncertainty", "contributed to the drop").
  That is interpretation, and this source is not authorised to carry it — drop
  such statements entirely, even when the source states them confidently.
  Extract only WHAT happened.
  EXCEPTION: an entity explaining its OWN action is a fact and stays
  ("the exchange paused withdrawals after a security incident").`;

const extractSystem = (desk) => `You are a legally-critical fact extractor for a crypto news desk.
Output ONLY valid JSON, no prose, no code fences.
Schema: {"entity": string|null, "event_type": one of [${EVENT_TYPES.join(', ')}], "facts": [{"kind": ${kindsFor(desk)}, "statement": string, "quote_speaker": string|null, "value": number|null, "unit": string|null, "confidence": number}]}
Rules:${desk ? ANALYSIS_RULE : NO_CAUSALITY_RULE}
- THOROUGHNESS: extract EVERY distinct verifiable fact present in the text, not just
  the single most obvious one. Be concrete about volume: a full source article
  (roughly 800+ words) should yield 12-20 facts, a short announcement 4-8.
  Under-extracting is the common failure — if you produced fewer than 10 facts
  from a long text, re-read it and look for what you skipped: numbers, dates,
  names, stated positions, sequence of events, consequences, who said what.
  ("several facts" proved too vague — the median yield was 7 facts even from
  6000-character sources, which caps every article at ~120 words.)
- One fact = one statement (atomic).
- Default kind="fact": NEVER copy the source's original sentences or phrasing —
  rephrase into a neutral, minimal factual claim, max ~15 words. No opinions,
  speculation, marketing language, or the source's framing.
- kind="quote" (EXCEPTION to the no-copying rule): if the source explicitly
  attributes a short direct quote (max ~40 words) to a NAMED person or
  organization ("spokesperson said: ...", "CEO X stated ..."), you MAY extract
  it VERBATIM as "statement", with "quote_speaker" set to who said it. Only use
  this if a genuine quotation is present — never invent or paraphrase into a quote.
- kind="background": if the source itself describes what the entity/project IS
  or does (e.g. "X is a Layer-2 scaling network launched in 2021"), you may
  extract ONE such rephrased (not copied) background statement.
- If a fact carries a number, put it in "value" + "unit" and keep "statement" qualitative.
- Do NOT invent sources, names, or URLs. Output no attribution fields.`;

function stripFences(s) {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

// Exportované kvôli behu nasucho (scripts/dry-run-desk.mjs) — overenie
// extrakcie na reálnom článku bez zápisu do fronty. Rovnaký zámer ako
// dryRun v 08-proofreader.
export async function factsFromText(item, meta) {
  let text = [item.raw_data?.title, item.raw_data?.text].filter(Boolean).join('\n\n');
  if (!text) return { entity: meta.entity ?? null, event_type: 'other', facts: [] };

  // RSS súhrn je príliš krátky na to, aby z neho bolo čo extrahovať →
  // skús dotiahnuť celý článok zo zdroja (dočasne, v pamäti, viď fetch-article.js).
  if (text.length < MIN_TEXT_FOR_RICH_EXTRACTION && meta.source_url) {
    const full = await fetchFullArticleText(meta.source_url);
    if (full && full.length > text.length) {
      text = [item.raw_data?.title, full].filter(Boolean).join('\n\n');
    }
  }

  // Rozpočet tokenov na odpoveď. 1200 bolo primálo: pri dlhších oznámeniach
  // (governance návrhy, protokolové release notes) sa JSON urezal uprostred
  // a celá správa sa zahodila ako „non-JSON". Preto vyšší základ + jeden
  // opakovaný pokus s dvojnásobkom, keď sa aj tak ureže.
  const EXTRACT_MAX_TOKENS = Number(process.env.EXTRACT_MAX_TOKENS ?? 4000);

  async function extract(maxTokens) {
    return askFull({
      tier: 'cheap',
      agent: AGENT,
      queueId: item.id,
      system: extractSystem(meta.desk === true),
      prompt: text,
      maxTokens,
      temperature: 0,
    });
  }

  let res = await extract(EXTRACT_MAX_TOKENS);
  if (res.truncated) {
    console.warn(`[${AGENT}] odpoveď urezaná na ${EXTRACT_MAX_TOKENS} tokenoch — opakujem s dvojnásobkom`);
    res = await extract(EXTRACT_MAX_TOKENS * 2);
  }
  const raw = res.text;

  let parsed;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    // Rozlíš urezanú odpoveď od skutočne pokazenej — inak sa príčina nedá dohľadať.
    const dovod = res.truncated
      ? `odpoveď urezaná aj pri ${EXTRACT_MAX_TOKENS * 2} tokenoch (zdroj je príliš dlhý)`
      : 'model nevrátil platný JSON';
    throw new Error(`Fact extractor returned non-JSON: ${dovod}: ${raw.slice(0, 200)}`);
  }

  const event_type = EVENT_TYPES.includes(parsed.event_type) ? parsed.event_type : 'other';
  // POISTKA KÓDOM, nielen promptom: 'analysis' pripúšťame výhradne od deskov.
  // Keby model vrátil 'analysis' aj inde (alebo sa raz zmenil prompt), tu to
  // spadne späť na obyčajný fakt — príčina sa tak nemá ako prepašovať dnu.
  const VALID_KINDS = meta.desk === true
    ? ['fact', 'quote', 'background', 'analysis']
    : ['fact', 'quote', 'background'];
  const facts = (Array.isArray(parsed.facts) ? parsed.facts : []).map((f) => ({
    kind: VALID_KINDS.includes(f.kind) ? f.kind : 'fact',
    claim: typeof f.statement === 'string' ? f.statement.slice(0, 200) : 'fact',
    statement: typeof f.statement === 'string' ? f.statement.slice(0, 200) : null,
    quote_speaker: typeof f.quote_speaker === 'string' ? f.quote_speaker.slice(0, 100) : null,
    value: typeof f.value === 'number' && Number.isFinite(f.value) ? f.value : null,
    unit: typeof f.unit === 'string' ? f.unit : null,
    // Atribúcia VŽDY z metadát položky, nikdy nie z AI:
    source_name: meta.source_name,
    source_url: meta.source_url,
    source_type: meta.source_type,
    confidence: typeof f.confidence === 'number' ? Math.max(0, Math.min(1, f.confidence)) : 0.6,
  }));

  // KONTROLA PRAVDY (čísla): zahoď fakty, ktorých čísla nie sú v zdrojovom texte
  // (chytá halucinácie — vymyslené štatistiky/dátumy). Kým máme zdroj.
  // TODO (Fáza 2, AI): kvalitatívne fakty (bez čísel) by overil Haiku (yes/no).
  const { kept: numGrounded, dropped } = groundFacts(facts, text);
  if (dropped.length) {
    console.warn(`[${AGENT}] grounding: zahodených ${dropped.length} faktov s číslami mimo zdroja`);
  }

  // KONTROLA PRAVDY (citáty): prísnejšia — citát musí byť DOSLOVNE v zdroji,
  // inak ho zahoď (vymyslený citát pripísaný niekomu je vážnejšie riziko než
  // zlé číslo).
  const kept = numGrounded.filter((f) => {
    if (f.kind !== 'quote') return true;
    const ok = quoteGrounded(f.statement, text);
    if (!ok) console.warn(`[${AGENT}] grounding: zahodený citát nenájdený doslovne v zdroji`);
    return ok;
  });

  return { entity: parsed.entity ?? meta.entity ?? null, event_type, facts: kept };
}

// ---------- Spoluj fakty do finálneho facts JSON ----------
function buildFacts({ entity, event_type, facts, section }) {
  // Výklad desku sa BEZ atribúcie publikovať nesmie — je to ich názor, nie
  // overený fakt. Preto 'analysis' vynucuje „podľa X" rovnako ako sekundárny
  // zdroj; Writer bez nej neprejde (kontrola v 07-writer).
  const attribution_required = facts.some(
    (f) => f.source_type === 'secondary' || f.kind === 'analysis',
  );
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
    desk: rd.desk === true,
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
// Koľko PLATENÝCH extrakcií (text → Haiku) sa smie spraviť za jeden beh.
// Číselné položky (Layer A) sem nerátame — tie nestoja nič a idú vždy.
//
// Toto je hlavná úspora: extrakcia žrala 76 % rozpočtu a 9 z 10 volaní padlo
// na položku, ktorú vzápätí zahodila brána dôležitosti. Strop + poradie podľa
// prescore() znamená, že za peniaze ide to najsľubnejšie, nie to najstaršie.
// Zvyšok nezaniká — ostáva v 'collected' a príde na rad v ďalšom behu.
const MAX_EXTRACTIONS_PER_RUN = Number(process.env.MAX_EXTRACTIONS_PER_RUN ?? 12);

// Koľko kandidátov si vôbec vytiahnuť, aby bolo z čoho vyberať.
const CANDIDATE_POOL = Number(process.env.EXTRACTION_POOL ?? 200);

export async function runBatch(limit = CANDIDATE_POOL) {
  const aiEnabled = process.env.AI_ENABLED !== 'false';
  const items = await claim(STAGE.input, limit);

  // Zadarmo (Layer A, čísla) vs. platené (text cez Haiku).
  const zadarmo = items.filter((it) => (it.raw_data ?? {}).metrics);
  const platene = items.filter((it) => {
    const rd = it.raw_data ?? {};
    return !rd.metrics && (rd.text || rd.title);
  });

  // Zberový režim: platené necháme čakať, číselné spracujeme.
  const vybrane = aiEnabled
    ? platene
      .map((it) => ({ it, s: prescore(it.raw_data ?? {}).score }))
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_EXTRACTIONS_PER_RUN)
      .map((x) => x.it)
    : [];

  const results = {
    ok: 0,
    failed: 0,
    // čakajú na ďalší beh (neminuli sme na ne nič)
    parked: platene.length - vybrane.length,
    zadarmo: zadarmo.length,
  };

  for (const item of [...zadarmo, ...vybrane]) {
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
