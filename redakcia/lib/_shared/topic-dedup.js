// Deterministic topic identity used by the editorial cooldown.
//
// URL/title dedup in 02 catches the same feed item. This catches the same
// editorial story arriving through several publishers and pipeline runs.

// The key is deliberately conservative: section + canonical entity + event.
// Items without an entity are not deduplicated here because grouping every
// anonymous disaster/protest together would suppress unrelated news.

// Parenthetical acronyms are preferred. This makes translations such as
// "Alternative for Germany (AfD)" and "Alternative für Deutschland (AfD)"
// resolve to the same entity without a hard-coded list of political parties.
export function canonicalEntity(entity) {
  const original = String(entity ?? '').trim();
  if (!original) return null;

  const acronym = original.match(/\(([A-Za-z][A-Za-z0-9.-]{1,7})\)/)?.[1];
  if (acronym && /[A-Z]/.test(acronym)) return clean(acronym);

  return clean(original);
}

function clean(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() || null;
}

export function topicKey(facts) {
  const entity = canonicalEntity(facts?.entity);
  if (!entity) return null;
  const section = clean(facts?.section ?? 'krypto');
  const event = clean(facts?.event_type ?? 'other');
  return `${section}|${entity}|${event}`;
}

const ACTIVE_ARTICLE_STATUSES = new Set([
  'written', 'proofed', 'legal_ok', 'seo_done', 'imaged', 'published',
]);

// A manual rejection is an editorial decision about the topic, not merely
// about one URL. Technical/legal failures remain retryable and do not block it.
export function blocksTopic(row) {
  if (!row?.article) return false;
  if (ACTIVE_ARTICLE_STATUSES.has(row.status)) return true;
  return row.status === 'rejected'
    && String(row.error ?? '').startsWith('12-publisher: zamietnuté ručne');
}

export function handledTopicKeys(rows) {
  const keys = new Set();
  for (const row of rows ?? []) {
    if (!blocksTopic(row)) continue;
    const key = topicKey(row.facts);
    if (key) keys.add(key);
  }
  return keys;
}

export function manuallyRejectedTopicKeys(rows) {
  const keys = new Set();
  for (const row of rows ?? []) {
    if (row?.status !== 'rejected'
      || !String(row.error ?? '').startsWith('12-publisher: zamietnuté ručne')) continue;
    const key = topicKey(row.facts);
    if (key) keys.add(key);
  }
  return keys;
}

export async function loadRecentHandledTopicRows(db, hours = 24, now = new Date()) {
  const since = new Date(now.getTime() - hours * 3600e3).toISOString();
  const { data, error } = await db.from('queue')
    .select('status,error,facts,article,updated_at')
    .not('article', 'is', null)
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).filter(blocksTopic);
}

export async function loadRecentHandledTopicKeys(db, hours = 24, now = new Date()) {
  return handledTopicKeys(await loadRecentHandledTopicRows(db, hours, now));
}
