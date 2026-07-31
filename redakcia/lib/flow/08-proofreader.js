// ============================================================
// 08. Proofreader
// ------------------------------------------------------------
// ROLA:          Kontrola kvality PRED obrázkom a publikovaním. Overí, že
//                článok netvrdí nič, čo nie je vo faktoch, nešpekuluje o
//                príčinách a drží spravodajský register.
// VSTUP status:  written
// VÝSTUP status: proofed
// STAV:          🟢 MVP
// AI vrstva:     2 Haiku (len pri článkoch od Writera; šablóny idú bez AI)
// ------------------------------------------------------------
// PREČO VZNIKOL (2026-07-31): reťaz 08-10 sa dovtedy preskakovala — 11-image
// čítal rovno 'written'. Nebežala teda ŽIADNA korektúra. V publikovanom
// market recape sa tým dostala von veta „...čo síce priamo krypto netanguje,
// no zvyšuje celkový technologický nepokoj" — príčinná súvislosť, ktorá vo
// faktoch nie je, plus hovorový register. Presne toto má tento krok chytiť.
//
// LEGÁLNA HRANICA: korektor vidí NÁŠ článok a NAŠE fakty. Zdrojový text
// nedostáva nikdy — rovnaká hranica ako u Writera (viď CLAUDE.md).
//
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

import { claim, advance } from '../_shared/queue.js';
import { askFull } from '../_shared/ai-gateway.js';
import { factsForPrompt } from './07-writer.js';

export const STAGE = {
  index: 8,
  name: "Proofreader",
  input: "written",
  output: "proofed",
};

const AGENT = '08-proofreader';

// Ak korektor vyškrtá toľko, že zostane menej než toto, článok nemá zmysel.
const MIN_WORDS_AFTER = Number(process.env.PROOF_MIN_WORDS ?? 40);

const PROOF_SYSTEM = `You are a strict Slovak news copy editor. You receive:
  (1) FACTS — the structured JSON the article was written from,
  (2) ARTICLE — headline, perex and body in Slovak.

Your ONLY job is to remove what the facts do not support and fix the register.
You must NOT add information, NOT enrich, NOT rewrite for style beyond the rules below.

Flag and FIX these, in this order of importance:

A) UNSUPPORTED CLAIM — any statement of fact not traceable to FACTS.
   Remove the sentence. Do not try to soften it.

B) SPECULATION / INVENTED CAUSALITY — sentences that guess motives, causes or
   market impact ("mohlo prispieť", "zvyšuje nervozitu", "investori zrejme",
   "to naznačuje", "v pozadí rezonovala"). Remove them, even if the underlying
   fact is real. Reporting a fact is allowed; explaining WHY it happened is not,
   unless FACTS say so explicitly.

C) OFF-TOPIC — content outside the article's section/entity that was pulled in
   as "context" without the facts linking it. Remove.

D) REGISTER — colloquialisms and diminutives that do not belong in news Slovak
   ("netanguje", "bodíky", "pecka", "šialene"). Replace with neutral wording.
   Keep the author's voice otherwise.

E) GRAMMAR / DIACRITICS — fix outright errors only.

Rules:
- Never invent replacement content. Deleting is always preferred to rewriting.
- Keep paragraph breaks as blank lines. Keep the article in Slovak.
- Do NOT use the double-quote character " anywhere inside JSON string values.
  For Slovak quotation use the low/high curly quotes instead.

Return ONLY valid JSON, no markdown fence:
{
  "verdict": "ok" | "fixed" | "reject",
  "issues": [{"type":"A|B|C|D|E","quote":"the offending fragment","action":"removed|reworded"}],
  "headline": "final headline",
  "perex": "final perex or null",
  "body": "final body with paragraphs separated by blank lines"
}

Use "reject" only when the article is so unsupported that almost nothing
survives. Use "ok" when you changed nothing.`;

