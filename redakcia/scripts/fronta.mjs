// NÁHĽAD NA FRONTU — čo čaká na drahú extrakciu a čo z toho pôjde na rad.
//
//   node --env-file=.env scripts/fronta.mjs
//
// Nič nemení a nič nestojí. Ukáže presne to poradie, v akom si položky vyberie
// 05-verification pri najbližšom behu — teda za čo sa zaplatí a čo počká.

import { db } from '../lib/_shared/queue.js';
import { prescore } from '../lib/_shared/prescore.js';

const CAP = Number(process.env.MAX_EXTRACTIONS_PER_RUN ?? 12);

const { data, error } = await db.from('queue')
  .select('id, raw_data, created_at')
  .eq('status', 'collected')
  .order('created_at', { ascending: true })
  .limit(Number(process.env.EXTRACTION_POOL ?? 200));
if (error) { console.error('chyba:', error.message); process.exit(1); }

const zadarmo = (data ?? []).filter((r) => (r.raw_data ?? {}).metrics);
const platene = (data ?? [])
  .filter((r) => { const rd = r.raw_data ?? {}; return !rd.metrics && (rd.text || rd.title); })
  .map((r) => ({ ...r, ...prescore(r.raw_data ?? {}) }))
  .sort((a, b) => b.score - a.score);

console.log(`\nv stave 'collected': ${data.length}  ·  zadarmo (čísla): ${zadarmo.length}  ·  platené (text): ${platene.length}`);
console.log(`strop na beh: ${CAP} platených extrakcií\n`);

const riadok = (r, i) => {
  const rd = r.raw_data ?? {};
  const vek = Math.round((Date.now() - new Date(r.created_at)) / 36e5);
  const znacka = rd.desk ? '🔎desk' : `      `;
  console.log(
    `${String(i + 1).padStart(3)}. ${String(r.score).padStart(3)}b ${znacka} `
    + `${String(rd.source_name ?? '?').slice(0, 20).padEnd(20)} ${vek}h  ${String(rd.title ?? '').slice(0, 62)}`,
  );
};

console.log('─── SPRACUJE SA V NAJBLIŽŠOM BEHU ───');
platene.slice(0, CAP).forEach(riadok);

const cakaju = platene.slice(CAP);
if (cakaju.length) {
  console.log(`\n─── POČKÁ (${cakaju.length}) ───`);
  cakaju.slice(0, 15).forEach((r, i) => riadok(r, i + CAP));
  if (cakaju.length > 15) console.log(`    …a ďalších ${cakaju.length - 15}`);
}

// Odhad, koľko by stálo spracovať všetko naraz — podľa reálneho priemeru
// z ai_cost_log, nie podľa cenníka.
const { data: ceny } = await db.from('ai_cost_log')
  .select('cost_usd').eq('agent', '05-verification').limit(500);
if (ceny?.length) {
  const priemer = ceny.reduce((s, r) => s + Number(r.cost_usd || 0), 0) / ceny.length;
  console.log(`\npriemerná cena extrakcie: $${priemer.toFixed(4)}`);
  console.log(`  tento beh:      $${(priemer * Math.min(CAP, platene.length)).toFixed(3)}`);
  console.log(`  bez stropu by:  $${(priemer * platene.length).toFixed(3)}`);
}
