// Dynamic sitemap of published articles. Never advertise a truncated list as
// a successful response when the source Sheet is temporarily unavailable.
const { loadDiscoveryArticles, discoveryCache } = require('../lib/discovery-articles');
const { clanokUrl, esc, SITE } = require('../lib/clanok-render');
const XML = { 'Content-Type': 'application/xml; charset=utf-8' };

exports.handler = async () => {
  let articles;
  try { articles = await loadDiscoveryArticles(); }
  catch (error) {
    console.error('[sitemap] Article export unavailable:', error.message);
    return { statusCode: 503, headers: { ...XML, 'Cache-Control': 'no-store', 'Retry-After': '120' },
      body: '<?xml version="1.0" encoding="UTF-8"?><error>Temporarily unavailable</error>' };
  }
  const modified = article => {
    const value = article.mystery?.updatedAt || article.date;
    return Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : new Date(article.date).toISOString();
  };
  const latest = articles.reduce((date, article) => modified(article) > date ? modified(article) : date, '');
  return {
    statusCode: 200,
    headers: { ...XML, ...discoveryCache },
    body: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${latest}</lastmod></url>
  <url><loc>${SITE}/zahady.html</loc></url>
  <url><loc>${SITE}/archiv</loc><lastmod>${latest}</lastmod></url>
${articles.map(article => `  <url><loc>${esc(clanokUrl(article))}</loc><lastmod>${modified(article)}</lastmod></url>`).join('\n')}
</urlset>
`,
  };
};
