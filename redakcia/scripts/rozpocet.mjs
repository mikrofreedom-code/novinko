// ROZPOČET — čo pipeline reálne stojí a čo bude stáť pri aktuálnom nastavení.
//
//   node --env-file=.env scripts/rozpocet.mjs
//
// Jednotkové ceny sa NEBERÚ z cenníka, ale merajú z ai_cost_log — takže
// zohľadňujú skutočnú dĺžku promptov aj to, koľko toho modely vracajú.
// Nič nemení a nič nestojí.

import { db } from '../lib/_shared/queue.js';

const BEHOV_ZA_DEN = Number(process.env.BEHOV_ZA_DEN ?? 24);   // cron: 0 * * * *
const CAP_EXTRAKCII = Number(process.env.MAX_EXTRACTIONS_PER_RUN ?? 12);
const CAP_CLANKOV = Number(process.env.MAX_ARTICLES_TOTAL_PER_RUN ?? 3);
const ROZPOCET = Number(process.env.DAILY_BUDGET_USD ?? 3);

// Flux Schnell na Replicate. NEMERANÉ — Replicate nejde cez ai_cost_log,
// ktorý sleduje len Anthropic. Toto je cenníkový odhad, jediná neistá položka.
const CENA_OBRAZKA = Number(process.env.CENA_OBRAZKA_USD ?? 0.003);

const { data, error } = await db.from('ai_cost_log')
  .select('agent,cost_usd,created_at').order('created_at', { ascending: false }).limit(1000);
if (error) { console.error('chyba:', error.message); process.exit(1); }

const od = new Date(Math.min(...data.map((r) => +new Date(r.created_at))));
const po = new Date(Math.max(...data.map((r) => +new Date(r.created_at))));
const dni = (po - od) / 864e5;

const jednotka = (agent) => {
  const r = data.filter((x) => x.agent === agent);
  if (!r.length) return { n: 0, usd: 0, kus: 0 };
  const usd = r.reduce((s, x) => s + Number(x.cost_usd || 0), 0);
  return { n: r.length, usd, kus: usd / r.length };
};

const extrakcia = jednotka('05-verification');
const writer = jednotka('07-writer');
const korektor = jednotka('08-proofreader');
const imgPrompt = jednotka('11-image');

const eur = (n) => `$${n.toFixed(3)}`;

console.log(`\nNAMERANÉ (posledných ${data.length} volaní, ${dni.toFixed(1)} dňa)`);
console.log('─'.repeat(64));
console.log(`  extrakcia faktov (05)   ${String(extrakcia.n).padStart(4)}×   ${eur(extrakcia.kus)} / kus`);
console.log(`  napísanie článku (07)   ${String(writer.n).padStart(4)}×   ${eur(writer.kus)} / kus`);
console.log(`  korektúra (08)          ${String(korektor.n).padStart(4)}×   ${eur(korektor.kus)} / kus`);
console.log(`  prompt na obrázok (11)  ${String(imgPrompt.n).padStart(4)}×   ${eur(imgPrompt.kus)} / kus`);
console.log(`  právna kontrola (09)       —      zadarmo (bez AI)`);
console.log(`  obrázok Replicate          ?      ${eur(CENA_OBRAZKA)} / kus  ← ODHAD, nemeria sa`);

// Jeden hotový článok = writer + korektor + prompt + obrázok.
const naClanok = writer.kus + korektor.kus + imgPrompt.kus + CENA_OBRAZKA;
console.log(`\n  ⇒ jeden hotový článok: ${eur(naClanok)}`);

const skutocne = data.reduce((s, r) => s + Number(r.cost_usd || 0), 0) / dni;
console.log(`  ⇒ doterajšia skutočnosť: ${eur(skutocne)}/deň (bez Replicate)`);

console.log(`\nNASTAVENIE`);
console.log('─'.repeat(64));
console.log(`  behov za deň                ${BEHOV_ZA_DEN}   (cron 0 * * * *)`);
console.log(`  extrakcií na beh (strop)    ${CAP_EXTRAKCII}`);
console.log(`  článkov na beh (strop)      ${CAP_CLANKOV}`);
console.log(`  denný rozpočet              $${ROZPOCET.toFixed(2)}`);

