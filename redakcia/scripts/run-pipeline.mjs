// ============================================================
// REÁLNA PIPELINE: 01-scout → 02-gateway → 04-collector → 05 → 06 → 07
// Stiahne živé dáta z CoinGecku a prebehne celým lievikom.
// ------------------------------------------------------------
//   node --env-file=.env scripts/run-pipeline.mjs
//   node --env-file=.env scripts/run-pipeline.mjs --no-scout   # preskoč scout (spracuj existujúce raw)
// ============================================================

import { db } from '../lib/_shared/queue.js';
import { retryTransientErrors } from '../lib/_shared/retry.js';
import { generatePrehlad } from './prehlad.mjs';
import { generateWeb } from './web.mjs';
import * as evergreen from '../lib/_shared/evergreen.js';
import * as scout from '../lib/flow/01-scout.js';
import * as gateway from '../lib/flow/02-event-gateway.js';
import * as collector from '../lib/flow/04-collector.js';
import * as verification from '../lib/flow/05-verification.js';
import * as chiefEditor from '../lib/flow/06-chief-editor.js';
import * as writer from '../lib/flow/07-writer.js';
import * as marketRecap from '../lib/flow/13-market-recap.js';
import * as image from '../lib/flow/11-image.js';
import * as publisher from '../lib/flow/12-publisher.js';

const SKIP_SCOUT = process.argv.includes('--no-scout');
const log = (s) => console.log(`\n\x1b[36m${s}\x1b[0m`);

async function main() {
  log('0) retry — dočasné chyby späť do hry');
  console.log('  ', await retryTransientErrors());

  if (!SKIP_SCOUT) {
    log('01-scout — sťahujem živé trhy z CoinGecku → raw');
    console.log('  ', await scout.run());
  }
  log('02-event-gateway — prah + dedup → filtered/rejected');
  console.log('  ', await gateway.runBatch());

  log('04-collector — normalizácia → collected');
  console.log('  ', await collector.runBatch());

  log('05-verification — fakty (Layer A bez AI) → facts_ready');
  console.log('  ', await verification.runBatch());

  log('06-chief-editor — clustering + newsworthiness → clustered');
  console.log('  ', await chiefEditor.runBatch());

  log('07-writer — Sonnet, len facts JSON → written');
  console.log('  ', await writer.runBatch());

  log('13-market-recap — denný prehľad trhu (raz ráno) → written');
  try { console.log('  ', await marketRecap.run()); }
  catch (e) { console.log('   ⚠️ recap preskočený:', e.message); }

  log('11-image — Flux Schnell obrázok → imaged (pripravené na publikovanie)');
  console.log('  ', await image.runBatch(30));

  log('12-publisher — zverejni top 2 na živú stránku → published');
  console.log('  ', await publisher.runBatch());

  log('evergreen — Krypto škola: raz za ~2–3 dni vytiahni vysvetlivku na hlavnú');
  try { console.log('  ', await evergreen.rotate()); }
  catch (e) { console.log('   ⚠️ evergreen preskočený:', e.message); }

  log('Hotové články (status=written, posledné 4)');
  const { data: arts } = await db.from('queue')
    .select('article, facts->entity')
    .eq('status', 'written').order('updated_at', { ascending: false }).limit(4);
  for (const r of arts ?? []) {
    if (!r.article) continue;
    console.log(`\n   📰 ${r.article.headline}`);
    console.log(`   ${r.article.perex ?? ''}`);
    console.log(`   zdroje: ${(r.article.sources ?? []).map((s) => `${s.name} [${s.type}]`).join(', ')}`);
  }

  log('AI náklad za tento beh (posledných 10 volaní)');
  const { data: costs } = await db.from('ai_cost_log')
    .select('agent, model, cost_usd').order('created_at', { ascending: false }).limit(10);
  const total = (costs ?? []).reduce((s, c) => s + Number(c.cost_usd), 0);
  console.log(`   volaní: ${costs?.length ?? 0}, spolu: $${total.toFixed(6)}`);

  log('prehlad.html + web — obnovujem prehľad a verejnú stránku');
  const p = await generatePrehlad();
  const w = await generateWeb();
  console.log(`   prehľad: vybraných ${p.selected}, čaká ${p.texts} · web: ${w.count} článkov`);
}

main().then(() => process.exit(0)).catch((e) => { console.error('\n❌', e); process.exit(1); });
