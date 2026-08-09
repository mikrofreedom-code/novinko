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
import { parseModelJson } from '../_shared/json.js';
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
   fact is real.

   EXCEPTION — ATTRIBUTED ANALYSIS. FACTS may contain entries with
   kind="analysis": a research desk's own explanation of why the market moved.
   A causal sentence is allowed if and only if BOTH hold:
     (a) it traces to such an analysis fact, AND
     (b) the text attributes it to that desk ("podľa {source_name}",
         "{source_name} to pripisuje…", "analytici {source_name} uvádzajú…").
   If (a) holds but the attribution is missing, do NOT delete the sentence —
   ADD the attribution and mark the issue "reworded". If the causal claim
   traces to nothing in FACTS, delete it as before.
   Causality without attribution must never survive. An analysis fact must
   never be presented as verified fact or as the newsroom's own conclusion.

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

  const opytajSa = (dodatok = '') => askFull({
    tier: 'cheap',
    agent: AGENT,
    queueId: item.id,
    system: PROOF_SYSTEM,
    prompt: prompt + dodatok,
    maxTokens: 3000,
    temperature: 0,
  });

  const skusParsovat = parseModelJson;

  // Parser hlási „position N" — ukáž kus textu OKOLO tej pozície. Bez toho sa
  // v 3000-znakovej odpovedi rozbitý znak hľadá naslepo.
  const okoloChyby = (pokus) => {
    const m = /position (\d+)/.exec(pokus.chyba ?? '');
    if (!m || !pokus.cistyText) return '';
    const p = Number(m[1]);
    return ` … OKOLO CHYBY >>>${pokus.cistyText.slice(Math.max(0, p - 120), p + 120)}<<<`;
  };

  // OPAKOVANIE PRI ROZBITOM JSON — rovnaký vzor ako vo Writerovi (07).
  //
  // Model si občas vloží rovnú úvodzovku " doprostred reťazca a rozbije tým
  // vlastný JSON, hoci mu to PROOF_SYSTEM výslovne zakazuje. Namerané
  // 9.8.2026: 15 takto stratených článkov za týždeň — a to sú články, za ktoré
  // sme UŽ zaplatili Sonneta (07) a ktoré by hneď za korektorom dostali aj
  // obrázok. Jedno lacné volanie Haiku navyše je proti tomu zanedbateľné.
  let res = await opytajSa();
  let pokus = skusParsovat(res.text);
  if (!pokus.ok && !res.truncated) {
    res = await opytajSa(
      '\n\n(Predošlý pokus vrátil nevalidný JSON — takmer isto kvôli znaku " vnútri'
      + ' niektorého reťazca. Nepouži znak " nikde okrem okrajov JSON reťazcov;'
      + ' pre slovenské úvodzovky použi „ a ".)',
    );
    pokus = skusParsovat(res.text);
  }

  if (!pokus.ok) {
    const dovod = res.truncated ? 'odpoveď urezaná na limite tokenov' : 'model nevrátil platný JSON ani po opakovaní';
    // Do hlášky patrí aj to, čo povedal PARSER, a KONIEC odpovede — nie len jej
    // začiatok. Prvých 200 znakov vyzerá pri každom páde rovnako („```json{…"),
    // takže sa z nich nedalo rozoznať useknutú odpoveď od rozbitých úvodzoviek
    // uprostred; 9.8.2026 to stálo jeden zbytočný diagnostický beh.
    throw new Error(
      `korektor: ${dovod} (${pokus.chyba})${okoloChyby(pokus)}`
      + ` … KONIEC ${res.text.slice(-150)}`,
    );
  }
  const parsed = pokus.value;

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
