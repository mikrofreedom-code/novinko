// ============================================================
// PRESUN OBRÁZKOV: arena projekt → redakcia projekt
// ------------------------------------------------------------
//   node --env-file=.env scripts/presun-obrazky.mjs           # NASUCHO (nič nemení)
//   node --env-file=.env scripts/presun-obrazky.mjs --apply    # OSTRO
//
// PREČO: bucket `article-images` sedí v projekte sndnglmrpgdzwdilgapj, teda
// v tom istom, kde beží Caldrisia arena. Kým tam je, arena projekt sa nedá
// zrušiť — novinko by prišlo o obrázky. Tento skript presunie bucket do
// redakcia projektu (kypwhjpedbtodehrviub), aby novinko stálo na jednom
// projekte a arena bola zahoditeľná celá.
//
// PORADIE KROKOV JE ZÁMERNÉ — najprv kopíruj, až potom prepisuj odkazy:
//   1. založ bucket v cieli (verejný, ako zdrojový)
//   2. skopíruj súbory  (zdroj sa NEMAŽE — poistka, keby sa krok 3 pokazil)
//   3. prepíš odkazy v Google hárku, stĺpec H   ← TOTO VIDÍ ŽIVÝ WEB
//   4. prepíš odkazy vo fronte (queue.article.image_url)
//
// ⚠️ ŽIVÝ WEB ČÍTA HÁROK, NIE FRONTU.
// clanok.js na Netlify servuje články z hárku 'articles'; obrázok je stĺpec H
// (viď sheets.js:59). Fronta je len audit stopa. Keby sa prepísala iba fronta,
// na webe by sa nezmenilo NIČ a po zrušení arena projektu by obrázky zmizli.
// Preto je krok 3 povinný a krok 4 je len kozmetika pre poriadok v archíve.
//
// ⚠️ PRIEČINOK manual/ SA MUSÍ PRESUNÚŤ TIEŽ.
// 108 súborov, 116,5 MB — sú to ručne nahrané fotky cez publikovat.html, ktoré
// NEIDÚ cez frontu. Vo fronte teda vyzerajú ako siroty, ale na webe sú živé.
// Nepokúšaj sa ich filtrovať podľa fronty, prídeš o ne.
//
// ČO SA NEMAŽE A PREČO:
//   • zdrojový bucket — nechávame ho dovtedy, kým neoveríš, že web beží
//     z nového. Mazanie je samostatný, ručný krok (viď výpis na konci).
//   • test/ (2 súbory z 24. 6.) a `ChatGPT Image 6. 7. 2026...png` v koreni —
//     nepatria k žiadnemu článku, len ich vypíšeme. Rovnaká zásada ako
//     v reset-pred-startom.mjs: nemažem naslepo, čo som nevytvoril.
//
// ČO PO TOMTO SKRIPTE ZOSTÁVA RUČNE:
//   • prepnúť IMAGE_SUPABASE_URL / IMAGE_SUPABASE_KEY v .env na redakcia projekt
//   • až potom zrušiť arena projekt v dashboarde
// CSP riešiť netreba — gen-csp.mjs má `img-src https://*.supabase.co`, teda
// wildcard cez všetky projekty; nová doména cezeň prejde bez zmeny.
// ============================================================

import { getAccessToken } from '../lib/_shared/sheets.js';
import { db } from '../lib/_shared/queue.js';

const APPLY = process.argv.includes('--apply');
const BUCKET = process.env.SUPABASE_BUCKET ?? 'article-images';

const ZDROJ = { url: process.env.IMAGE_SUPABASE_URL, key: process.env.IMAGE_SUPABASE_KEY };
// ⚠️ POZOR NA NÁZVY: `SUPABASE_URL` znamená v každom .env niečo iné —
// v redakcia/.env je to redakcia projekt (kypwhj…), v koreňovom .env je to
// arena (sndngl…). Preto najprv skús jednoznačné REDAKCIA_*, a keď nie sú
// (skript sa spúšťa z redakcia/), padni na SUPABASE_URL. Kontrola ZDROJ≠CIEĽ
// nižšie chytí prípad, keby to niekto spustil z nesprávneho priečinka.
const CIEL = {
  url: process.env.REDAKCIA_SUPABASE_URL ?? process.env.SUPABASE_URL,
  key: process.env.REDAKCIA_SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
};