const stropExtrakcie = CAP_EXTRAKCII * BEHOV_ZA_DEN * extrakcia.kus;
const stropClanky = CAP_CLANKOV * BEHOV_ZA_DEN * naClanok;
const stropSpolu = stropExtrakcie + stropClanky;

console.log(`\nHORNÝ STROP — keby sa KAŽDÝ beh naplnil na maximum`);
console.log('─'.repeat(64));
console.log(`  extrakcie   ${String(CAP_EXTRAKCII * BEHOV_ZA_DEN).padStart(4)}/deň   ${eur(stropExtrakcie).padStart(8)}`);
console.log(`  články      ${String(CAP_CLANKOV * BEHOV_ZA_DEN).padStart(4)}/deň   ${eur(stropClanky).padStart(8)}`);
console.log(`  ${'SPOLU'.padEnd(11)}            ${eur(stropSpolu).padStart(8)}/deň   =  $${(stropSpolu * 30).toFixed(2)}/mesiac`);
console.log(`  rozpočet ${ROZPOCET.toFixed(2)}/deň → ${stropSpolu <= ROZPOCET ? '✅ zmestí sa' : '❌ NEZMESTÍ SA'} `
  + `(využitie ${(stropSpolu / ROZPOCET * 100).toFixed(0)} %)`);

// Koľko extrakcií reálne prebehne za deň (nie strop, ale skutočnosť).
const extrakciiZaDen = extrakcia.n / dni;
const extrakcieDnes = extrakciiZaDen * extrakcia.kus;

console.log(`\nČO KTORÁ ÚROVEŇ STOJÍ`);
console.log('─'.repeat(78));
console.log('  Účet = články + extrakcia. Extrakcia je na počte článkov NEZÁVISLÁ,');
console.log(`  preto je v každom riadku rovnaká — nie je súčasťou ceny článku.`);
console.log(`    · dnešný objem: ${extrakciiZaDen.toFixed(0)} extrakcií/deň = ${eur(extrakcieDnes)}/deň`);
console.log(`    · strop:        ${CAP_EXTRAKCII * BEHOV_ZA_DEN} extrakcií/deň = ${eur(stropExtrakcie)}/deň\n`);
console.log('  článkov/h  článkov/deň   len články    + extrakcia dnes    + extrakcia na strope');
for (const n of [1, 2, 3, 4, 5, 6]) {
  const clanky = n * BEHOV_ZA_DEN * naClanok;
  const dnes = clanky + extrakcieDnes;
  const strop = clanky + stropExtrakcie;
  const znak = n === CAP_CLANKOV ? '  ← teraz' : '';
  console.log(
    `  ${String(n).padStart(7)}  ${String(n * BEHOV_ZA_DEN).padStart(11)}   ${eur(clanky).padStart(10)}`
    + `   ${(eur(dnes) + '/deň').padStart(16)}   ${(eur(strop) + '/deň').padStart(18)}${znak}`,
  );
}
console.log(`\n  mesačne pri ${CAP_CLANKOV} článkoch/h:  dnešný objem $${((CAP_CLANKOV * BEHOV_ZA_DEN * naClanok + extrakcieDnes) * 30).toFixed(2)}`
  + `   ·   strop $${((CAP_CLANKOV * BEHOV_ZA_DEN * naClanok + stropExtrakcie) * 30).toFixed(2)}`);

console.log(`\nPOZNÁMKA`);
console.log('─'.repeat(64));
console.log('  Strop nie je predpoveď. Článok vznikne, len keď je o čom písať —');
console.log('  doteraz to bolo ~4,5 článku DENNE, nie 72. Skutočnosť bude bližšie');
console.log('  k spodku tabuľky. Strop hovorí, čo sa stane v najhoršom prípade.');
console.log('  Jediná neistá položka je Replicate: nejde cez ai_cost_log, takže');
console.log(`  ${eur(CENA_OBRAZKA)}/obrázok je cenníkový odhad. Skutočnú sumu má Replicate`);
console.log('  v prehľade používania.\n');
