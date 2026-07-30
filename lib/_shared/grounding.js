// GROUNDING — overenie, že fakt sa naozaj opiera o zdrojový text.
// Software-first, bez AI. Princíp: KAŽDÉ číslo, ktoré fakt tvrdí, musí byť
// prítomné v zdrojovom texte. Ak nie → fakt si číslo pravdepodobne vymyslel.
//
// Toto chytá najnebezpečnejší typ halucinácie (vymyslená štatistika/dátum).
// Kvalitatívne fakty bez čísel sa neradno zahadzovať softvérom (parafráza je
// očakávaná) — na tie je miesto pre AI overenie (seam nižšie).

// Vytiahne čísla z textu. Normalizuje oddeľovače tisícov (67,230 → 67230).
export function extractNumbers(text) {
  if (!text) return [];
  const out = [];
  for (const m of String(text).match(/\d[\d,]*(?:\.\d+)?/g) ?? []) {
    const v = parseFloat(m.replace(/,/g, ''));
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

// Je číslo n prítomné v zozname zdrojových čísel (s toleranciou na zaokrúhlenie)?
export function numberGrounded(n, sourceNums) {
  const tol = Math.max(Math.abs(n) * 0.01, 0.05); // 1 % alebo 0.05 absolútne
  return sourceNums.some((s) => Math.abs(s - n) <= tol);
}

// Skontroluje jeden fakt voči zdrojovému textu.
// Vráti { grounded, ungrounded: number[] }.
export function checkFactGrounding(fact, sourceText) {
  const sourceNums = extractNumbers(sourceText);
  const factNums = [];
  if (typeof fact.value === 'number') factNums.push(fact.value);
  factNums.push(...extractNumbers(fact.statement ?? ''));
  factNums.push(...extractNumbers(fact.claim ?? ''));

  const ungrounded = factNums.filter((n) => !numberGrounded(n, sourceNums));
  return { grounded: ungrounded.length === 0, ungrounded };
}

// Vyfiltruje fakty: nechá len tie, ktorých čísla sú v zdroji.
// Vráti { kept: fact[], dropped: {fact, ungrounded}[] }.
export function groundFacts(facts, sourceText) {
  const kept = [];
  const dropped = [];
  for (const f of facts) {
    const r = checkFactGrounding(f, sourceText);
    if (r.grounded) kept.push(f);
    else dropped.push({ fact: f, ungrounded: r.ungrounded });
  }
  return { kept, dropped };
}

// Odignoruj interpunkciu (úvodzovky, čiarky...) a veľkosť písmen — model
// legitímne vynecháva okolité úvodzovky/čiarku pri extrakcii citátu.
function normalizeForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Je citát DOSLOVNE prítomný v zdrojovom texte (po normalizácii bielych znakov)?
// Prísnejšie než číselný grounding — vymyslený citát pripísaný niekomu je
// vážnejšie riziko (ohováranie/skreslenie) než zlé číslo.
export function quoteGrounded(quote, sourceText) {
  if (!quote) return false;
  return normalizeForMatch(sourceText).includes(normalizeForMatch(quote));
}
