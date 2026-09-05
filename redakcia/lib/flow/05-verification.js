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
import { parseModelJson } from '../_shared/json.js';
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

// Vokabulár udalostí je PER SEKCIU. Krypto/AI si nechávajú pôvodný zoznam
// nezmenený; ekonomika má vlastný, lebo krypto typy (listing, protocol_release,
// tvl_shift) na hospodárske spravodajstvo nesadnú a naopak. Zoznam sa používa
// naraz pre prompt aj pre validáciu odpovede — typ mimo sekcie tak spadne na
// 'other' a nemôže prepadnúť do skórovania ako neznáma hodnota.
//
// POZOR: k tomuto zoznamu patrí dvojička — `eventBase` v lib/sections/index.js.
// Keď sem pridáš typ, MUSÍŠ mu tam dať skóre, inak sa bude tváriť ako 'other'.
const EVENT_TYPES_MARKET = [
  'price_move', 'tvl_shift', 'listing', 'protocol_release',
  'regulatory', 'governance', 'announcement', 'security', 'other',
];

const EVENT_TYPES_EKONOMIKA = [
  'data_release',        // CPI, HDP, nezamestnanosť, PMI — zverejnené číslo
  'rate_decision',       // Fed, ECB, iná centrálna banka
  'fiscal_policy',       // rozpočet, dane, dlh, výdavky štátu
  'trade_policy',        // clá, kvóty, obchodné dohody, sankcie s ekonomickým dopadom
  'corporate_earnings',  // výsledky firmy, výhľad, profit warning
  'market_reaction',     // pohyb indexu/meny/výnosov — sám osebe slabý, viď eventBase
  'forecast',            // prognóza inštitúcie (MMF, Komisia, banka)
  'regulatory', 'announcement', 'security', 'other',
];

const eventTypesFor = (section) => (section === 'ekonomika'
  ? EVENT_TYPES_EKONOMIKA
  : EVENT_TYPES_MARKET);

// Stav čísla tak, ako ho označuje sám zdroj. Čokoľvek iné (vrátane hádania)
// spadne na null — radšej bez označenia než s vymysleným.
const FACT_STATUSES = ['final', 'preliminary', 'revised', 'forecast'];

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

// Ekonomická obdoba ANALYSIS_RULE. Rozdiel oproti kryptu: tu nejde o „prečo sa
// pohla cena", ale o PROGNÓZU a očakávanie — a tie sú v hospodárskom
// spravodajstve všadeprítomné („trh čaká zníženie sadzieb v decembri").
// Model má silný sklon podať prognózu ako holý fakt, lebo zdroj ju často
// formuluje oznamovacím spôsobom. Preto je to tu povedané explicitne.
const ANALYSIS_RULE_EKONOMIKA = `
- kind="analysis" (ONLY for this source type): a forecast, expectation or
  interpretation — an economist's or the outlet's own reading of what a number
  means, what a central bank will do next, or why an indicator or market moved.
  Rephrase into a neutral claim (do NOT copy their sentences), max ~25 words.
  Extract these ONLY when the source actually makes the claim; never infer one.
  A FORECAST OR EXPECTATION IS ALWAYS "analysis", NEVER "fact" — even when the
  source states it flatly ("the ECB will cut rates in December", "growth will
  slow next year"). Only an already-published number is a fact.`;

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

