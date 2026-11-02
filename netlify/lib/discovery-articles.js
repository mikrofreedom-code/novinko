// Public, published articles for HTML discovery and sitemaps. The Sheet is
// still the source of truth; no build or content duplication per publication.
const { SHEET_CSV_URL } = require('./config');
const { splitCSVRecords, parseCSVLine } = require('./csv');
const { parseMeta } = require('./zahady');

async function loadDiscoveryArticles(now = Date.now()) {
  const response = await fetch(SHEET_CSV_URL, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Sheet HTTP ${response.status}`);
  const records = splitCSVRecords(await response.text());
  // Do not interpret an HTML error page or truncated export as an empty site.
  const header = parseCSVLine(records[0] || '');
  if (header[0]?.toLowerCase() !== 'id' || header[1]?.toLowerCase() !== 'title') {
    throw new Error('Invalid article export');
  }
  const articles = records.slice(1).map(line => {
    const [id, title, perex, , , date, category, imageUrl, imageCredit, meta] = parseCSVLine(line);
    const published = Date.parse(date);
    if (!id || !title || !Number.isFinite(published) || published > now) return null;
    return { id, title, perex, date, category, imageUrl, imageCredit,
      mystery: category === 'zahady' ? parseMeta(meta) : {} };
  }).filter(Boolean).sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  if (!articles.length) throw new Error('No published articles in export');
  return articles;
}

// Keep browser copies revalidating; share the short-lived response at Netlify.
const discoveryCache = {
  'Cache-Control': 'public, max-age=0, must-revalidate',
  'Netlify-CDN-Cache-Control': 'public, durable, max-age=120',
};
module.exports = { loadDiscoveryArticles, discoveryCache };
