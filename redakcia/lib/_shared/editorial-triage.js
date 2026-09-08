// Pure helpers for the batched AI editorial meeting in 06-chief-editor.
// Keeping prompt construction and validation free of DB/provider imports makes
// the safety rules testable without credentials or paid calls.

export const EDITORIAL_TRIAGE_SYSTEM = `Si hlavný editor zahraničnej rubriky slovenského spravodajského webu.
Dostaneš kandidátov vytvorených VÝHRADNE zo štruktúrovaných faktov a nedávne články redakcie.
Posúď novosť a redakčnú hodnotu, nie politické sympatie. Nevymýšľaj žiadne fakty.

Pre každého kandidáta vráť presne jedno rozhodnutie:
- "duplicate": rovnaká jadrová udalosť ako nedávny článok; iný zdroj, titulok, reakcia alebo komentár sám osebe nie je nový vývoj,
- "update": tá istá téma, ale pribudol podstatný potvrdený vývoj (konečný výsledok, rozhodnutie, zásadný následok),
- "new": samostatná nová udalosť,
- "skip": síce nová, ale pre všeobecnú zahraničnú rubriku je okrajová, lokálna alebo bez širšieho významu.

priority je 0–100 podľa významu pre slovenského všeobecného čitateľa:
90–100 mimoriadna globálna udalosť; 70–89 veľká medzinárodná správa; 50–69 hodnotná bežná správa; pod 50 nízka priorita.
confidence je 0–1. Buď konzervatívny: pri pochybnosti zvoľ "new" s nižšou confidence.
reason musí mať najviac 12 slov.
Výstup je IBA validný JSON:
{"decisions":[{"id":"...","decision":"duplicate|update|new|skip","priority":0,"confidence":0,"reason":"stručne"}]}`;

const clipped = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export function triageCandidate(item, facts, softwareScore) {
  return {
    id: item.id,
    entity: clipped(facts?.entity, 120),
    event_type: clipped(facts?.event_type, 60),
    location: clipped(facts?.location, 120),
    software_score: softwareScore,
    facts: (facts?.facts ?? []).slice(0, 10).map((fact) => clipped(
      fact.statement ?? `${fact.claim ?? ''}: ${fact.value ?? ''} ${fact.unit ?? ''}`,
      260,
    )).filter(Boolean),
  };
}

export function triageRecentArticle(row) {
  return {
    headline: clipped(row?.article?.headline, 180),
    perex: clipped(row?.article?.perex, 320),
    entity: clipped(row?.facts?.entity, 120),
    event_type: clipped(row?.facts?.event_type, 60),
    location: clipped(row?.facts?.location, 120),
    status: row?.status,
  };
}

export function buildTriagePrompt(candidates, recentRows, recentHours = 48) {
  return `KANDIDÁTI:\n${JSON.stringify(candidates)}\n\nNEDÁVNE ČLÁNKY (posledných ${recentHours} h):\n${JSON.stringify(recentRows)}`;
}

export function validateTriageDecisions(value, candidateIds) {
  const allowed = new Set(['duplicate', 'update', 'new', 'skip']);
  const ids = new Set(candidateIds);
  const out = new Map();
  for (const row of value?.decisions ?? []) {
    if (!ids.has(row?.id) || !allowed.has(row?.decision) || out.has(row.id)) continue;
    const priority = Number(row.priority);
    const confidence = Number(row.confidence);
    if (!Number.isFinite(priority) || !Number.isFinite(confidence)) continue;
    out.set(row.id, {
      decision: row.decision,
      priority: Math.round(Math.max(0, Math.min(100, priority))),
      confidence: Math.max(0, Math.min(1, confidence)),
      reason: clipped(row.reason, 240),
    });
  }
  return out;
}

export function editorialOutcome({ decision, manualBlock, recentBlock, softwareScore }) {
  if (manualBlock) return { reject: 'manual-cooldown', importance: softwareScore, cooldownOverride: false };
  const confidentDuplicate = decision?.decision === 'duplicate' && decision.confidence >= 0.8;
  const confidentSkip = decision?.decision === 'skip' && decision.confidence >= 0.85;
  const confidentUpdate = decision?.decision === 'update' && decision.confidence >= 0.8;
  if (confidentDuplicate) return { reject: 'duplicate', importance: softwareScore, cooldownOverride: false };
  if (confidentSkip) return { reject: 'skip', importance: softwareScore, cooldownOverride: false };
  if (recentBlock && !confidentUpdate) return { reject: 'cooldown', importance: softwareScore, cooldownOverride: false };

  const aiCanRank = ['new', 'update'].includes(decision?.decision) && decision.confidence >= 0.6;
  const importance = aiCanRank
    ? Math.round(softwareScore * 0.35 + decision.priority * 0.65)
    : softwareScore;
  return { reject: null, importance, cooldownOverride: confidentUpdate };
}
