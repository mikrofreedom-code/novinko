// Best-effort zrkadlo publikovaných tém do Supabase. Hárok ostáva zdrojom
// pravdy; výpadok databázy nesmie vyvolať druhý zápis toho istého článku.
const { createClient } = require('@supabase/supabase-js');
const { createHash } = require('node:crypto');
const { SUPABASE_URL, SUPABASE_KEY } = require('./config');
const { parseMeta, normalizeTopic } = require('./zahady');

async function syncMysteryTopic(row) {
  if (row?.[6] !== 'zahady') return { skipped: true };
  if (!SUPABASE_URL || !SUPABASE_KEY) return { skipped: true, reason: 'Supabase nie je nakonfigurovaný' };
  const meta = parseMeta(row[9]);
  const canonical = String(meta.canonicalTopic || '').trim();
  if (!canonical) return { skipped: true, reason: 'Chýba kanonická téma' };
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const canonicalKey = normalizeTopic(canonical);
  const duplicationHash = createHash('sha256').update(canonicalKey).digest('hex');
  const { data: existing, error: readError } = await client.from('mystery_topics')
    .select('topic_id,article_id,published_at').eq('canonical_key', canonicalKey).maybeSingle();
  if (readError) throw readError;
  const record = {
    canonical_topic: canonical,
    canonical_key: canonicalKey,
    duplication_hash: duplicationHash,
    aliases: Array.isArray(meta.aliases) ? meta.aliases : [],
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
  };
  const { data: topic, error } = await client.from('mystery_topics')
    .upsert(record, { onConflict: 'canonical_key' }).select('topic_id').single();
  if (error) throw error;
  const { error: linkError } = await client.from('mystery_topic_articles').upsert({
    article_id: String(row[0]), topic_id: topic.topic_id,
    editorial_angle: meta.newAngleReason || null,
    published_at: row[5], last_updated: new Date().toISOString(),
  }, { onConflict: 'article_id' });
  if (linkError) throw linkError;
  return { synced: true };
}

module.exports = { syncMysteryTopic };
