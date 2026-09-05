// KONTROLA PLÁNU TÉM — rubrika Záhrada.
//
//   node scripts/plan-check.mjs
//
// PREČO: generátor berie raz denne tému, ktorá je práve „v okne". Keby na
// niektorý deň v roku nevyšla ani jedna, rubrika ten deň mlčí — a zistil by
// si to až tým, že článok nepríde. Tento skript to odhalí dopredu.
//
// Kontroluje:
//   1. každý deň roka má aspoň MIN_TEM tém v okne
//   2. každá oblasť (úžitková, okrasná, izbovky, trávnik, prehľad) je
//      zastúpená v každom mesiaci — inak sa rubrika v zime scvrkne na jednu tému
//   3. slugy sú jedinečné, formát období je platný
//   4. typ je vyplnený a platný — rozhoduje o štruktúre článku (kedy/ako/prečo
//      majú iný tvar, prehľad je mesačný súhrn)
//   5. suvisi odkazuje LEN na existujúce slugy — mŕtvy interný odkaz sa
//      inak zistí až na živom webe
//   6. zdroje odkazuje LEN na inštitúcie zo ZNÁMEHO zoznamu nižšie — ten je
//      jediné miesto, kde smie byť skutočná URL. Generátor si zdroj nesmie
//      vymyslieť, môže si len vybrať z tohto zoznamu podľa slugu v pláne.
//
// Nepotrebuje .env ani sieť, je to čisté čítanie súboru.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PLAN = path.join(path.dirname(fileURLToPath(import.meta.url)),
  '../content/zahrada/plan.md');
const MIN_TEM = 5;
const OBLASTI = ['uzitkova', 'okrasna', 'izbovky', 'travnik', 'prehlad'];
const TYPY = ['kedy', 'ako', 'preco', 'prehlad'];
const MESIACE = ['jan', 'feb', 'mar', 'apr', 'máj', 'jún',
                 'júl', 'aug', 'sep', 'okt', 'nov', 'dec'];

// JEDINÉ miesto, kde smie byť skutočná URL inštitúcie. Pole `zdroje` v pláne
// odkazuje sem KĽÚČOM (napr. `zdroje: uksup`), nikdy vlastným textom — inak by
// generátor mohol URL vymyslieť. Pridaj sem, keď treba nový zdroj; nepridávaj
// inštitúciu, ktorú si sám neoveril.
export const ZDROJE = {
  uksup: { nazov: 'Ústredný kontrolný a skúšobný ústav poľnohospodársky', url: 'https://www.uksup.sk/' },
  shmu: { nazov: 'Slovenský hydrometeorologický ústav', url: 'https://www.shmu.sk/' },
};

// ── načítanie ──
const text = readFileSync(PLAN, 'utf8');
const temy = [];
// Frontmatter bloky: --- \n kľúč: hodnota … \n --- \n osnova
for (const m of text.matchAll(/^---\n((?:[a-z]+:.*\n)+)---\n/gm)) {
  const f = {};
  for (const riadok of m[1].trim().split('\n')) {
    const i = riadok.indexOf(':');
    f[riadok.slice(0, i).trim()] = riadok.slice(i + 1).trim();
  }
  if (f.slug && f.obdobie && f.oblast) temy.push(f);
}

const chyby = [];
if (!temy.length) { console.error('❌ v pláne nie je ani jedna téma'); process.exit(1); }

// ── 3. formát a jedinečnosť (prvý prechod — nech je videne kompletná skôr,
//       než sa v ďalšom kroku validuje suvisi proti nej) ──
const videne = new Set();
for (const t of temy) {
  if (videne.has(t.slug)) chyby.push(`duplicitný slug: ${t.slug}`);
  videne.add(t.slug);
}
for (const t of temy) {
  if (!OBLASTI.includes(t.oblast)) chyby.push(`${t.slug}: neznáma oblasť „${t.oblast}"`);
  if (!/^\d{2}-\d{2} \.\. \d{2}-\d{2}$/.test(t.obdobie)) {
    chyby.push(`${t.slug}: zlý formát obdobia „${t.obdobie}"`);
  }
  if (!['1', '2', '3'].includes(t.priorita)) chyby.push(`${t.slug}: priorita musí byť 1–3`);

  // ── 4. typ ──
  if (!t.typ) chyby.push(`${t.slug}: chýba typ (kedy|ako|preco|prehlad)`);
  else if (!TYPY.includes(t.typ)) chyby.push(`${t.slug}: neznámy typ „${t.typ}"`);

  // ── 5. suvisi — odkazy musia existovať ──
  if (t.suvisi) {
    for (const s of t.suvisi.split(',').map((x) => x.trim()).filter(Boolean)) {
      if (!videne.has(s)) chyby.push(`${t.slug}: suvisi odkazuje na neexistujúci slug „${s}"`);
      if (s === t.slug) chyby.push(`${t.slug}: suvisi odkazuje sám na seba`);
    }
  }

  // ── 6. zdroje — len zo známeho zoznamu ──
  if (t.zdroje) {
    for (const z of t.zdroje.split(',').map((x) => x.trim()).filter(Boolean)) {
      if (!ZDROJE[z]) chyby.push(`${t.slug}: zdroje odkazuje na neznámy kľúč „${z}" — pridaj ho do ZDROJE v tomto skripte, nie priamo do plánu`);
    }
  }
}