for (const [meno, p] of [['ZDROJ', ZDROJ], ['CIEĽ', CIEL]]) {
  if (!p.url || !p.key) throw new Error(`chýbajú prístupy pre ${meno} (url alebo key)`);
}
if (ZDROJ.url === CIEL.url) throw new Error('zdroj a cieľ sú ten istý projekt — nič na presun');

// Nové kľúče (sb_secret_…) nie sú JWT, musia ísť v hlavičke apikey.
const hlavicky = (p, extra = {}) => ({ apikey: p.key, Authorization: `Bearer ${p.key}`, ...extra });

// ── 1. bucket v cieli ──
async function zalozBucket() {
  const r = await fetch(`${CIEL.url}/storage/v1/bucket`, {
    method: 'POST',
    headers: hlavicky(CIEL, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (r.ok) return 'založený';
  const t = await r.text();
  if (r.status === 409 || t.includes('already exists')) return 'už existoval';
  throw new Error(`bucket: ${r.status} ${t.slice(0, 200)}`);
}

// ── výpis súborov v zdroji (stránkovane, aj podpriečinky) ──
async function vypisZdroj(prefix = '') {
  const von = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(`${ZDROJ.url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: hlavicky(ZDROJ, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!r.ok) throw new Error(`výpis ${prefix}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    for (const x of d) {
      const cesta = prefix + x.name;
      // id === null znamená priečinok, nie súbor — rekurzia doň.
      if (x.id === null) von.push(...await vypisZdroj(`${cesta}/`));
      else von.push({ cesta, velkost: x.metadata?.size ?? 0 });
    }
    if (d.length < 1000) break;
  }
  return von;
}

// ── 2. kopírovanie ──
async function skopiruj(subory) {
  const res = { skopirovane: 0, preskocene: 0, chyby: [], bajty: 0 };
  for (const s of subory) {
    // Už tam je? Nesťahuj znova — skript musí byť spustiteľný opakovane.
    const hlava = await fetch(`${CIEL.url}/storage/v1/object/info/public/${BUCKET}/${s.cesta}`,
      { headers: hlavicky(CIEL) });
    if (hlava.ok) { res.preskocene++; continue; }

    if (!APPLY) { res.skopirovane++; res.bajty += s.velkost; continue; }

    const stiahnute = await fetch(`${ZDROJ.url}/storage/v1/object/public/${BUCKET}/${s.cesta}`);
    if (!stiahnute.ok) { res.chyby.push(`${s.cesta}: stiahnutie ${stiahnute.status}`); continue; }
    const telo = Buffer.from(await stiahnute.arrayBuffer());

    const nahrate = await fetch(`${CIEL.url}/storage/v1/object/${BUCKET}/${s.cesta}`, {
      method: 'POST',
      headers: hlavicky(CIEL, {
        'Content-Type': stiahnute.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': '3600',
      }),
      body: telo,
    });
    if (!nahrate.ok) { res.chyby.push(`${s.cesta}: nahratie ${nahrate.status} ${(await nahrate.text()).slice(0, 120)}`); continue; }
    res.skopirovane++; res.bajty += telo.length;
    if (process.stdout.isTTY) process.stdout.write(`\r   skopírované ${res.skopirovane}/${subory.length}   `);
  }
  if (process.stdout.isTTY) process.stdout.write('\r');
  return res;
}

// ── 3. Google hárok, stĺpec H ── (toto vidí živý web)
async function prepisHarok() {
  const id = process.env.GOOGLE_SHEETS_ID;
  if (!id) throw new Error('chýba GOOGLE_SHEETS_ID');
  const token = await getAccessToken();
  const auth = { Authorization: `Bearer ${token}` };

  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/articles!A:I`, { headers: auth });
  if (!r.ok) throw new Error(`hárok čítanie: ${r.status}`);
  const riadky = (await r.json()).values ?? [];

  const zmeny = [];
  riadky.forEach((riadok, i) => {
    const stary = riadok[7] ?? '';               // H
    if (!stary.startsWith(ZDROJ.url)) return;
    zmeny.push({ bunka: `articles!H${i + 1}`, novy: stary.replace(ZDROJ.url, CIEL.url) });
  });

  if (!APPLY || !zmeny.length) return { najdene: zmeny.length, prepisane: 0 };

  // Dávkovo, nech to nie je 300 volaní.
  const r2 = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`,
    {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: zmeny.map((z) => ({ range: z.bunka, values: [[z.novy]] })),
      }),
    },
  );
  if (!r2.ok) throw new Error(`hárok zápis: ${r2.status} ${(await r2.text()).slice(0, 200)}`);
  return { najdene: zmeny.length, prepisane: zmeny.length };
}

