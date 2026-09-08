// ============================================================
// 06. Chief Editor
// ------------------------------------------------------------
// ROLA:          Mozog redakcie. Zoskupí fakty o tej istej udalosti naprieč zdrojmi a rozhodne čo stojí za článok.
// VSTUP status:  facts_ready
// VÝSTUP status: clustered
// STAV:          🟢 LIVE (software brána + dávková AI redakčná porada pre Svet)
// AI vrstva:     0 software pre isté prípady, Haiku pre novosť a prioritu Sveta
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================
//
// TOK:
//   1. claim('facts_ready')
//   2. Fáza 1 — zoskup položky podľa entity + event_type (BEZ AI).
//   3. Pre každý cluster: zlúč facts[] do JEDNÉHO reprezentanta.
//   4. NEWSWORTHINESS BRÁNA (software): rozhodne, či cluster stojí za článok.
//        - neworthy → reprezentant 'clustered', ostatní 'merged'
//        - not worthy → všetci 'rejected' s dôvodom
//   5. Svet: jedna dávková AI porada posúdi novosť a redakčnú prioritu.
//
// Reprezentant clusteru = položka s najviac faktami; pri zhode najstaršia.
// ============================================================

import { claim, advance, db } from '../_shared/queue.js';
import { scoreImportance } from '../_shared/importance.js';
import { askFull } from '../_shared/ai-gateway.js';
import { parseModelJson } from '../_shared/json.js';
import {
  handledTopicKeys,
  loadRecentHandledTopicRows,
  manuallyRejectedTopicKeys,
  topicKey,
} from '../_shared/topic-dedup.js';
import {
  buildTriagePrompt,
  editorialOutcome,
  EDITORIAL_TRIAGE_SYSTEM,
  triageCandidate,
  triageRecentArticle,
  validateTriageDecisions,
} from '../_shared/editorial-triage.js';

export const STAGE = {
  index: 6,
  name: "Chief Editor",
  input: "facts_ready",
  output: "clustered",
};

const AGENT = '06-chief-editor';

// ---- VÝBER DÔLEŽITOSTI (importance scoring) ----
// Cluster sa napíše LEN ak jeho skóre >= IMPORTANCE_BAR. Inak sa zahodí
// (ani sa nenapíše → šetrí drahú AI). Logika skóre je v _shared/importance.js.
// Latku ľahko zmeníš v .env (IMPORTANCE_BAR): vyššia = menej, dôležitejších článkov.
const IMPORTANCE_BAR = Number(process.env.IMPORTANCE_BAR ?? 42);
const TOPIC_COOLDOWN_H = Number(process.env.TOPIC_COOLDOWN_H ?? 48);
const EDITORIAL_AI_ENABLED = process.env.CHIEF_EDITOR_AI_ENABLED !== 'false';
const EDITORIAL_AI_MAX_CANDIDATES = Number(process.env.CHIEF_EDITOR_AI_MAX_CANDIDATES ?? 8);

// ---- Fáza 1: zoskupenie ----
// Kľúč clusteru. Sekcia je súčasťou kľúča (nikdy nezlučuj naprieč deskami).
// Položka bez entity sa nedá zlúčiť → vlastný unikátny kľúč.
function clusterKey(item) {
  return topicKey(item.facts) ?? `__solo__:${item.id}`;
}

