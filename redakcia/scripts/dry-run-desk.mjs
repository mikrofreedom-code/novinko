// Beh NASUCHO nad reálnym článkom z research desku.
//
// Prejde celú reťaz 05 → 07 → 08 a vypíše, čo by vzniklo — ale NIČ nezapíše
// do fronty ani do hárku. Slúži na overenie, že „prečo" články naozaj vznikajú
// a že príčina je vždy atribuovaná, skôr než sa zapne publikovanie.
//
// Spustenie:  node --env-file=.env scripts/dry-run-desk.mjs [poradie]
//   poradie = ktorý článok z feedu vziať (0 = najnovší, predvolené 0)

import { FEEDS } from '../lib/_shared/feeds.js';
import { fetchFeed } from '../lib/_shared/rss.js';
import { factsFromText } from '../lib/flow/05-verification.js';
import { WRITER_SYSTEM, factsForPrompt } from '../lib/flow/07-writer.js';
import { run as proofread } from '../lib/flow/08-proofreader.js';
import { ask } from '../lib/_shared/ai-gateway.js';

const N = Number(process.argv[2] ?? 0);
const ciara = (t) => console.log(`\n${'═'.repeat(72)}\n${t}\n${'═'.repeat(72)}`);

const desks = FEEDS.filter((f) => f.desk);

// Nájdi prvý desk, ktorý má dosť dlhý článok (krátke oznámenia nemajú výklad).
let zdroj = null, clanok = null;
for (const feed of desks) {
  try {
    const items = await fetchFeed(feed.url);
    const kandidat = items.filter((i) => (i.text ?? '').length > 600)[N];
    if (kandidat) { zdroj = feed; clanok = kandidat; break; }
  } catch (e) {
    console.error(`  (${feed.name} nedostupný: ${e.message})`);
  }
}
if (!clanok) { console.error('Žiadny desk nevrátil dosť dlhý článok.'); process.exit(1); }

ciara(`ZDROJ: ${zdroj.name}`);
console.log(clanok.title);
console.log(clanok.link);
console.log(`dĺžka textu: ${clanok.text.length} znakov`);

// ---------- 05: extrakcia faktov ----------
const meta = {
  source_name: zdroj.name, source_url: clanok.link,
  source_type: zdroj.source_type, entity: zdroj.entity,
  layer: zdroj.layer, desk: true, section: 'krypto',
};
const item = { id: undefined, raw_data: { title: clanok.title, text: clanok.text } };
const extracted = await factsFromText(item, meta);

const analyza = extracted.facts.filter((f) => f.kind === 'analysis');
ciara(`05 — FAKTY (${extracted.facts.length}), z toho výkladov: ${analyza.length}`);
console.log(`event_type: ${extracted.event_type}   entity: ${extracted.entity ?? '—'}`);
for (const f of extracted.facts) {
  const znak = f.kind === 'analysis' ? '🔎' : f.kind === 'quote' ? '❝ ' : f.kind === 'background' ? '📖' : '• ';
  console.log(`  ${znak} [${f.kind}] ${f.statement ?? f.claim}`);
}

const facts = {
  entity: extracted.entity, event_type: extracted.event_type, section: 'krypto',
  lang_source: 'en', attribution_required: analyza.length > 0,
  facts: extracted.facts,
};

if (analyza.length === 0) {
  console.log('\n⚠️  Tento článok nenesie výklad → price_move by ostal zamietnutý (správne).');
}

// ---------- 07: Writer ----------
const raw = await ask({
  tier: 'smart', agent: '07-writer(dry)', system: WRITER_SYSTEM,
  prompt: factsForPrompt(facts), maxTokens: 2200, temperature: 0.4,
});
const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));

ciara('07 — ČLÁNOK OD WRITERA');
console.log(`TITULOK: ${parsed.headline}\n`);
console.log(`PEREX:   ${parsed.perex}\n`);
console.log(parsed.body);
console.log(`\natribúcia použitá: ${parsed.attribution_used === true ? 'ÁNO ✅' : 'NIE ❌'}`);

// ---------- 08: Proofreader (dryRun) ----------
const proof = await proofread(
  { id: undefined, facts, article: { ...parsed, generated_by: 'ai' } },
  { dryRun: true },
);

ciara(`08 — KOREKTOR: verdikt "${proof.verdict}", zásahov: ${proof.issues}`);
for (const i of proof.issueList ?? []) {
  console.log(`  [${i.type}] ${i.action}: ${String(i.quote).slice(0, 100)}`);
}
if (proof.article) {
  console.log(`\n─── PO KOREKTÚRE ───\nTITULOK: ${proof.article.headline}\n`);
  console.log(proof.article.body);
}
