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
import { liveFor, sectionDue } from '../sections/index.js';
import { roundRobinCap } from './07-writer.js';

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

const EVENT_TYPES_SVET = [
  'diplomacy',      // summity, rokovania, dohody, návštevy, prímeria
  'election',       // voľby, kampaň, výsledky, referendá
  'institutional',  // rozhodnutia OSN, NATO, EÚ, medzinárodných organizácií
  'sanctions',      // sankcie a ich rušenie
  'court_ruling',   // rozsudky, obžaloby, medzinárodné tribunály
  'protest',        // demonštrácie, štrajky, nepokoje
  'disaster',       // prírodné katastrofy, veľké nehody
  'conflict',       // boje, útoky, frontová línia — ZÁMERNE hlboko pod latkou,
                    // viď eventBase. Frontové spravodajstvo robí redakcia ručne.
  'regulatory', 'announcement', 'security', 'other',
];

const eventTypesFor = (section) => {
  if (section === 'ekonomika') return EVENT_TYPES_EKONOMIKA;
  if (section === 'svet') return EVENT_TYPES_SVET;
  return EVENT_TYPES_MARKET;
};

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

// Ekvivalent ANALYSIS_RULE pre svet. Výkladom tu nie je „prečo sa pohla cena"
// ani prognóza, ale „prečo to tá vláda urobila a čo to znamená".
const ANALYSIS_RULE_SVET = `
- kind="analysis" (ONLY for this source type): the outlet's or a NAMED expert's
  own reading — why an actor did something, what it signals, what may follow.
  Rephrase into a neutral claim (do NOT copy their sentences), max ~25 words.
  Extract these ONLY when the source actually argues it; never infer it yourself.
  Anything the outlet presents as its own interpretation belongs here, never in
  kind="fact".`;

// NO_CAUSALITY_RULE hovorí o cene, objeme a trhu — na správu o voľbách v Keni
// nesadne ani slovom. Toto je tá istá logika preložená do sveta: motív a zámer
// aktéra nie sú fakt. Výnimka ostáva rovnaká a je dôležitá — keď vláda sama
// povie, prečo niečo urobila, je to fakt, nie dohad.
const NO_CAUSALITY_RULE_SVET = `
- MOTIVE AND MEANING ARE NOT FACTS: never extract a statement that explains WHY
  a government, party, court or any actor did something ("the move was aimed at
  pressuring X", "in response to mounting criticism", "amid fears of unrest"),
  nor what an event signals or portends. That is interpretation, and this source
  is not authorised to carry it — drop such statements entirely, even when the
  source states them confidently. Extract only WHAT happened, WHO did it, WHEN
  and WHERE.
  EXCEPTION: an actor explaining its OWN action is a fact and stays ("the
  ministry said it closed the border because of the flooding").`;

// Pravidlá výhradne pre svet. Obe polia vznikli z konkrétnej požiadavky:
//
//   claimed_by — os fakt vs. tvrdenie. „Parlament schválil zákon" je fakt,
//                „minister tvrdí, že zákon zníži ceny" je tvrdenie. Model má
//                silný sklon podať druhé ako prvé, lebo zdroj to formuluje
//                oznamovacou vetou. Bez tohto poľa by Writer publikoval
//                politické tvrdenie ako overený fakt.
//   location   — dateline. „BRUSEL —" je to, čím sa zahraničná rubrika pozná
//                na prvý pohľad, a krajina je v každej svetovej správe.
const SVET_RULES = `
- "claimed_by": WHO ASSERTS IT. When the source attributes a statement to an
  interested party — a government, ministry, party, army, company or anyone with
  a stake in how it is understood — name that actor here ("Russian defence
  ministry", "the prime minister", "Kenya's electoral commission"). Set it to
  null ONLY when the source reports the thing as established rather than as
  somebody's claim.
  A POLITICAL CLAIM IS NEVER A BARE FACT: "parliament passed the law" is a fact
  (claimed_by null); "the minister says the law will cut prices" is a claim
  (claimed_by "the minister"). ALWAYS fill claimed_by for casualty and damage
  figures, territorial control, election results before official certification,
  and any number supplied by a party to a dispute.
- "location": the country, city or region where the event happened, exactly as
  the source gives it ("Kenya", "Brussels", "Gaza"). null if the item has no
  single place.
- HUMAN COST IS REPORTED, NOT DRAMATISED: extract casualty and damage figures
  plainly, with claimed_by set to whoever supplied them. Do not extract a
  source's emotive framing ("horrific scenes", "apocalyptic") — that is colour,
  not fact.`;

