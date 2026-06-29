// ============================================================
// ŽIVÝ TEST jadra pipeline: collected → facts_ready → clustered → written
// Reálne volá Supabase + Anthropic (Haiku v 05, Sonnet v 07). Stojí pár centov.
// ------------------------------------------------------------
// SPUSTENIE (po `npm install` a vytvorení `.env`):
//   node --env-file=.env scripts/live-core-test.mjs
//   node --env-file=.env scripts/live-core-test.mjs --cleanup   # zmaže testovacie riadky na konci
// ============================================================

import { db } from '../lib/_shared/queue.js';
import * as verification from '../lib/flow/05-verification.js';
import * as chiefEditor from '../lib/flow/06-chief-editor.js';
import * as writer from '../lib/flow/07-writer.js';

const CLEANUP = process.argv.includes('--cleanup');
const TAG = `livetest-${Date.now()}`; // značka do raw_data, nech vieme zmazať len naše riadky

// Dve vzorové `collected` položky — jedna číselná (Layer A, bez AI),
// jedna textová z PRIMÁRNEHO zdroja (Layer B/C, cez Haiku).
const SEED = [
  {
    status: 'collected',
    raw_data: {
      _tag: TAG,
      source_name: 'CoinGecko', source_url: 'https://coingecko.com/en/coins/bitcoin',
      source_type: 'primary', layer: 'A', entity: 'Bitcoin',
      metrics: { price_usd: 61240, change_24h_pct: -8.3, volume_24h_usd: 38500000000 },
    },
  },
  {
    status: 'collected',
    raw_data: {
      _tag: TAG,
      source_name: 'Ethereum Foundation Blog', source_url: 'https://blog.ethereum.org/2026/06/28/example',
      source_type: 'primary', layer: 'B', entity: 'Ethereum',
      title: 'Ethereum Foundation announces Pectra mainnet activation',
      text: 'The Ethereum Foundation announced that the Pectra upgrade will activate on mainnet on July 9, 2026. '
          + 'The upgrade introduces account abstraction improvements and raises the validator staking cap. '
          + 'Node operators are advised to update their clients before the activation epoch.',
    },
  },
];

const log = (s) => console.log(`\n\x1b[36m${s}\x1b[0m`);

async function main() {
  log('1) Vkladám 2 testovacie `collected` položky');
  const { data: inserted, error: insErr } = await db.from('queue').insert(SEED).select('id, raw_data');
  if (insErr) throw insErr;
  console.log(`   vložené id: ${inserted.map((r) => r.id).join(', ')}`);

  log('2) 05-verification (Layer A bez AI, Layer B cez Haiku) → facts_ready');
  console.log('  ', await verification.runBatch(50));

  log('3) 06-chief-editor (clustering + newsworthiness brána) → clustered');
  console.log('  ', await chiefEditor.runBatch(50));

  log('4) 07-writer (Sonnet, len facts JSON) → written');
  console.log('  ', await writer.runBatch(50));

  log('5) Výsledné články (status=written)');
  const ids = inserted.map((r) => r.id);
  const { data: done, error: selErr } = await db.from('queue')
    .select('id, status, entity:facts->entity, article, error').in('id', ids);
  if (selErr) throw selErr;
  for (const row of done) {
    console.log(`\n   ── ${row.status.toUpperCase()} (id ${row.id.slice(0, 8)})`);
    if (row.error) console.log(`   ERROR: ${row.error}`);
    if (row.article) {
      console.log(`   📰 ${row.article.headline}`);
      console.log(`   ${row.article.perex ?? ''}`);
      console.log(`   ${(row.article.body ?? '').split('\n').join('\n   ')}`);
      console.log(`   zdroje: ${(row.article.sources ?? []).map((s) => `${s.name} [${s.type}]`).join(', ')}`);
      console.log(`   attribution_used: ${row.article.attribution_used}`);
    }
  }

  log('6) Reálny AI náklad (ai_cost_log za tento beh)');
  const { data: costs } = await db.from('ai_cost_log')
    .select('agent, model, input_tokens, output_tokens, cost_usd')
    .order('created_at', { ascending: false }).limit(10);
  let total = 0;
  for (const c of costs ?? []) {
    total += Number(c.cost_usd);
    console.log(`   ${c.agent.padEnd(16)} ${c.model.padEnd(28)} in=${c.input_tokens} out=${c.output_tokens} $${Number(c.cost_usd).toFixed(6)}`);
  }
  console.log(`   ───── SPOLU (posledných 10): $${total.toFixed(6)}`);

  if (CLEANUP) {
    log('7) Cleanup — mažem testovacie riadky');
    const { error: delErr } = await db.from('queue').delete().in('id', ids);
    if (delErr) throw delErr;
    console.log('   ✅ zmazané');
  } else {
    console.log('\n(Spusti s --cleanup, ak chceš testovacie riadky zmazať.)');
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error('\n❌', e); process.exit(1); });