// Pravidlá, ktoré platia LEN pre ekonomiku. Každé z nich vzniklo z konkrétnej
// chyby, ktorou sa hospodárske spravodajstvo prezradí ako amatérske:
//
//   period  — septembrová správa hovorí o auguste. Bez tohto poľa Writer dá
//             článku dátum zverejnenia a napíše „inflácia v septembri", čo je
//             vecne nesprávne.
//   status  — flash odhad HDP nie je konečné číslo a revízia nie je nový údaj.
//             Štatistické úrady to označujú samy, takže sa to nemusí hádať.
//             (Je to zároveň jednoduchá verzia osi potvrdené/predbežné, ktorú
//             bude potrebovať sekcia Svet — tam ju ale nikto neoznačí za nás.)
//   porovnanie — NAJVÄČŠIE riziko. Model vie, že „4,1 %" je nezamestnanosť, a
//             ochotne dopíše „viac než minulý mesiac", hoci to zdroj netvrdí.
//             Presne ten istý typ zlyhania ako pri krypto kauzalite nižšie.
//   p. b.   — sadzba zo 4,00 % na 4,25 % stúpla o 0,25 p. b., nie o 0,25 %.
//             Zámena je pre hospodársku redakciu diskvalifikačná chyba.
const EKONOMIKA_RULES = `
- PERIOD, NOT PUBLICATION DATE: an economic figure describes a reference period
  that is usually NOT the day it was published ("August", "Q2 2026", "12 months
  to July"). Put it in "period" exactly as the source words it. null if unstated.
- STATUS: "final" | "preliminary" | "revised" | "forecast" — set it ONLY when the
  source labels the figure that way (flash estimate → preliminary, revision →
  revised, projection → forecast). Otherwise null. Never guess.
- COMPARISON IS NOT YOURS TO COMPUTE: never state that a figure rose or fell
  against a previous period, beat or missed expectations, or set a record,
  UNLESS THE SOURCE SAYS SO ITSELF. Do not calculate it, do not fill it in from
  your own knowledge, do not infer a direction from a single number. When the
  source DOES give the previous value or the economists' consensus, extract that
  as its own separate fact.
- PERCENT vs PERCENTAGE POINTS: keep the source's own unit exactly ("%" vs "pp").
  A rate moving from 4.00% to 4.25% rose by 0.25 pp, NOT by 0.25%. Never convert
  between the two and never invent one when the source is vague.
- "source_emphasis": if the SOURCE ITSELF frames the number as notable ("record
  high", "first since 2020", "unexpectedly", "biggest drop in two years"), copy
  that short phrase there. null if the source makes no such claim. Never add
  emphasis of your own — this field exists to carry the source's, not yours.`;

const extractSystem = (desk, section) => {
  const ekonomika = section === 'ekonomika';
  const analysisRule = ekonomika ? ANALYSIS_RULE_EKONOMIKA : ANALYSIS_RULE;
  const factFields = ekonomika
    ? '"statement": string, "quote_speaker": string|null, "value": number|null, "unit": string|null, "period": string|null, "status": "final"|"preliminary"|"revised"|"forecast"|null, "confidence": number'
    : '"statement": string, "quote_speaker": string|null, "value": number|null, "unit": string|null, "confidence": number';
  const topFields = ekonomika
    ? '"entity": string|null, "event_type": one of [' + eventTypesFor(section).join(', ') + '], "source_emphasis": string|null'
    : '"entity": string|null, "event_type": one of [' + eventTypesFor(section).join(', ') + ']';

  return `You are a legally-critical fact extractor for ${ekonomika ? 'an economics news desk' : 'a crypto news desk'}.
Output ONLY valid JSON, no prose, no code fences.
Schema: {${topFields}, "facts": [{"kind": ${kindsFor(desk)}, ${factFields}}]}
Rules:${desk ? analysisRule : NO_CAUSALITY_RULE}${ekonomika ? EKONOMIKA_RULES : ''}
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
- event_type="security": hacks, exploits, stolen funds, halted withdrawals,
  exploited vulnerabilities. Use it EVEN WHEN the affected company announces the
  incident itself — that is still a security event, not an "announcement".
- Do NOT invent sources, names, or URLs. Output no attribution fields.`;
};

// Exportované kvôli behu nasucho (scripts/dry-run-desk.mjs) — overenie
// extrakcie na reálnom článku bez zápisu do fronty. Rovnaký zámer ako
// dryRun v 08-proofreader.
export async function factsFromText(item, meta) {
  let text = [item.raw_data?.title, item.raw_data?.text].filter(Boolean).join('\n\n');
  if (!text) return { entity: meta.entity ?? null, event_type: 'other', source_emphasis: null, facts: [] };

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
      section: meta.section,
      system: extractSystem(meta.desk === true, meta.section),
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

  const pokus = parseModelJson(raw);
  if (!pokus.ok) {
    // Rozlíš urezanú odpoveď od skutočne pokazenej — inak sa príčina nedá dohľadať.
    const dovod = res.truncated
      ? `odpoveď urezaná aj pri ${EXTRACT_MAX_TOKENS * 2} tokenoch (zdroj je príliš dlhý)`
      : 'model nevrátil platný JSON';
    throw new Error(`Fact extractor returned non-JSON: ${dovod}: ${raw.slice(0, 200)}`);
  }
  const parsed = pokus.value;

  const event_type = eventTypesFor(meta.section).includes(parsed.event_type)
    ? parsed.event_type
    : 'other';
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
    // Ekonomika: obdobie, ktorého sa číslo TÝKA (nie dátum zverejnenia) a či je
    // číslo konečné. Ostatné sekcie tieto polia v prompte nemajú → ostanú null.
    period: typeof f.period === 'string' ? f.period.slice(0, 60) : null,
    status: FACT_STATUSES.includes(f.status) ? f.status : null,
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

  return {
    entity: parsed.entity ?? meta.entity ?? null,
    event_type,
    // Dôraz, ktorý urobil SÁM zdroj („rekord", „prvýkrát od 2020", „nečakane").
    // 06-chief-editor ho berie ako bonus k dôležitosti: bez toho by sa mesačný
    // CPI print, ktorý láme rekordy, skóroval rovnako ako ten úplne nudný.
    source_emphasis: typeof parsed.source_emphasis === 'string'
      ? parsed.source_emphasis.slice(0, 120)
      : null,
    facts: kept,
  };
}

