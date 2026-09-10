// PLÁN TÉM — parser zdieľaný medzi 17-recepty.js a prípadnou budúcou kontrolou
// (rovnaký dôvod ako zahrada-plan.js: jeden parser, nie dva, ktoré sa časom rozídu).

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLAN_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../content/recepty/plan.md',
);

// Recepty na rozdiel od Záhrady necitujú externé inštitúcie (ÚKSÚP/SHMÚ) —
// register tu ostáva prázdny, ale existuje pre rovnaký tvar kódu/budúce
// použitie (napr. odkaz na potravinový register), nie preto, že sa dnes
// niečo doň zapisuje.
export const ZDROJE = {};

// ---------- Parser frontmatteru (identický formát ako zahrada-plan.js) ----------
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
      suvisi: f.suvisi ? f.suvisi.split(',').map((s) => s.trim()).filter(Boolean) : [],
      zdroje: f.zdroje ? f.zdroje.split(',').map((s) => s.trim()).filter(Boolean) : [],
      osnova,
    });
  }
  return temy;
}

// ---------- Je dátum v okne témy? (identické so zahrada-plan.js) ----------
export function jeVOkne(obdobie, date = new Date()) {
  const [od, doo] = obdobie.split(' .. ');
  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return od <= doo ? (mmdd >= od && mmdd <= doo) : (mmdd >= od || mmdd <= doo);
}

// Koľko dní ostáva do konca okna — tiebreak pri rovnakej priorite.
export function dniDoKoncaOkna(obdobie, date = new Date()) {
  const [, doo] = obdobie.split(' .. ');
  const [mm, dd] = doo.split('-').map(Number);
  let koniec = new Date(date.getFullYear(), mm - 1, dd);
  if (koniec < date) koniec = new Date(date.getFullYear() + 1, mm - 1, dd);
  return Math.round((koniec - date) / 86_400_000);
}
