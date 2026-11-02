const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { loadDiscoveryArticles } = require('../netlify/lib/discovery-articles');
const { handler: sitemap } = require('../netlify/functions/sitemap');
const { handler: news } = require('../netlify/functions/news-sitemap');
const { renderHome } = require('../netlify/lib/home-discovery');
const template = require('../netlify/lib/home-template.cjs');
const store = require('../netlify/lib/store');
const now = Date.now();
const article = (id, hours, extra = {}) => ({ id: String(id), title: `Článok ${id}`,
  perex: 'Opis správy', date: new Date(now - hours * 3600000).toISOString(), category: 'ai', ...extra });
function csv(items) {
  return [['id', 'title', 'perex', 'content', 'source', 'date', 'category', 'imageUrl', 'imageCredit', 'metadata_json'],
    ...items.map(a => [a.id, a.title, a.perex, 'Text', 'Novinko', a.date, a.category, '', '', JSON.stringify(a.mystery || {})])]
    .map(row => row.map(v => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n');
}
test('discovery loads published CSV rows, sorts them, excludes invalid/future dates, preserves stable mystery slugs', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(csv([
    article(100001, 5), article(100002, -1), article(100003, 2, { date: 'invalid' }),
    article(100004, 1, { category: 'zahady', mystery: { slug: 'trvala-adresa' } }),
  ])));
  const rows = await loadDiscoveryArticles(now);
  assert.deepEqual(rows.map(a => a.id), ['100004', '100001']);
  assert.equal(rows[0].mystery.slug, 'trvala-adresa');
});
test('homepage HTML contains the 20 latest links before JS, honours category and escapes untrusted content', () => {
  const rows = Array.from({ length: 25 }, (_, i) => article(100000 + i, i, { category: i % 2 ? 'ai' : 'krypto' }));
  rows[0].title = '<img src=x onerror=alert(1)> $&';
  rows[0].perex = '<script>alert(1)</script>';
  const html = renderHome(template.html, rows);
  const markup = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  assert.equal((markup.match(/href="https:\/\/novinko.sk\/clanok\//g) || []).length, 20);
  assert.doesNotMatch(markup, /<img src=x|<script>alert/);
  assert.match(markup, /&lt;img/);
  assert.match(markup, /\$&amp;/);
  assert.doesNotMatch(markup, /server:hero|server:latest/);
  const category = renderHome(template.html, rows, 'ai').split('</main>')[0];
  assert.match(category, /Umelá inteligencia<\/h1>/);
  assert.doesNotMatch(category, /clanok-100000/);
  assert.match(category, /clanok-100001/);
});
test('server rendering does not change inline scripts or the generated CSP hashes', () => {
  const html = renderHome(template.html, [article(100001, 1)]);
  for (const match of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    assert.ok(template.csp.includes("'sha256-" + createHash('sha256').update(match[1]).digest('base64') + "'"));
  }
  assert.ok(!fs.existsSync('_site/home-template.cjs'));
});
test('new publication appears in homepage, main sitemap and news sitemap on the next origin read, without a build', async t => {
  let items = [article(100001, 3)];
  t.mock.method(globalThis, 'fetch', async () => new Response(csv(items)));
  const { default: home } = await import('../netlify/functions/home.mjs');
  let response = await home(new Request('https://novinko.sk/'));
  assert.equal(response.status, 200);
  assert.doesNotMatch(await response.text(), /clanok-100002/);
  items = [article(100002, 1), ...items];
  response = await home(new Request('https://novinko.sk/?utm_source=test'));
  assert.match(await response.text(), /clanok-100002/);
  assert.match((await sitemap()).body, /clanok-100002/);
  assert.match((await news()).body, /clanok-100002/);
  assert.equal(response.headers.get('Netlify-Vary'), 'query=rubrika');
  assert.equal(response.headers.get('Content-Security-Policy'), template.csp);
  assert.match(response.headers.get('Netlify-CDN-Cache-Control'), /max-age=120/);
});
test('main sitemap retains old articles and uses real modification dates, not the request date', async t => {
  const changed = new Date(now - 3600000).toISOString();
  t.mock.method(globalThis, 'fetch', async () => new Response(csv([
    article(100001, 1000), article(100002, 200, { category: 'zahady', mystery: { updatedAt: changed } }),
  ])));
  const response = await sitemap();
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /clanok-100001/);
  assert.ok(response.body.includes(`<lastmod>${changed}</lastmod>`));
  assert.match(response.headers['Netlify-CDN-Cache-Control'], /max-age=120/);
});
test('homepage reads the prepared snapshot without downloading the CSV; existing cache supports the first deploy', async t => {
  const { default: home } = await import('../netlify/functions/home.mjs');
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Must not download CSV'); });
  const snapshot = t.mock.method(store, 'loadNews', async key => key === 'discovery' ? { items: [article(100001, 1)] } : null);
  let response = await home(new Request('https://novinko.sk/'));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /clanok-100001/);
  snapshot.mock.restore();
  t.mock.method(store, 'loadNews', async key => key === 'all' ? { items: [
    { id: '100002', title: 'Staršia cache', source: 'tím Novinko', pubDate: article(0, 1).date, category: 'ai' },
    { id: '100003', title: 'Externá správa', source: 'RSS', pubDate: article(0, 1).date, category: 'ai' },
  ] } : null);
  response = await home(new Request('https://novinko.sk/'));
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /starsia-cache-100002/);
  assert.doesNotMatch(html, /externa-sprava-100003/);
});
test('news sitemap excludes old/future articles and caps the newest list at 1,000', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(csv([
    article(900001, 49), article(900002, -1),
    ...Array.from({ length: 1005 }, (_, i) => article(100000 + i, 1 + i / 1000)),
  ])));
  const response = await news();
  assert.equal((response.body.match(/<news:news>/g) || []).length, 1000);
  assert.doesNotMatch(response.body, /900001|900002|101004/);
});
test('upstream failures, empty exports and invalid exports produce uncached retryable responses, not empty sitemaps', async t => {
  const { default: home } = await import('../netlify/functions/home.mjs');
  t.mock.method(console, 'error', () => {});
  for (const result of [() => new Response('down', { status: 503 }), () => new Response('<html>error</html>'), () => new Response(csv([]))]) {
    const mock = t.mock.method(globalThis, 'fetch', async () => result());
    for (const handler of [sitemap, news]) {
      const response = await handler();
      assert.equal(response.statusCode, 503);
      assert.equal(response.headers['Cache-Control'], 'no-store');
      assert.equal(response.headers['Retry-After'], '120');
    }
    const response = await home(new Request('https://novinko.sk/'));
    assert.equal(response.status, 503);
    assert.match(await response.text(), /href="\/archiv"/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    mock.mock.restore();
  }
});
