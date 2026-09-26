// Lokálny náhľad konceptov. Nepripája sa k databáze a nepovoľuje publikovanie.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { renderClanok, esc } = require('../netlify/lib/clanok-render');
const { validateMystery } = require('../netlify/lib/zahady');
const root = path.resolve(__dirname, '..');
const draftDir = path.join(root, 'redakcia/content/zahady/start');
const drafts = fs.readdirSync(draftDir).filter(f => f.endsWith('.json') && !f.endsWith('.facts.json')).map((file, i) => {
  const draft = JSON.parse(fs.readFileSync(path.join(draftDir, file), 'utf8'));
  const slug = file.slice(0, -5);
  return { file, draft, article: { id: String(900000001 + i), title: draft.headline,
    perex: draft.perex, content: draft.text, category: 'zahady', date: '2026-09-26T12:00:00Z',
    imageUrl: new URL(draft.imageUrl).pathname, imageCredit: draft.imageCredit,
    mystery: { ...validateMystery(draft), slug } }, link: `/clanok/${slug}-${900000001 + i}` };
});
const banner = '<aside style="padding:14px;background:#fff1c9;color:#29251c;text-align:center;font:16px sans-serif">Lokálny náhľad • 3 nezverejnené koncepty • dátumy sú ukážkové. <a href="/koncepty">Koncepty a import</a></aside>';
function preview(html) {
  return html.replace(/<head>/i, '<head><meta name="robots" content="noindex,nofollow">').replace(/<body[^>]*>/i, m => m + banner);
}
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.webp':'image/webp', '.svg':'image/svg+xml', '.png':'image/png', '.ico':'image/x-icon' };
http.createServer((req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  const send = (status, type, body) => { res.writeHead(status, { 'Content-Type': type }); res.end(req.method === 'HEAD' ? undefined : body); };
  if (!['GET','HEAD'].includes(req.method)) return send(405, 'text/plain', 'V náhľade je publikovanie vypnuté.');
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return send(400, 'text/plain', 'Neplatná adresa'); }
  if (url === '/') { res.writeHead(302, { Location: '/zahady.html' }); return res.end(); }
  if (url === '/.netlify/functions/fetch-rss') return send(200, 'application/json', JSON.stringify({ items: drafts.map(({ draft, article, link }) => ({ title: article.title, description: article.perex, link, pubDate: article.date, image: article.imageUrl, imageCredit: article.imageCredit, mystery: article.mystery })) }));
  if (url === '/koncepty') return send(200, 'text/html; charset=utf-8', preview('<!doctype html><html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Koncepty Novinko</title></head><body><main style="max-width:800px;margin:40px auto;padding:20px;font:18px/1.6 sans-serif"><h1>Úvodné články</h1><p>Stiahni JSON, otvor redakciu a použi „Načítať pripravený koncept“. Import nič nezverejní. Publikovanie je v tomto lokálnom náhľade vypnuté.</p><ul>' + drafts.map(d => `<li><a href="${d.link}">${esc(d.article.title)}</a> — <a download href="/koncepty/${d.file}">stiahnuť JSON</a></li>`).join('') + '</ul><a href="/publikovat.html">Otvoriť redakciu</a> · <a href="/zahady.html">Rubrika</a></main></body></html>'));
  const draft = drafts.find(d => url === '/koncepty/' + d.file);
  if (draft) return send(200, 'application/json', JSON.stringify(draft.draft, null, 2));
  const article = drafts.find(d => d.link === url);
  if (article) return send(200, 'text/html; charset=utf-8', preview(renderClanok(article.article)));
  // Explicitný zoznam verejných súborov; žiadne .env, redakcia ani serverový kód.
  const publicRoot = /^\/[a-z0-9-]+\.(html|css|js|ico)$/.test(url) && ['.html','.css','.ico'].includes(path.extname(url));
  const asset = /^\/assets\/[a-zA-Z0-9_./-]+\.(webp|png|jpg|svg|css|js|woff2)$/.test(url) && !url.split('/').includes('..');
  const script = ['/share.js', '/promo.js'].includes(url);
  if (!publicRoot && !asset && !script) return send(404, 'text/plain', 'Nenájdené');
  const file = url === '/promo.js' ? path.join(root, 'netlify/lib/promo.js') : path.join(root, url.slice(1));
  try {
    const data = fs.readFileSync(file);
    send(200, types[path.extname(file)] || 'application/octet-stream', file.endsWith('.html') ? preview(data.toString()) : data);
  } catch { send(404, 'text/plain', 'Nenájdené'); }
}).listen(4174, '127.0.0.1', () => console.log('Náhľad: http://127.0.0.1:4174/zahady.html • koncepty: http://127.0.0.1:4174/koncepty'));