// ── deň v roku (nepriestupný, stačí na kontrolu okien) ──
const DNI = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const doDna = (mm, dd) => DNI.slice(0, mm - 1).reduce((a, b) => a + b, 0) + dd;
const ROK = 365;

function vOkne(obdobie) {
  const [a, b] = obdobie.split(' .. ');
  const od = doDna(...a.split('-').map(Number));
  const doo = doDna(...b.split('-').map(Number));
  // Okno smie prechádzať cez Nový rok (napr. 11-25 .. 01-10).
  return (den) => (od <= doo ? den >= od && den <= doo : den >= od || den <= doo);
}
const testy = temy.map((t) => ({ ...t, test: vOkne(t.obdobie) }));

// ── 1. pokrytie po dňoch ──
const poDnoch = [];
for (let d = 1; d <= ROK; d++) poDnoch.push(testy.filter((t) => t.test(d)).length);
const minimum = Math.min(...poDnoch);
const slabe = poDnoch.map((n, i) => [i + 1, n]).filter(([, n]) => n < MIN_TEM);

// ── 2. pokrytie oblastí po mesiacoch ──
const stred = MESIACE.map((_, m) => doDna(m + 1, 15));
const diery = [];
for (const [m, den] of stred.entries()) {
  for (const o of OBLASTI) {
    if (!testy.some((t) => t.oblast === o && t.test(den))) diery.push(`${MESIACE[m]}: ${o}`);
  }
}

// ── výpis ──
console.log(`\nplán: ${temy.length} tém`);
const podlaObl = {};
for (const t of temy) podlaObl[t.oblast] = (podlaObl[t.oblast] ?? 0) + 1;
for (const o of OBLASTI) console.log(`   ${o.padEnd(10)} ${String(podlaObl[o] ?? 0).padStart(3)}`);

const podlaTypu = {};
for (const t of temy) podlaTypu[t.typ] = (podlaTypu[t.typ] ?? 0) + 1;
console.log('\npodľa typu:');
for (const ty of TYPY) console.log(`   ${ty.padEnd(10)} ${String(podlaTypu[ty] ?? 0).padStart(3)}`);

console.log('\npočet tém v okne, po mesiacoch (k 15. dňu):');
console.log('   ' + MESIACE.map((x) => x.padStart(4)).join(''));
console.log('   ' + stred.map((d) => String(poDnoch[d - 1]).padStart(4)).join(''));

console.log(`\nnajslabší deň roka: ${minimum} tém  (minimum je ${MIN_TEM})`);

if (slabe.length) {
  chyby.push(`${slabe.length} dní má menej než ${MIN_TEM} tém v okne`);
  const ukazka = slabe.slice(0, 5).map(([d, n]) => `deň ${d}: ${n}`).join(', ');
  console.log(`   ⚠️ ${ukazka}${slabe.length > 5 ? ' …' : ''}`);
}
if (diery.length) {
  chyby.push(`${diery.length} kombinácií mesiac × oblasť nemá tému`);
  console.log('\nchýbajúce oblasti v mesiaci:');
  for (const d of diery) console.log(`   ⚠️ ${d}`);
}

if (chyby.length) {
  console.log('\n❌ NÁJDENÉ PROBLÉMY:');
  for (const c of chyby) console.log(`   • ${c}`);
  process.exit(1);
}
console.log('\n✅ plán je v poriadku — každý deň roka má z čoho vyberať\n');
