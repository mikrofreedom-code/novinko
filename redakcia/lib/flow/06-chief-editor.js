// ============================================================
// 06. Chief Editor
// ------------------------------------------------------------
// ROLA:          Mozog redakcie. Zoskupí fakty o tej istej udalosti naprieč zdrojmi a rozhodne čo stojí za článok.
// VSTUP status:  facts_ready
// VÝSTUP status: clustered
// STAV:          🟢 MVP (clustering + newsworthiness brána; AI Fáza 2 odložená)
// AI vrstva:     0 zatiaľ (software-first). Fáza 2 = Haiku, až po reálnych dátach.
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
//   5. (Fáza 2, ODLOŽENÉ) AI eskalácia pre hraničné prípady — pozri TODO nižšie.
//
// Reprezentant clusteru = položka s najviac faktami; pri zhode najstaršia.
// ============================================================

import { claim, advance } from '../_shared/queue.js';
import { scoreImportance } from '../_shared/importance.js';

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

// ---- Fáza 1: zoskupenie ----
function normEntity(e) {
  return (e ?? '').toString().trim().toLowerCase();
}

// Kľúč clusteru. Sekcia je súčasťou kľúča (nikdy nezlučuj naprieč deskami).
// Položka bez entity sa nedá zlúčiť → vlastný unikátny kľúč.
function clusterKey(item) {
  const sec = item.facts?.section ?? 'krypto';
  const ent = normEntity(item.facts?.entity);
  const evt = item.facts?.event_type ?? 'other';
  return ent ? `${sec}|${ent}|${evt}` : `__solo__:${item.id}`;
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
    attribution_required: merged.some((f) => f.source_type === 'secondary'),
    facts: merged,
  };
}

// ---- BRÁNA DÔLEŽITOSTI ----
// Vráti { worthy, score, reason }. Skóre 0-100 počíta _shared/importance.js
// (typ udalosti, veľkosť pohybu, kapitalizácia, likvidita, súbeh zdrojov).
//
// TODO (Fáza 2, voliteľné): hraničné prípady (skóre tesne pod latkou) by sa
// dali poslať na Haiku, nech model posúdi dôležitosť. Sem patrí to volanie.
function assessNewsworthiness(facts) {
  const { score, reasons } = scoreImportance(facts, facts.section ?? 'krypto');
  const rounded = Math.round(score);
  return {
    worthy: score >= IMPORTANCE_BAR,
    score: rounded,
    reason: `skóre ${rounded}/${IMPORTANCE_BAR} (${reasons.join('; ')})`,
  };
}

// ---- Spracuj jeden cluster (skupinu položiek o tej istej udalosti) ----
async function processCluster(items) {
  const rep = pickRepresentative(items);
  const facts = mergeClusterFacts(items, rep);
  const gate = assessNewsworthiness(facts);

  if (!gate.worthy) {
    // Pod latkou dôležitosti → zahodíme (ani sa nenapíše), ale s dôvodom.
    for (const item of items) {
      await advance(item.id, 'rejected', { error: `${AGENT}: pod latkou — ${gate.reason}` });
    }
    return { clustered: 0, merged: 0, rejected: items.length };
  }

  const cluster_id = globalThis.crypto.randomUUID();
  facts.importance = gate.score; // ulož skóre dôležitosti pre prehľad/triedenie
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
  const totals = { clusters: 0, clustered: 0, merged: 0, rejected: 0, failed: 0 };

  for (const group of groups.values()) {
    totals.clusters++;
    try {
      const r = await processCluster(group);
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
  return processCluster([item]);
}