function stripFences(s) {
  return String(s ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

const wordCount = (s) => String(s ?? '').trim().split(/\s+/).filter(Boolean).length;

// ---------- Spracuj JEDEN článok ----------
// dryRun: prebehne kontrolu a vráti výsledok, ale NEZAPÍŠE do fronty.
// Slúži na overenie nastavenia korektora na reálnych článkoch bez vedľajších účinkov.
export async function run(item, { dryRun = false } = {}) {
  const article = item.article;
  if (!article?.headline || !article?.body) {
    throw new Error('item.article chýba headline/body');
  }

  // ŠABLÓNY (cena, TVL, nálada) sa skladajú priamo z faktov — sú grounded
  // konštrukciou, netreba na ne platiť AI. "Software First, AI Second."
  if (article.generated_by === 'template') {
    const proofed = { ...article, proofread: { skipped: 'šablóna — grounded konštrukciou' } };
    if (!dryRun) await advance(item.id, STAGE.output, { article: proofed });
    return { verdict: 'ok', ai: false, issues: 0 };
  }

  const prompt = `FACTS:\n${factsForPrompt(item.facts ?? {})}\n\n`
    + `ARTICLE:\nHEADLINE: ${article.headline}\n`
    + `PEREX: ${article.perex ?? ''}\n`
    + `BODY:\n${article.body}`;

  const res = await askFull({
    tier: 'cheap',
    agent: AGENT,
    queueId: item.id,
    system: PROOF_SYSTEM,
    prompt,
    maxTokens: 3000,
    temperature: 0,
  });

  let parsed;
  try {
    parsed = JSON.parse(stripFences(res.text));
  } catch {
    const dovod = res.truncated ? 'odpoveď urezaná na limite tokenov' : 'model nevrátil platný JSON';
    throw new Error(`korektor: ${dovod}: ${res.text.slice(0, 200)}`);
  }

  const issues = Array.isArray(parsed.issues) ? parsed.issues : [];

  if (parsed.verdict === 'reject') {
    const dovody = issues.map((i) => `${i.type}: ${String(i.quote ?? '').slice(0, 60)}`).join(' | ');
    if (!dryRun) await advance(item.id, 'rejected', {
      error: `${AGENT}: zamietnuté korektorom — ${dovody || 'článok nie je podložený faktami'}`,
    });
    return { verdict: 'reject', ai: true, issues: issues.length, issueList: issues };
  }

  const body = String(parsed.body ?? '').trim();
  if (!parsed.headline || !body) throw new Error('korektor vrátil prázdny headline/body');

  // Poistka: ak škrtanie zožralo článok, nemá zmysel ho posielať ďalej.
  if (wordCount(body) < MIN_WORDS_AFTER) {
    if (!dryRun) await advance(item.id, 'rejected', {
      error: `${AGENT}: po vyškrtaní nepodložených tvrdení zostalo ${wordCount(body)} slov (< ${MIN_WORDS_AFTER})`,
    });
    return { verdict: 'reject', ai: true, issues: issues.length, issueList: issues };
  }

  const proofed = {
    ...article,
    headline: String(parsed.headline).trim(),
    perex: parsed.perex ? String(parsed.perex).trim() : null,
    body,
    word_count: wordCount(body),
    proofread: {
      verdict: parsed.verdict ?? 'fixed',
      issues,                                   // audit stopa: čo presne sa vyhodilo a prečo
      words_before: article.word_count ?? wordCount(article.body),
      words_after: wordCount(body),
      at: new Date().toISOString(),
    },
  };

  if (!dryRun) await advance(item.id, STAGE.output, { article: proofed });
  return { verdict: parsed.verdict ?? 'fixed', ai: true, issues: issues.length, issueList: issues, article: proofed };
}

// ---------- Dávka ----------
export async function runBatch(limit = 30) {
  // Zberový režim: nekontroluj, nechaj čakať (rovnako ako Writer a Image).
  if (process.env.AI_ENABLED === 'false') {
    const waiting = await claim(STAGE.input, limit);
    return { ok: 0, failed: 0, parked: waiting.length };
  }

  const items = await claim(STAGE.input, limit);
  const res = { ok: 0, opravene: 0, zamietnute: 0, failed: 0 };
  for (const item of items) {
    try {
      const r = await run(item);
      if (r.verdict === 'reject') res.zamietnute++;
      else { res.ok++; if (r.issues > 0) res.opravene++; }
    } catch (err) {
      res.failed++;
      // Technická chyba (AI výpadok) → 'error'; retry.js to vráti späť do 'written'.
      await advance(item.id, 'error', { error: `${AGENT}: ${err.message}` });
    }
  }
  return res;
}
