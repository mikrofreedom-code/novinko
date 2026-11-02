// News discovery: published articles from the last 48 hours, at most 1,000
// entries per Google's sitemap specification. Discovery does not guarantee indexing.
const { loadDiscoveryArticles, discoveryCache } = require('../lib/discovery-articles');
const { clanokUrl, esc } = require('../lib/clanok-render');
const XML = { 'Content-Type': 'application/xml; charset=utf-8' };

exports.handler = async () => {
  const now = Date.now();
  let articles;
  try { articles = await loadDiscoveryArticles(now); }
  catch (error) {
    console.error('[news-sitemap] Article export unavailable:', error.message);
    return { statusCode: 503, headers: { ...XML, 'Cache-Control': 'no-store', 'Retry-After': '120' },
      body: '<?xml version="1.0" encoding="UTF-8"?><error>Temporarily unavailable</error>' };
  }
  articles = articles.filter(article => Date.parse(article.date) >= now - 48 * 60 * 60 * 1000).slice(0, 1000);
  return {
    statusCode: 200,
    headers: { ...XML, ...discoveryCache },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${articles.map(article => `  <url>
    <loc>${esc(clanokUrl(article))}</loc>
    <news:news>
      <news:publication><news:name>Novinko</news:name><news:language>sk</news:language></news:publication>
      <news:publication_date>${esc(new Date(article.date).toISOString())}</news:publication_date>
      <news:title>${esc(article.title)}</news:title>
    </news:news>
  </url>`).join('\n')}
</urlset>
`,
  };
};