// ── 4. fronta (audit stopa, nie živý web) ──
async function prepisFrontu() {
  const res = { najdene: 0, prepisane: 0 };
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from('queue')
      .select('id, article').not('article', 'is', null)
      .order('created_at').range(offset, offset + 499);
    if (error) throw new Error(`fronta: ${error.message}`);
    if (!data?.length) break;

    for (const r of data) {
      const stary = r.article?.image_url ?? '';
      if (!stary.startsWith(ZDROJ.url)) continue;
      res.najdene++;
      if (!APPLY) continue;
      const { error: e } = await db.from('queue')
        .update({ article: { ...r.article, image_url: stary.replace(ZDROJ.url, CIEL.url) } })
        .eq('id', r.id);
      if (e) throw new Error(`fronta ${r.id}: ${e.message}`);
      res.prepisane++;
    }
    if (data.length < 500) break;
  }
  return res;
}

// ── beh ──
console.log(APPLY ? '\n⚠️  OSTRÝ BEH — mení sa hárok aj fronta\n' : '\nNASUCHO — nič sa nemení (spusti s --apply)\n');

const subory = await vypisZdroj();
const podlaPriecinka = {};
for (const s of subory) {
  const k = s.cesta.includes('/') ? `${s.cesta.split('/')[0]}/` : '(koreň)';
  podlaPriecinka[k] ??= { n: 0, b: 0 };
  podlaPriecinka[k].n++; podlaPriecinka[k].b += s.velkost;
}
console.log('v zdrojovom buckete:');
for (const [k, v] of Object.entries(podlaPriecinka).sort((a, b) => b[1].b - a[1].b)) {
  console.log(`   ${k.padEnd(12)} ${String(v.n).padStart(4)} súborov  ${(v.b / 1048576).toFixed(1).padStart(7)} MB`);
}
const spolu = subory.reduce((s, x) => s + x.velkost, 0);
console.log(`   ${'SPOLU'.padEnd(12)} ${String(subory.length).padStart(4)} súborov  ${(spolu / 1048576).toFixed(1).padStart(7)} MB`);

console.log(`\n1) bucket v cieli: ${APPLY ? await zalozBucket() : '(nasucho)'}`);

const k = await skopiruj(subory);
console.log(`2) kopírovanie: ${k.skopirovane} ${APPLY ? 'skopírovaných' : 'na skopírovanie'}, ${k.preskocene} už v cieli, ${(k.bajty / 1048576).toFixed(1)} MB`);
for (const ch of k.chyby.slice(0, 10)) console.log(`   ⚠️ ${ch}`);
if (k.chyby.length > 10) console.log(`   ⚠️ …a ďalších ${k.chyby.length - 10} chýb`);

if (k.chyby.length && APPLY) {
  console.log('\n❌ Kopírovanie malo chyby — odkazy NEPREPISUJEM. Oprav a spusti znova.');
  process.exit(1);
}

const h = await prepisHarok();
console.log(`3) hárok, stĺpec H: ${h.najdene} odkazov na starý projekt, ${APPLY ? `${h.prepisane} prepísaných` : 'nasucho'}`);

const f = await prepisFrontu();
console.log(`4) fronta: ${f.najdene} odkazov, ${APPLY ? `${f.prepisane} prepísaných` : 'nasucho'}`);

console.log(`
${APPLY ? 'HOTOVO.' : '(len náhľad)'} Ďalej RUČNE, v tomto poradí:
   a) .env → IMAGE_SUPABASE_URL a IMAGE_SUPABASE_KEY na redakcia projekt
      (CSP netreba — gen-csp.mjs má wildcard https://*.supabase.co)
   b) otvor novinko.sk a over, že obrázky idú z kypwhjpedbtodehrviub
   c) AŽ POTOM zruš arena projekt v Supabase dashboarde (cez web, nie odtiaľto)
`);
process.exit(0);