function groupByEvent(items) {
  const groups = new Map();
  for (const item of items) {
    const key = clusterKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

// ---- Výber reprezentanta: najviac faktov, pri zhode najstarší ----
function pickRepresentative(items) {
  return [...items].sort((a, b) => {
    const fa = a.facts?.facts?.length ?? 0;
    const fb = b.facts?.facts?.length ?? 0;
    if (fb !== fa) return fb - fa;
    return new Date(a.created_at ?? 0) - new Date(b.created_at ?? 0);
  })[0];
}

// ---- Zlúčenie facts[] z celého clusteru do jedného facts JSON ----
function mergeClusterFacts(items, rep) {
  const seen = new Set();
  const merged = [];
  for (const item of items) {
    for (const f of item.facts?.facts ?? []) {
      const k = `${f.claim}|${f.source_url}|${f.value}|${f.statement}`;
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(f);
    }
  }
  return {
    entity: rep.facts?.entity ?? null,
    event_type: rep.facts?.event_type ?? 'other',
    section: rep.facts?.section ?? 'krypto',
    lang_source: rep.facts?.lang_source ?? 'en',
    extracted_at: rep.facts?.extracted_at ?? new Date().toISOString(),
    clustered_at: new Date().toISOString(),
    source_count: new Set(merged.map((f) => f.source_url)).size,
    // POLIA POLOŽKY (nie faktu) — bez prenosu sa pri zlúčení TICHO stratia.
    //
    // source_emphasis: dôraz zdroja, z ktorého importance.js dáva +8. Do
    //   5. 9. 2026 sa tu zahadzoval, takže ten bonus v produkcii NIKDY
    //   nezafungoval — overené dátami: všetky klastre ekonomiky mali null,
    //   hoci položky vo facts_ready hodnotu niesli. Presne tá „dvojitá cesta
    //   k tomu istému", pred ktorou varuje CLAUDE.md.
    // location: dateline sekcie svet.
    //
    // Z klastra berieme prvú neprázdnu hodnotu — keď udalosť za rekord označí
    // čo i len jeden zdroj, pre skóre to stačí.
    source_emphasis: items.map((i) => i.facts?.source_emphasis).find(Boolean) ?? null,
    location: items.map((i) => i.facts?.location).find(Boolean) ?? null,
    // POZOR: musí sedieť s buildFacts() v 05-verification — zlučovanie clusteru
    // túto hodnotu prepočítava odznova, takže keby tu podmienka na 'analysis'
    // chýbala, výklad desku by po zlúčení stratil povinnú atribúciu a legálna
    // poistka vo Writerovi by sa nespustila. To isté platí pre claimed_by:
    // politické tvrdenie by po zlúčení prestalo vyžadovať „podľa X".
    attribution_required: merged.some(
      (f) => f.source_type === 'secondary' || f.kind === 'analysis' || f.claimed_by,
    ),
    facts: merged,
  };
}

// ---- EDITORIÁLNA POLITIKA: z čoho NEROBÍME samostatný článok ----
// Rozhodnutie 2026-07-31: čisté číselné pohyby sa nepublikujú ako samostatné
// správy. Boli repetitívne (v jednej fronte čakalo 2× „Cena Shiba Inu vzrástla
// o 15,2 %" a 2× „Index strachu a chamtivosti (25)") a neniesli žiadny kontext
// — len prečíslované to isté.
//
// Dáta sa ZBIERAJÚ ĎALEJ. Vstupujú do DENNÉHO PREHĽADU TRHU (13-market-recap),
// ktorý si ich ťahá priamo z CoinGecku/DefiLlamy/Fear&Greed a spracuje ich do
// jedného zmysluplného textu. Tento filter teda recap nijako neochudobní —
// gatherTodaysEvents() tieto typy zámerne ignoruje aj tak.
//
// VRÁTIŤ SPÄŤ: odober typ zo zoznamu nižšie alebo nastav NO_ARTICLE_EVENT_TYPES
// v .env. POZOR: šablóny na tieto typy boli zmazané, takže po znovuzapnutí ich
// bude písať Sonnet (drahšie) — vtedy zváž radšej vrátiť aj price-template.js.
const NO_ARTICLE_EVENT_TYPES = new Set(
  (process.env.NO_ARTICLE_EVENT_TYPES ?? 'price_move,tvl_shift,sentiment')
    .split(',').map((s) => s.trim()).filter(Boolean),
);

// ---- BRÁNA DÔLEŽITOSTI ----
// Vráti { worthy, score, reason }. Skóre 0-100 počíta _shared/importance.js
// (typ udalosti, veľkosť pohybu, kapitalizácia, likvidita, súbeh zdrojov).
//
// Hrubá software brána zostáva pred AI, aby sa neplatilo za zjavný šum.
function assessNewsworthiness(facts) {
  const { score, reasons } = scoreImportance(facts, facts.section ?? 'krypto');
  const rounded = Math.round(score);
  return {
    worthy: score >= IMPORTANCE_BAR,
    score: rounded,
    reason: `skóre ${rounded}/${IMPORTANCE_BAR} (${reasons.join('; ')})`,
  };
}

// Jedna dávková porada pre celý beh Sveta, nie jedno volanie na položku.
// Do modelu idú len fakty z 05 a titulky/perexy vlastných článkov. Pri chybe,
// neplatnom JSON alebo budget guarde sa vráti prázdna mapa a rozhodne software.
async function triageWorldGroups(groups, recentRows, manualTopics) {
  if (!EDITORIAL_AI_ENABLED || process.env.AI_ENABLED === 'false') return new Map();

  const candidates = [];
  for (const items of groups.values()) {
    const rep = pickRepresentative(items);
    const facts = mergeClusterFacts(items, rep);
    if (facts.section !== 'svet' || manualTopics.has(topicKey(facts))) continue;
    const gate = assessNewsworthiness(facts);
    if (!gate.worthy || NO_ARTICLE_EVENT_TYPES.has(facts.event_type ?? 'other')) continue;
    candidates.push({ item: rep, facts, gate });
  }
  candidates.sort((a, b) => b.gate.score - a.gate.score
    || new Date(b.item.created_at ?? 0) - new Date(a.item.created_at ?? 0));
  const selected = candidates.slice(0, Math.max(0, EDITORIAL_AI_MAX_CANDIDATES));
  if (!selected.length) return new Map();

  const aiCandidates = selected.map(({ item, facts, gate }) => triageCandidate(item, facts, gate.score));
  const context = recentRows
    .filter((row) => row.facts?.section === 'svet')
    .slice(0, 12)
    .map(triageRecentArticle);

  try {
    const res = await askFull({
      tier: 'cheap',
      section: 'svet',
      system: EDITORIAL_TRIAGE_SYSTEM,
      prompt: buildTriagePrompt(aiCandidates, context, TOPIC_COOLDOWN_H),
      agent: '06-chief-editor-ai',
      queueId: selected[0].item.id,
      maxTokens: 1200,
      temperature: 0,
    });
    const parsed = parseModelJson(res.text);
    if (res.truncated || !parsed.ok) {
      console.warn(`[${AGENT}] AI porada vrátila ${res.truncated ? 'urezanú' : 'neplatnú'} odpoveď — používam software`);
      return new Map();
    }
    return validateTriageDecisions(parsed.value, aiCandidates.map((item) => item.id));
  } catch (err) {
    console.warn(`[${AGENT}] AI porada zlyhala (${err.message}) — používam software`);
    return new Map();
  }
}

// ---- Spracuj jeden cluster (skupinu položiek o tej istej udalosti) ----
async function processCluster(items, { recentTopics = new Set(), manualTopics = new Set(), aiDecision } = {}) {
  const rep = pickRepresentative(items);
  const facts = mergeClusterFacts(items, rep);

  // Editoriálna politika ide PRED bránu dôležitosti: nemá zmysel počítať skóre
  // niečomu, čo aj tak nepublikujeme. Zároveň sa tým ušetrí Writer aj obrázok.
  const evt = facts.event_type ?? 'other';

  // VÝNIMKA S PODMIENKOU PODSTATY (2026-08-01)
  // Pohyb ceny sa nepublikuje ako holé číslo — to je dôvod, prečo je
  // 'price_move' na zozname vyššie a prečo tam ZOSTÁVA. Ale keď k pohybu máme
  // doložený VÝKLAD od research desku (fakty kind="analysis", vždy s
  // atribúciou), už to nie je prečíslované „BTC klesol o 3 %" — je to článok
  // „prečo BTC klesol", aký píše seriózny krypto denník.
  //
  // Latka je zámerne na dvoch výkladoch: jeden jediný by z toho spravil
  // tlmočenie názoru jednej burzy. Ladí sa cez MIN_ANALYSIS_FACTS.
  const MIN_ANALYSIS_FACTS = Number(process.env.MIN_ANALYSIS_FACTS ?? 2);
  const analysisFacts = (facts.facts ?? []).filter((f) => f.kind === 'analysis');
  const maVyklad = analysisFacts.length >= MIN_ANALYSIS_FACTS;

  if (NO_ARTICLE_EVENT_TYPES.has(evt) && !maVyklad) {
    for (const item of items) {
      await advance(item.id, 'rejected', {
        error: `${AGENT}: typ '${evt}' sa nepublikuje samostatne (dáta idú do denného prehľadu trhu)`,
      });
    }
    return { clustered: 0, merged: 0, rejected: items.length };
  }

  const gate = assessNewsworthiness(facts);

  if (!gate.worthy) {
    // Pod latkou dôležitosti → zahodíme (ani sa nenapíše), ale s dôvodom.
    for (const item of items) {
      await advance(item.id, 'rejected', { error: `${AGENT}: pod latkou — ${gate.reason}` });
    }
    return { clustered: 0, merged: 0, rejected: items.length };
  }

  const key = topicKey(facts);
  const outcome = editorialOutcome({
    decision: aiDecision,
    manualBlock: Boolean(key && manualTopics.has(key)),
    recentBlock: Boolean(key && recentTopics.has(key)),
    softwareScore: gate.score,
  });
  if (outcome.reject) {
    const reason = outcome.reject === 'manual-cooldown'
      ? `tematický cooldown po ručnom zamietnutí ${TOPIC_COOLDOWN_H} h`
      : outcome.reject === 'cooldown'
        ? `tematický cooldown ${TOPIC_COOLDOWN_H} h`
        : `AI ${aiDecision.decision} (${Math.round(aiDecision.confidence * 100)} %, ${aiDecision.reason})`;
    for (const item of items) {
      await advance(item.id, 'rejected', {
        error: `${AGENT}: ${reason} (${key ?? 'bez topic key'})`,
      });
    }
    return { clustered: 0, merged: 0, rejected: items.length };
  }

  if (aiDecision) {
    facts.editorial_ai = { ...aiDecision, assessed_at: new Date().toISOString() };
    // Software ostáva kotvou; AI mení poradie, ale jedným výstrelkom neprepíše
    // celé skóre. Rozhodnutia s nízkou istotou skóre nemenia.
    facts.importance = outcome.importance;
    if (outcome.cooldownOverride) facts.topic_cooldown_override = true;
  }

  const cluster_id = globalThis.crypto.randomUUID();
  facts.importance ??= gate.score; // ulož skóre dôležitosti pre prehľad/triedenie
  // Reprezentant nesie zlúčené fakty + cluster_id → ide na 'clustered' (vstup Writera).
  await advance(rep.id, STAGE.output, { facts, cluster_id });
  // Ostatní sú pohltení → terminálny stav 'merged' so spätným odkazom.
  let mergedCount = 0;
  for (const item of items) {
    if (item.id === rep.id) continue;
    await advance(item.id, 'merged', { cluster_id });
    mergedCount++;
  }
  return { clustered: 1, merged: mergedCount, rejected: 0 };
}

// ---- Dávkové spracovanie fronty v stave `facts_ready` ----
export async function runBatch(limit = 50) {
  const items = await claim(STAGE.input, limit);
  const groups = groupByEvent(items);
  const recentRows = await loadRecentHandledTopicRows(db, TOPIC_COOLDOWN_H);
  const recentTopics = handledTopicKeys(recentRows);
  const manualTopics = manuallyRejectedTopicKeys(recentRows);
  const aiDecisions = await triageWorldGroups(groups, recentRows, manualTopics);
  const totals = { clusters: 0, clustered: 0, merged: 0, rejected: 0, failed: 0, ai: aiDecisions.size };

  for (const group of groups.values()) {
    totals.clusters++;
    try {
      const rep = pickRepresentative(group);
      const r = await processCluster(group, {
        recentTopics,
        manualTopics,
        aiDecision: aiDecisions.get(rep.id),
      });
      totals.clustered += r.clustered;
      totals.merged += r.merged;
      totals.rejected += r.rejected;
    } catch (err) {
      totals.failed++;
      for (const item of group) {
        await advance(item.id, 'error', { error: `${AGENT}: ${err.message}` });
      }
    }
  }
  return totals;
}

// Pre rozhranie parity: spracuj jednu položku ako cluster veľkosti 1.
export async function run(item) {
  const recentRows = await loadRecentHandledTopicRows(db, TOPIC_COOLDOWN_H);
  return processCluster([item], {
    recentTopics: handledTopicKeys(recentRows),
    manualTopics: manuallyRejectedTopicKeys(recentRows),
  });
}
