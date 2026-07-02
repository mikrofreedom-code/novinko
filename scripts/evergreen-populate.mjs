// JEDNORAZOVÁ POPULÁCIA sekcie "Krypto škola" (kategória krypto-skola).
// Zapíše všetky vysvetlivky z knižnice do hárku ako NADČASOVÉ (nevypršia).
// Idempotentné: čo už raz vložil (marker _src='evergreen-section'), preskočí.
//
// Marker je ZÁMERNE iný než rotácia (_src='evergreen'), aby populácia sekcie
// neovplyvnila výber rotácie na hlavnú stránku.
//
//   node --env-file=.env scripts/evergreen-populate.mjs
//   node --env-file=.env scripts/evergreen-populate.mjs --dry   # len ukáž, nič nezapíš

import { db } from '../lib/_shared/queue.js';
import { articleToRow, appendArticleRow } from '../lib/_shared/sheets.js';
import { loadLibrary, imageFor } from '../lib/_shared/evergreen.js';

const DRY = process.argv.includes('--dry');
const CATEGORY = 'krypto-skola';

async function alreadyDone() {
  const { data } = await db.from('queue')
    .select('raw_data')
    .eq('raw_data->>_src', 'evergreen-section')
    .limit(500);
  return new Set((data ?? []).map((r) => r.raw_data?.slug).filter(Boolean));
}

async function main() {
  const library = await loadLibrary();
  if (!library.length) { console.log('prázdna knižnica'); return; }

  if (process.env.MANUAL_APPROVAL === 'true' && process.env.ALLOW_PUBLISH !== 'true' && !DRY) {
    console.log('publikovanie vypnuté (ALLOW_PUBLISH=true povolí, alebo --dry)');
    return;
  }

  const done = DRY ? new Set() : await alreadyDone();
  const todo = library.filter((a) => !done.has(a.slug));
  console.log(`knižnica ${library.length}, už v sekcii ${done.size}, na pridanie ${todo.length}`);

  for (const a of todo) {
    if (DRY) { console.log('  [dry]', a.slug, '—', a.headline); continue; }

    const image_url = await imageFor(a.slug, a.headline);
    const article = {
      headline: a.headline,
      perex: a.perex,
      body: a.body,
      sources: [{ name: 'Novinko — Krypto škola', url: '' }],
      image_url,
      category: CATEGORY,
      kind: 'evergreen',
      slug: a.slug,
    };
    await appendArticleRow(articleToRow(article, CATEGORY));
    await db.from('queue').insert({
      source_id: null,
      status: 'published',
      raw_data: { _src: 'evergreen-section', slug: a.slug, day: new Date().toISOString().slice(0, 10) },
      article,
    });
    console.log('  ✅', a.slug, image_url ? '(obrázok)' : '(bez obrázka)');
  }
  console.log(DRY ? '\n(dry-run, nič sa nezapísalo)' : '\nHotovo — sekcia naplnená.');
}

main().then(() => process.exit(0)).catch((e) => { console.error('❌', e.message); process.exit(1); });