const extractSystem = (desk, section) => {
  const ekonomika = section === 'ekonomika';
  const svet = section === 'svet';
  // Každá sekcia si berie SVOJE pravidlá aj SVOJE polia — krypto/AI tak nenesú
  // ani jeden token navyše a ich prompt zostáva presne taký, aký bol.
  let analysisRule = ANALYSIS_RULE;
  let noCausalityRule = NO_CAUSALITY_RULE;
  let sectionRules = '';
  let desk_label = 'a crypto news desk';
  let extraFactFields = '';
  let extraTopFields = '';

  if (ekonomika) {
    analysisRule = ANALYSIS_RULE_EKONOMIKA;
    sectionRules = EKONOMIKA_RULES;
    desk_label = 'an economics news desk';
    extraFactFields = ', "period": string|null, "status": "final"|"preliminary"|"revised"|"forecast"|null';
    extraTopFields = ', "source_emphasis": string|null';
  } else if (svet) {
    analysisRule = ANALYSIS_RULE_SVET;
    noCausalityRule = NO_CAUSALITY_RULE_SVET;
    sectionRules = SVET_RULES;
    desk_label = 'a world news desk';
    extraFactFields = ', "claimed_by": string|null';
    extraTopFields = ', "location": string|null';
  }

  const factFields = '"statement": string, "quote_speaker": string|null, "value": number|null, "unit": string|null'
    + extraFactFields + ', "confidence": number';
  const topFields = '"entity": string|null, "event_type": one of ['
    + eventTypesFor(section).join(', ') + ']' + extraTopFields;

  return `You are a legally-critical fact extractor for ${desk_label}.
Output ONLY valid JSON, no prose, no code fences.
Schema: {${topFields}, "facts": [{"kind": ${kindsFor(desk)}, ${factFields}}]}
Rules:${desk ? analysisRule : noCausalityRule}${sectionRules}
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
  if (!text) return { entity: meta.entity ?? null, event_type: 'other', source_emphasis: null, location: null, facts: [] };

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
    // Svet: KTO to tvrdí, keď zdroj tvrdenie pripisuje zainteresovanej strane.
    // Vyplnené pole zapína attribution_required (viď buildFacts) — Writer teda
    // MUSÍ napísať „podľa X" a 09-legal ho bez toho zamietne.
    claimed_by: typeof f.claimed_by === 'string' && f.claimed_by.trim()
      ? f.claimed_by.slice(0, 120)
      : null,
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
    // Svet: dateline. „BRUSEL —" je to, čím sa zahraničná rubrika pozná na
    // prvý pohľad; krajina je pritom v každej svetovej správe.
    location: typeof parsed.location === 'string' && parsed.location.trim()
      ? parsed.location.slice(0, 80)
      : null,
    facts: kept,
  };
}

// ---------- Spoluj fakty do finálneho facts JSON ----------
function buildFacts({ entity, event_type, facts, section, source_emphasis, location }) {
  // Výklad desku sa BEZ atribúcie publikovať nesmie — je to ich názor, nie
  // overený fakt. Preto 'analysis' vynucuje „podľa X" rovnako ako sekundárny
  // zdroj; Writer bez nej neprejde (kontrola v 07-writer).
  //
  // claimed_by (svet) sa sem pripája ZÁMERNE, namiesto novej kontroly v 09:
  // politické tvrdenie má presne tú istú požiadavku ako výklad desku — musí
  // byť v texte vidieť, KTO to tvrdí. Reuse existujúcej brány, nie druhá vedľa.
  const attribution_required = facts.some(
    (f) => f.source_type === 'secondary' || f.kind === 'analysis' || f.claimed_by,
  );
  return {
    entity: entity ?? null,
    event_type: event_type ?? 'other',
    section: section ?? 'krypto',   // desk položky → 06 vyberie importance profil, 12 kategóriu
    lang_source: 'en',
    extracted_at: new Date().toISOString(),
    attribution_required,
    source_emphasis: source_emphasis ?? null,
    location: location ?? null,
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
  let location = null;

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
    location = fromText.location ?? null;
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
    entity, event_type, facts: collected, section: meta.section, source_emphasis, location,
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
  const textove = items.filter((it) => {
    const rd = it.raw_data ?? {};
    return !rd.metrics && (rd.text || rd.title);
  });

  // NEŽIVÉ SEKCIE NESÚŤAŽIA O EXTRAKCIU VÔBEC — čakajú netknuté v 'collected',
  // BEZ vekového škrtu nižšie (ten by ich nespravodlivo trestal za čas
  // strávený v pauze; keď sekcia dostane live: true, backlog má čistý štart).
  //
  // PREČO TOTO TREBA (nájdené 5. 9. na živých dátach): Ekonomika (4 zdroje)
  // a Svet (10 zdrojov) sú obe live: false, ale aj tak súťažili o tých istých
  // 12 extrakciách za hodinu ako krypto a AI. Za 24 h nazbierali 270 položiek
  // vo fronte a takmer úplne vytlačili krypto (4 collected) aj AI (10
  // collected, 0 ďalej) — teda dve JEDINÉ sekcie, ktoré vôbec môžu publikovať.
  // prescore.js je navyše naladený na krypto (SEC/ETF/hack…), takže krypto/AI
  // prehrávali aj vecne, nielen počtom. Dôsledok bol viditeľný až na webe:
  // MIN_SECTION_ITEMS poistka (netlify/lib/config.js) musela dopĺňať krypto/AI
  // takmer výhradne starými článkami, lebo nová produkcia takmer stála.
  //
  // ČIA JE TERAZ HODINA — rovnaká funkcia, akú už 01-scout používa na
  // rozhodnutie, ktorá sekcia sa má tento beh sťahovať (scoutEveryH/
  // scoutOffsetH v sections/index.js). Zámer rozvrhu z 5. 9. bol VÝHRADNOSŤ,
  // nie len rovnomerné sťahovanie: keď je hodina krypta, extrakcia sa má
  // venovať LEN krypto backlogu, nie sa naň nabaľovať s AI, ktoré práve
  // dorazilo z ich hodiny. Bez tohto by extrakcia bežala každú hodinu nad
  // VŠETKÝM naraz bez ohľadu na rozvrh — presne to, čo mal rozvrh predísť,
  // len o krok ďalej v reťazi.
  //
  // AND s liveFor(): sekcia musí byť aj živá aj práve na rade. Krypto a AI sa
  // dnes v rozvrhu nikdy neprekrývajú (krypto párne hodiny, AI 5/9/13/17/21),
  // takže bežný prípad je vždy PRESNE jedna živá sekcia za hodinu — nie
  // súťaž, žiadne predbiehanie. roundRobinCap nižšie je poistka pre výnimočný
  // prípad, keby sa neskôr (napr. po zapnutí Ekonomiky/Sveta) dve živé sekcie
  // predsa len stretli v tej istej hodine — vtedy sa aspoň spravodlivo delia,
  // namiesto aby krypto vyhrávalo vďaka širšiemu slovníku v prescore.js.
  const now = new Date();
  const platene = textove.filter((it) => {
    const sec = it.raw_data?.section ?? 'krypto';
    return liveFor(sec) && sectionDue(sec, now);
  });
  const neziva = textove.length - platene.length;

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
  const cerstve = [];
  let zastarane = 0;
  for (const it of platene) {
    const vekH = (now.getTime() - new Date(it.created_at).getTime()) / 3600000;
    if (vekH <= MAX_AGE_H) { cerstve.push(it); continue; }
    await advance(it.id, 'rejected', {
      error: `${AGENT}: zastarané — čakalo ${Math.round(vekH)} h vo fronte `
           + `(limit ${MAX_AGE_H} h), extrakcia by bola zbytočná`,
    });
    zastarane++;
  }

  // Zberový režim: platené necháme čakať, číselné spracujeme.
  //
  // `cerstve` v bežnom prípade obsahuje LEN JEDNU živú sekciu — tú, čo je
  // práve na rade (filter vyššie). roundRobinCap tu preto zvyčajne triedi
  // položky jednej jedinej sekcie podľa prescore, nič nestrieda.
  //
  // Je to napriek tomu roundRobinCap, nie plné triedenie+slice, ako POISTKA
  // pre výnimočný súbeh: keby sa neskôr (napr. po zapnutí Ekonomiky/Sveta)
  // dve živé sekcie stretli v tej istej hodine rozvrhu, mali by sa aspoň
  // spravodlivo striedať — bez toho by krypto vyhrávalo vďaka širšiemu
  // slovníku v prescore.js (SEC/ETF/hack/listing — štyri rôzne cesty
  // k bonusu, kým AI má jedinú, vzor „research"), nie vyššej skutočnej
  // hodnote. Overené poctivo premiešanou simuláciou (20× 30 krypto + 30 ai
  // kandidátov cez Fisher-Yates — netriedené dalo skreslených 9:3, po
  // premiešaní poctivých 55:45).
  const vybrane = aiEnabled
    ? roundRobinCap(
      cerstve,
      MAX_EXTRACTIONS_PER_RUN,
      (it) => it.raw_data?.section ?? 'krypto',
      (it) => prescore(it.raw_data ?? {}).score,
    )
    : [];

  // VZORKA PRE NEŽIVÉ SEKCIE — dopĺňa LEN nevyužitý zvyšok rozpočtu tohto
  // behu (`vybrane` nikdy nedostane menej než by malo, toto berie iba to, čo
  // by inak prepadlo). Bez tohto Ekonomika/Svet od zavedenia vyššieho filtra
  // (5. 9. 23:15, commit 357445b) nedostanú NIKDY ani jednu extrakciu navyše
  // — plán „obhliadnuť väčšiu vzorku faktov pred rozhodnutím o live: true"
  // (viď CLAUDE.md) by bol bez tohto mŕtvy, lebo fakty by sa už nehromadili.
  //
  // Zámerne BEZ vekového škrtu (MAX_AGE_H) — tie fakty nič nepublikuje Writer
  // bez ohľadu na vek, škrt vyššie rieši len zbytočné platenie za niečo, čo
  // by zahodil Writer, čo sa tu nedeje.
  //
  // Zámerne malý strop (default 2, nie MAX_EXTRACTIONS_PER_RUN) — toto je
  // prieskum, nie produkcia, a nesmie sa nabaľovať na krypto/AI rozpočet.
  // Poradie v `[...zadarmo, ...vybrane, ...vzorka]` nižšie navyše zaručuje,
  // že ak budget guard zastaví AI náklady uprostred behu, vzorka je na rade
  // posledná — živé sekcie majú vždy prednosť pred prieskumom.
  const NONLIVE_SAMPLE_CAP = Number(process.env.NONLIVE_SAMPLE_CAP ?? 2);
  const nezivePolozky = textove.filter((it) => !liveFor(it.raw_data?.section ?? 'krypto'));
  const volnyRozpocet = Math.max(0, MAX_EXTRACTIONS_PER_RUN - vybrane.length);
  const vzorka = aiEnabled && volnyRozpocet > 0
    ? roundRobinCap(
      nezivePolozky,
      Math.min(volnyRozpocet, NONLIVE_SAMPLE_CAP),
      (it) => it.raw_data?.section ?? 'krypto',
      (it) => prescore(it.raw_data ?? {}).score,
    )
    : [];

  const results = {
    ok: 0,
    failed: 0,
    // čakajú na ďalší beh (neminuli sme na ne nič)
    parked: cerstve.length - vybrane.length,
    zastarane,
    zadarmo: zadarmo.length,
    neziva: nezivePolozky.length - vzorka.length, // čaká na sekciu s live: true
    vzorka: vzorka.length, // prieskumná extrakcia neživej sekcie z voľného rozpočtu
  };

  for (const item of [...zadarmo, ...vybrane, ...vzorka]) {
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
