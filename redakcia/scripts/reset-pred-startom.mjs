// ============================================================
// RESET PRED OSTRÝM ŠTARTOM  (jednorazový, 2026-08-10)
// ------------------------------------------------------------
// Zmaže obsah, ktorý vyrobila TESTOVACIA verzia, aby archív začal od nuly.
//
//   node --env-file=.env scripts/reset-pred-startom.mjs           # NASUCHO (nič nezmaže)
//   node --env-file=.env scripts/reset-pred-startom.mjs --apply   # OSTRO
//
// ČO MAŽE:
//   1. Google Sheet 'articles' — všetky články OKREM kategórie krypto-skola
//   2. Obrázky v Supabase storage — krypto/ a ai/, OKREM evergreen-* (Krypto škola)
//   3. Frontu — hotové a rozpracované články z testovacieho obdobia
//
// ČO ZÁMERNE NEMAŽE A PREČO:
//   • PAMÄŤ DUPLICÍT vo fronte (statusy published/rejected/merged/error).
//     02-event-gateway podľa nej pozná, čo už raz prešlo (alreadyAdmitted).
//     Keby sme frontu vyprázdnili, feedy sa re-listujú až FEED_MAX_AGE_DAYS
//     dozadu a systém by hneď v prvý deň znovu pokryl staré správy. Preto sa
//     rozpracované položky prepínajú na 'merged' (terminálny stav MIMO
//     raw/rejected/error → v pamäti duplicít zostáva) a nie na 'rejected'.
//   • Cudzie súbory v koreni bucketu a priečinok test/ — nepatria k článkom,
//     len ich vypíše. Nemažem naslepo, čo som nevytvoril.
//
// ČO SA RESETOVAŤ NEDÁ (rieš ručne):
//   • Telegram kanál — ID rozposlaných správ sa neukladajú a Bot API nevie
//     čítať históriu kanála. Len ručne v appke, alebo založiť kanál nanovo.
//   • Google index — odkazy /clanok.html?id=… môžu ostať v indexe a po
//     zmazaní budú prázdne.
//   • Generátory Svet/Šport na Netlify — vypína sa zakomentovaním schedule
//     v koreňovom netlify.toml (potrebuje commit + push + deploy).
// ============================================================

import { writeFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { getAccessToken } from '../lib/_shared/sheets.js';
import { db } from '../lib/_shared/queue.js';

const APPLY = process.argv.includes('--apply');
const SHEET = 'articles';
const NECHAJ_KATEGORIU = 'krypto-skola';
const NECHAJ_OBRAZOK = 'evergreen-';          // prefix obrázkov Krypto školy
const BUCKET = process.env.SUPABASE_BUCKET ?? 'article-images';

// Rozpracované/hotové články z testovacieho obdobia → 'merged' (viď hlavička).
const ROZPRACOVANE = ['written', 'proofed', 'legal_ok', 'seo_done', 'imaged'];

const nadpis = (s) => console.log(`\n\x1b[36m${s}\x1b[0m`);
const rezim = APPLY ? '\x1b[31mOSTRO — MAŽEM\x1b[0m' : '\x1b[33mNASUCHO — nič sa nezmaže (--apply spustí ostro)\x1b[0m';

// ---------- CSV ----------
const csvPole = (v) => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const doCsv = (riadky) => riadky.map((r) => r.map(csvPole).join(',')).join('\n');

async function main() {
  console.log(`\nRESET PRED ŠTARTOM — režim: ${rezim}`);

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  const zalohaDir = new URL(`../zaloha/${stamp}/`, import.meta.url).pathname;

  // ============ 1. SHEET ============
  nadpis('1) Google Sheet — načítavam a zálohujem');
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  const token = await getAccessToken();
  const auth = { Authorization: `Bearer ${token}` };

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET}!A:Z`,
    { headers: auth },
  );
  const vals = (await res.json()).values ?? [];
  if (!vals.length) throw new Error(`hárok ${SHEET} je prázdny alebo sa nedá čítať`);

  const hlavicka = vals[0];
  const iKat = hlavicka.indexOf('category');
  if (iKat === -1) throw new Error(`v hlavičke chýba stĺpec "category": ${hlavicka.join(',')}`);
  const telo = vals.slice(1);
  const nechat = telo.filter((r) => (r[iKat] ?? '').trim() === NECHAJ_KATEGORIU);
  const zmazat = telo.length - nechat.length;

  // Záloha VŽDY — aj nasucho, nech si ju vieš pozrieť dopredu.
  mkdirSync(zalohaDir, { recursive: true });
  writeFileSync(`${zalohaDir}articles.csv`, doCsv(vals), 'utf8');
  console.log(`   článkov v hárku: ${telo.length}`);
  console.log(`   ostane (${NECHAJ_KATEGORIU}): ${nechat.length}`);
  console.log(`   NA ZMAZANIE: ${zmazat}`);
  console.log(`   záloha → ${zalohaDir}articles.csv`);

  if (APPLY) {
    // Prepis namiesto 1284 mazacích requestov: vyčisti a zapíš späť to, čo ostáva.
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET}!A:Z:clear`,
      { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}' });
    const zapis = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET}!A1?valueInputOption=RAW`,
      { method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [hlavicka, ...nechat] }) },
    );
    const vysledok = await zapis.json();
    if (vysledok.error) throw new Error(`zápis späť zlyhal: ${JSON.stringify(vysledok.error)}`);
    console.log(`   ✓ hárok prepísaný — ostalo ${nechat.length} článkov + hlavička`);
  }

  // ============ 2. OBRÁZKY ============
  nadpis('2) Obrázky v Supabase storage');
  const sb = createClient(process.env.IMAGE_SUPABASE_URL, process.env.IMAGE_SUPABASE_KEY);
  let zmazanychObr = 0;

  for (const priecinok of ['krypto', 'ai']) {
    const { data, error } = await sb.storage.from(BUCKET).list(priecinok, { limit: 1000 });
    if (error) { console.log(`   ${priecinok}/ → chyba: ${error.message}`); continue; }
    const subory = (data ?? []).filter((f) => f.id);                       // nie podpriečinky
    const chranene = subory.filter((f) => f.name.startsWith(NECHAJ_OBRAZOK));
    const naZmazanie = subory.filter((f) => !f.name.startsWith(NECHAJ_OBRAZOK));
    console.log(`   ${priecinok}/: spolu ${subory.length} · chránené (${NECHAJ_OBRAZOK}*) ${chranene.length} · na zmazanie ${naZmazanie.length}`);

    if (APPLY && naZmazanie.length) {
      for (let i = 0; i < naZmazanie.length; i += 100) {
        const davka = naZmazanie.slice(i, i + 100).map((f) => `${priecinok}/${f.name}`);
        const { error: e } = await sb.storage.from(BUCKET).remove(davka);
        if (e) console.log(`      ⚠️ dávka ${i}: ${e.message}`);
        else zmazanychObr += davka.length;
      }
    }
  }
  if (APPLY) console.log(`   ✓ zmazaných obrázkov: ${zmazanychObr}`);

  const { data: koren } = await sb.storage.from(BUCKET).list('', { limit: 100 });
  const cudzie = (koren ?? []).filter((f) => f.id);
  if (cudzie.length) {
    console.log(`   ponechané v koreni (nemažem, nepatria k článkom): ${cudzie.map((f) => f.name).join(', ')}`);
  }

  // ============ 3. FRONTA ============
  nadpis('3) Fronta — rozpracované články z testovacieho obdobia');
  for (const st of ROZPRACOVANE) {
    const { count } = await db.from('queue').select('*', { count: 'exact', head: true }).eq('status', st);
    if (!count) continue;
    console.log(`   ${st}: ${count} → merged`);
    if (APPLY) {
      const { error } = await db.from('queue')
        .update({ status: 'merged', error: 'reset pred ostrým štartom 2026-08-10 — obsah testovacej verzie' })
        .eq('status', st);
      if (error) console.log(`      ⚠️ ${error.message}`);
    }
  }
  const { count: pub } = await db.from('queue').select('*', { count: 'exact', head: true }).eq('status', 'published');
  console.log(`   'published' (${pub}) ZOSTÁVA — je to pamäť duplicít, nie obsah webu (viď hlavička skriptu)`);

  // ============ ZHRNUTIE ============
  nadpis('HOTOVO');
  if (!APPLY) {
    console.log('   Toto bol beh NASUCHO. Ostro:  node --env-file=.env scripts/reset-pred-startom.mjs --apply');
  } else {
    console.log('   Web sa obnoví do ~10 minút (refresh-feeds beží každých 10 min).');
  }
  console.log('\n   RUČNE, skript to nevie:');
  console.log('     • Telegram kanál — zmazať staré príspevky v appke');
  console.log('     • Generátory Svet/Šport — zakomentovaný schedule v netlify.toml treba pushnúť a nechať zdeployovať');
  console.log('     • Google index — staré odkazy môžu chvíľu visieť\n');
}

main().then(() => process.exit(0)).catch((e) => { console.error('\n❌', e); process.exit(1); });
