// Zmaže riadky z hárku "articles" v živej stránke podľa titulku (presná zhoda
// na podreťazec). Bezpečné: zmaže LEN to, čo sa zhoduje. Maže odspodu.
//   node --env-file=.env scripts/unpublish.mjs "ESMA zverejnila" "Chainlink vydal verziu 2.52.0"
import { getAccessToken } from '../lib/_shared/sheets.js';

const SHEET = 'articles';
const targets = process.argv.slice(2);
if (!targets.length) { console.log('Použitie: ... unpublish.mjs "titulok1" "titulok2"'); process.exit(1); }

const id = process.env.GOOGLE_SHEETS_ID;
const token = await getAccessToken();
const auth = { Authorization: `Bearer ${token}` };

// 1) Načítaj riadky (A:B = id, titulok)
const valsRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${SHEET}!A:B`, { headers: auth });
const vals = (await valsRes.json()).values ?? [];

// 2) Nájdi indexy riadkov, ktorých titulok (stĺpec B) obsahuje niektorý cieľ
const toDelete = [];
vals.forEach((row, i) => {
  const title = row[1] ?? '';
  if (targets.some((t) => title.includes(t))) toDelete.push({ i, title });
});

if (!toDelete.length) { console.log('Nenašiel som žiadny zhodný riadok.'); process.exit(0); }
console.log('Mažem riadky:');
for (const d of toDelete) console.log(`   #${d.i + 1}  ${d.title.slice(0, 60)}`);

// 3) Zisti sheetId (gid) hárku "articles"
const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=sheets.properties`, { headers: auth });
const sheet = (await metaRes.json()).sheets.find((s) => s.properties.title === SHEET);
if (!sheet) { console.log(`Hárok "${SHEET}" neexistuje`); process.exit(1); }
const sheetId = sheet.properties.sheetId;

// 4) Zmaž odspodu (aby sa neposunuli indexy)
const requests = toDelete
  .sort((a, b) => b.i - a.i)
  .map((d) => ({ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: d.i, endIndex: d.i + 1 } } }));

const del = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`, {
  method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ requests }),
});
if (!del.ok) { console.error('❌ Mazanie zlyhalo:', (await del.text()).slice(0, 200)); process.exit(1); }
console.log(`\n✅ Zmazaných ${toDelete.length} riadkov zo živej stránky.`);
process.exit(0);