// ---------- Spoluj fakty do finálneho facts JSON ----------
function buildFacts({ entity, event_type, facts, section, source_emphasis }) {
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
    source_emphasis: source_emphasis ?? null,
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
  let source_emphasis = null;

  // Layer A: čísla bez AI.
  if (rd.metrics && typeof rd.metrics === 'object') {
    collected.push(...factsFromMetrics(rd.metrics, meta));
  }

  // Layer B/C: text cez Haiku.
  if (rd.text || rd.title) {
    const fromText = await factsFromText(item, meta);
    entity = fromText.entity ?? entity;
    event_type = fromText.event_type;
    source_emphasis = fromText.source_emphasis ?? null;
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

  const facts = buildFacts({
    entity, event_type, facts: collected, section: meta.section, source_emphasis,
  });
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

// Vek, nad ktorým sa už extrakcia neoplatí — ZÁMERNE tá istá premenná, akú
// používa 07-writer na zahadzovanie zastaraných clusterov.
const MAX_AGE_H = Number(process.env.CLUSTERED_MAX_AGE_H ?? 24);

export async function runBatch(limit = CANDIDATE_POOL) {
  const aiEnabled = process.env.AI_ENABLED !== 'false';
  const items = await claim(STAGE.input, limit);

  // Zadarmo (Layer A, čísla) vs. platené (text cez Haiku).
  const zadarmo = items.filter((it) => (it.raw_data ?? {}).metrics);
  const platene = items.filter((it) => {
    const rd = it.raw_data ?? {};
    return !rd.metrics && (rd.text || rd.title);
  });

  // ŠKRT VEKU — nezaplať za extrakciu toho, čo Writer o krok neskôr zahodí.
  //
  // 07-writer zahadzuje clustery staršie než CLUSTERED_MAX_AGE_H. Tu žiadna
  // taká kontrola do 5. 9. 2026 nebola, takže sa Haiku platilo aj za položky
  // bez šance stať sa článkom. Naplno sa to ukázalo po dobití kreditu:
  // retry.js správne vrátil do hry 428 položiek z výpadku, z toho 360 starších
  // než 24 h — pri ~$0,007 za extrakciu vyše $2,4, teda tri celé denné
  // rozpočty za obsah, z ktorého by nevzniklo nič.
  //
  // Rovnaká premenná ako v 07 je zámer: dva prahy pre tú istú vec by sa časom
  // rozišli a nikto by nevedel, ktorý platí.
  //
  // Layer A (čísla) sa neškrtá — nestojí nič a scout ho vkladá čerstvý pri
  // každom behu.
  const now = Date.now();
  const cerstve = [];
  let zastarane = 0;
  for (const it of platene) {
    const vekH = (now - new Date(it.created_at).getTime()) / 3600000;
    if (vekH <= MAX_AGE_H) { cerstve.push(it); continue; }
    await advance(it.id, 'rejected', {
      error: `${AGENT}: zastarané — čakalo ${Math.round(vekH)} h vo fronte `
           + `(limit ${MAX_AGE_H} h), extrakcia by bola zbytočná`,
    });
    zastarane++;
  }

  // Zberový režim: platené necháme čakať, číselné spracujeme.
  const vybrane = aiEnabled
    ? cerstve
      .map((it) => ({ it, s: prescore(it.raw_data ?? {}).score }))
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX_EXTRACTIONS_PER_RUN)
      .map((x) => x.it)
    : [];

  const results = {
    ok: 0,
    failed: 0,
    // čakajú na ďalší beh (neminuli sme na ne nič)
    parked: cerstve.length - vybrane.length,
    zastarane,
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
