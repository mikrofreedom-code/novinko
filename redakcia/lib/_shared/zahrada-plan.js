// PLÁN TÉM — parser + registre zdieľané medzi plan-check.mjs a 15-zahrada.js.
//
// PREČO ZDIEĽANÉ: dva parsery toho istého frontmatteru by boli presne tá
// „dvojitá cesta k tomu istému", pred ktorou varuje CLAUDE.md — zmena
// formátu v jednom by potichu rozišla kontrolu od generátora.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLAN_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../content/zahrada/plan.md',
);

// JEDINÉ miesto, kde smie byť skutočná URL inštitúcie. Pole `zdroje` v pláne
// odkazuje sem KĽÚČOM (napr. `zdroje: uksup`), nikdy vlastným textom —
// generátor tak nemôže URL vymyslieť, len si vybrať z tohto zoznamu.
export const ZDROJE = {
  uksup: { nazov: 'Ústredný kontrolný a skúšobný ústav poľnohospodársky', url: 'https://www.uksup.sk/' },
  shmu: { nazov: 'Slovenský hydrometeorologický ústav', url: 'https://www.shmu.sk/' },
};

// ---------- Parser frontmatteru ----------
// Frontmatter bloky: --- \n kľúč: hodnota … \n --- \n osnova (do ďalšieho
// --- bloku alebo HTML komentára nadpisu sekcie).
export function loadPlan(planPath = PLAN_PATH) {
  const text = readFileSync(planPath, 'utf8');
  const matches = [...text.matchAll(/^---\n((?:[a-z]+:[^\n]*\n)+)---\n/gm)];
  const temy = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const f = {};
    for (const riadok of m[1].trim().split('\n')) {
      const idx = riadok.indexOf(':');
      f[riadok.slice(0, idx).trim()] = riadok.slice(idx + 1).trim();
    }
    if (!f.slug || !f.obdobie || !f.oblast) continue;
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const osnova = text.slice(start, end).split(/\n<!--/)[0].trim();
    temy.push({
      slug: f.slug,
      obdobie: f.obdobie,
      oblast: f.oblast,
      priorita: Number(f.priorita) || 3,
      typ: f.typ ?? null,
      suvisi: f.suvisi ? f.suvisi.split(',').map((s) => s.trim()).filter(Boolean) : [],
      zdroje: f.zdroje ? f.zdroje.split(',').map((s) => s.trim()).filter(Boolean) : [],
      osnova,
    });
  }
  return temy;
}

// ---------- Je dátum v okne témy? ----------
// Reálny dátum (nie deň-v-roku ako v plan-check.mjs — ten skenuje celý rok
// naraz, toto sa pýta na JEDEN konkrétny deň). MM-DD reťazce sa dajú
// porovnávať priamo ako text — kalendárne poradie sedí aj lexikálne.
export function jeVOkne(obdobie, date = new Date()) {
  const [od, doo] = obdobie.split(' .. ');
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return od <= doo ? (mmdd >= od && mmdd <= doo) : (mmdd >= od || mmdd <= doo);
}

// Koľko dní ostáva do konca okna od `date` (okno môže prechádzať cez Nový rok
// — vtedy sa koniec posunie do budúceho roka). Používa sa na tiebreak pri
// rovnakej priorite: nech sa nepremešká téma s úzkym oknom.
export function dniDoKoncaOkna(obdobie, date = new Date()) {
  const [, doo] = obdobie.split(' .. ');
  const [mm, dd] = doo.split('-').map(Number);
  let koniec = new Date(date.getFullYear(), mm - 1, dd);
  if (koniec < date) koniec = new Date(date.getFullYear() + 1, mm - 1, dd);
  return Math.round((koniec - date) / 86_400_000);
}
