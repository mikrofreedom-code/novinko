// ============================================================
// DOPLŇ OBRÁZOK k už publikovanému článku (retroaktívne)
// ------------------------------------------------------------
//   node --env-file=.env scripts/doplni-obrazok.mjs <queue-id>            # NASUCHO
//   node --env-file=.env scripts/doplni-obrazok.mjs <queue-id> --apply     # OSTRO
//
// PREČO TENTO SKRIPT EXISTUJE:
// 11-image niekedy vynechá obrázok — buď zámerne (article.no_ai_image, napr.
// BIBLIA-ZAHRADA kap. 8 pri identifikačnom riziku, aj keď téma naň v skutočnosti
// nesadá — false positive) alebo pri zlyhaní Replicate. Článok medzitým prejde
// ďalej a je publikovaný. Dovtedy neexistoval spôsob obrázok dopísať bez toho,
// aby si niekto ručne prepisoval bunky v Google hárku.
//
// ⚠️ ŽIVÝ WEB ČÍTA HÁROK (stĺpec H), NIE FRONTU — rovnaká poučka ako
// presun-obrazky.mjs. Fronta (queue.article.image_url) sa aktualizuje len
// pre poriadok v audit stope.
//
// Hárok nemá cudzí kľúč na queue.id (stĺpec A je vlastný uniqueId() z
// sheets.js, nie UUID frontu) — riadok sa preto hľadá podľa PRESNEJ zhody
// titulku (stĺpec B). Ak titulok nie je v hárku jedinečný, skript odmietne
// hádať a treba to doriešiť ručne.
// ============================================================

import { db } from '../lib/_shared/queue.js';
import { generateImage } from '../lib/_shared/images.js';
import { aiImagePrompt } from '../lib/flow/11-image.js';
import { getAccessToken } from '../lib/_shared/sheets.js';

const APPLY = process.argv.includes('--apply');
const queueId = process.argv.slice(2).find((a) => !a.startsWith('--'));

if (!queueId) {
  console.error('\nPoužitie: node --env-file=.env scripts/doplni-obrazok.mjs <queue-id> [--apply]\n');
  process.exit(1);
}

console.log(APPLY ? '\n⚠️  OSTRÝ BEH — generuje obrázok a zapisuje do hárku aj fronty\n' : '\nNASUCHO — negeneruje, len ukáže čo by sa stalo (spusti s --apply)\n');

// ── 1. načítaj položku z fronty ──
const { data: item, error: e1 } = await db.from('queue')
  .select('id, status, article').eq('id', queueId).single();
if (e1) throw new Error(`fronta: ${e1.message}`);
if (!item?.article?.headline) throw new Error('položka nemá article.headline — zlá ID alebo prázdny článok');

const a = item.article;
console.log(`Článok: "${a.headline}"`);
console.log(`Sekcia: ${a.section ?? '(chýba)'}   Status: ${item.status}`);
if (a.image_url) {
  console.log(`\n⚠️  Článok už MÁ obrázok (${a.image_url}) — nič nerobím. Zmaž ho ručne, ak ho chceš prepísať.`);
  process.exit(0);
}

// ── 2. nájdi riadok v hárku podľa titulku (skôr, než minieme peniaze na obrázok) ──
const sheetsId = process.env.GOOGLE_SHEETS_ID;
if (!sheetsId) throw new Error('chýba GOOGLE_SHEETS_ID');
const token = await getAccessToken();
const rHarok = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/articles!A:I`,
  { headers: { Authorization: `Bearer ${token}` } },
);
if (!rHarok.ok) throw new Error(`hárok čítanie: ${rHarok.status}`);
const riadky = (await rHarok.json()).values ?? [];
const zhody = riadky
  .map((riadok, i) => ({ i, riadok }))
  .filter(({ riadok }) => (riadok[1] ?? '') === a.headline);

if (zhody.length === 0) {
  throw new Error('titulok sa v hárku nenašiel — nemôžem vedieť, ktorý riadok prepísať. Over ručne.');
}
if (zhody.length > 1) {
  throw new Error(`titulok sa v hárku nachádza ${zhody.length}×  (riadky ${zhody.map((z) => z.i + 1).join(', ')}) — nejednoznačné, doriešiť ručne.`);
}
const { i: riadokIdx, riadok } = zhody[0];
console.log(`Nájdený v hárku: riadok ${riadokIdx + 1}, stĺpec H (obrázok) je momentálne "${riadok[7] ?? ''}".`);

if (!APPLY) {
  console.log('\n(len náhľad, obrázok sa negeneroval — spusti s --apply)\n');
  process.exit(0);
}

// ── 3. vygeneruj obrázok (rovnaká cesta ako 11-image.js) ──
console.log('\nGenerujem prompt cez Haiku…');
const prompt = await aiImagePrompt(item);
console.log(`Prompt: ${prompt || '(padlo na šablónu podľa sekcie)'}`);
console.log('Generujem obrázok cez Replicate…');
const imageUrl = await generateImage(a.headline, item.id, {
  section: a.section,
  entity: a.entity,
  prompt: prompt || undefined,
});
if (!imageUrl) throw new Error('generateImage vrátilo prázdny výsledok — pozri log vyššie pre dôvod.');
console.log(`✓ Obrázok: ${imageUrl}`);

// ── 4. zapíš do hárku, stĺpec H (toto vidí živý web) ──
const rZapis = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/articles!H${riadokIdx + 1}?valueInputOption=RAW`,
  {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[imageUrl]] }),
  },
);
if (!rZapis.ok) throw new Error(`hárok zápis: ${rZapis.status} ${(await rZapis.text()).slice(0, 200)}`);
console.log(`✓ Hárok, riadok ${riadokIdx + 1}, stĺpec H prepísaný.`);

// ── 5. audit stopa vo fronte ──
const { error: e2 } = await db.from('queue')
  .update({ article: { ...a, image_url: imageUrl, no_ai_image: false } })
  .eq('id', item.id);
if (e2) console.error(`⚠️  fronta sa neaktualizovala (web to nevidí, nie je kritické): ${e2.message}`);
else console.log('✓ Fronta (audit stopa) aktualizovaná.');

console.log('\nHOTOVO. Over naživo na novinko.sk/zahrada.html (môže trvať pár minút, kým sa prejaví CSV cache prehliadača).\n');
