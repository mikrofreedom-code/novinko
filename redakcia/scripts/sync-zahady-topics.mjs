// Opravný/importný beh po migrácii: publikované témy z hárku do Supabase.
// Bez --apply iba vypíše počet; produkčné zmeny vykoná až explicitný prepínač.
// Spustenie: node --env-file=.env scripts/sync-zahady-topics.mjs [--apply]
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import sheets from '../../netlify/lib/sheets.js';
import zahady from '../../netlify/lib/zahady.js';

const apply = process.argv.includes('--apply');
const sheetsId = process.env.GOOGLE_SHEETS_ID;
const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!sheetsId || !serviceAccount) throw new Error('Chýba prístup ku Google Sheetu.');
if (apply && (!supabaseUrl || !supabaseKey)) throw new Error('Chýba prístup k Supabase.');

const token = await sheets.getAccessToken(serviceAccount);
const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/${encodeURIComponent('articles!A:J')}`;
const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
if (!response.ok) throw new Error(`Čítanie hárku zlyhalo: HTTP ${response.status}`);
const values = (await response.json()).values || [];
const rows = values.slice(1).filter((row) => row[6] === 'zahady');
const db = apply ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } }) : null;
let synced = 0;
for (const row of rows) {
  const meta = zahady.parseMeta(row[9]);
  if (!row[0] || !meta.canonicalTopic) {
    console.warn(`Preskakujem neúplný riadok ${row[0] || '?'}`);
    continue;
  }
  if (!apply) continue;
  const canonicalKey = zahady.normalizeTopic(meta.canonicalTopic);
  const duplicationHash = createHash('sha256').update(canonicalKey).digest('hex');
  const { data: existing, error: readError } = await db.from('mystery_topics')
    .select('article_id,published_at').eq('canonical_key', canonicalKey).maybeSingle();
  if (readError) throw new Error(`${row[0]}: ${readError.message}`);
  const { data: topic, error } = await db.from('mystery_topics').upsert({
    canonical_topic: meta.canonicalTopic,
    canonical_key: canonicalKey,
    duplication_hash: duplicationHash,
    aliases: meta.aliases || [],
    subcategory: meta.subcategory,
    country: meta.country || null,
    location: meta.location || null,
    historical_period: meta.historicalPeriod || null,
    persons: meta.persons || [],
    main_entities: meta.mainEntities || [],
    keywords: [meta.focusKeyword, ...(meta.secondaryKeywords || []), ...(meta.tags || [])].filter(Boolean),
    topic_type: meta.contentType,
    series: meta.series || null,
    published: true,
    published_at: existing?.published_at || row[5],
    article_id: existing?.article_id || String(row[0]),
    last_updated: new Date().toISOString(),
  }, { onConflict: 'canonical_key' }).select('topic_id').single();
  if (error) throw new Error(`${row[0]}: ${error.message}`);
  const { error: linkError } = await db.from('mystery_topic_articles').upsert({
    article_id: String(row[0]), topic_id: topic.topic_id,
    editorial_angle: meta.newAngleReason || null,
    published_at: row[5], last_updated: new Date().toISOString(),
  }, { onConflict: 'article_id' });
  if (linkError) throw new Error(`${row[0]}: ${linkError.message}`);
  synced++;
}
console.log(apply ? `Synchronizovaných ${synced} z ${rows.length} článkov.` : `Náhľad: ${rows.length} článkov rubriky na synchronizáciu.`);
