// VEREJNÁ ČÍTACIA STRÁNKA — vygeneruje web/index.html (spravodajský web).
// Číta napísané články zo Supabase, žiadne AI, žiadny náklad.
//   node --env-file=.env scripts/web.mjs
import { db } from '../lib/_shared/queue.js';
import { writeFileSync, mkdirSync } from 'node:fs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dt = (s) => new Date(s).toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const CAT = {
  regulatory: ['Regulácia', '#d62828'], price_move: ['Trh', '#1d6fb8'],
  protocol_release: ['Technológie', '#6f42c1'], announcement: ['Oznámenie', '#2a9d4a'],
  governance: ['Governance', '#6c757d'], listing: ['Listing', '#e8820c'],
  tvl_shift: ['DeFi', '#0d9488'], other: ['Krypto', '#444'],
};
const cat = (et) => CAT[et] ?? CAT.other;

function bodyHtml(body) {
  return String(body ?? '').split(/\n\n+/).map((p) => `<p>${esc(p.trim())}</p>`).join('');
}

function card(r, featured = false) {
  const a = r.article;
  const [label, col] = cat(a.event_type);
  const src = (a.sources ?? []).map((s) => esc(s.name)).join(', ');
  const cls = featured ? 'card feat' : 'card';
  return `<article class="${cls}">
    <span class="cat" style="background:${col}">${label}</span>
    <h2>${esc(a.headline)}</h2>
    <p class="perex">${esc(a.perex ?? '')}</p>
    <details><summary>Čítať celé</summary><div class="body">${bodyHtml(a.body)}</div></details>
    <div class="meta">${dt(r.updated_at)} · zdroj: ${src || '—'}</div>
  </article>`;
}

// Editoriálne pravidlo: trhové (cenové) správy len pri VEĽKOM pohybe,
// inak je ich priveľa. Ostatné typy (regulácie, oznámenia…) vždy.
const MARKET_MIN_PCT = Number(process.env.WEB_MARKET_MIN_PCT ?? 10);
const changeOf = (facts) => {
  const f = (facts?.facts ?? []).find((x) => x.claim === 'change_24h_pct');
  return typeof f?.value === 'number' ? Math.abs(f.value) : null;
};

export async function generateWeb() {
  const { data } = await db.from('queue')
    .select('article, facts, updated_at')
    .eq('status', 'written').order('updated_at', { ascending: false }).limit(80);
  const arts = (data ?? []).filter((r) => r.article).filter((r) => {
    if (r.article.event_type === 'price_move') {
      const c = changeOf(r.facts);
      return c != null && c >= MARKET_MIN_PCT; // len veľké pohyby
    }
    return true; // ostatné správy vždy
  });

  const top = arts[0];
  const rest = arts.slice(1);

  const html = `<!doctype html><html lang="sk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Novinko — krypto spravodajstvo</title>
<style>
  :root{--ink:#16181d;--mut:#6b7280;--line:#e7e9ee;--bg:#f6f7f9;--acc:#0b5cad}
  *{box-sizing:border-box} body{margin:0;font:16px/1.6 Georgia,'Times New Roman',serif;color:var(--ink);background:var(--bg)}
  header{background:#0d1b2a;color:#fff;padding:22px 16px;text-align:center}
  header h1{margin:0;font:800 30px/1 system-ui,sans-serif;letter-spacing:-.5px}
  header .tag{color:#9fb3c8;font:13px/1 system-ui,sans-serif;margin-top:6px;text-transform:uppercase;letter-spacing:2px}
  .wrap{max-width:780px;margin:0 auto;padding:24px 16px}
  .card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px 20px;margin-bottom:16px}
  .card.feat{border-left:4px solid var(--acc)}
  .card.feat h2{font-size:26px}
  h2{font:700 21px/1.25 Georgia,serif;margin:8px 0 6px}
  .cat{display:inline-block;color:#fff;font:700 11px/1 system-ui,sans-serif;padding:4px 9px;border-radius:4px;text-transform:uppercase;letter-spacing:.5px}
  .perex{color:#2c2f36;margin:0 0 8px}
  details{margin:6px 0} summary{cursor:pointer;color:var(--acc);font:600 14px/1 system-ui,sans-serif}
  .body{margin-top:8px} .body p{margin:0 0 10px}
  .meta{color:var(--mut);font:13px/1 system-ui,sans-serif;margin-top:10px;border-top:1px solid var(--line);padding-top:10px}
  footer{text-align:center;color:var(--mut);font:13px/1.5 system-ui,sans-serif;padding:24px}
</style></head><body>
<header><h1>📰 Novinko</h1><div class="tag">Krypto spravodajstvo</div></header>
<div class="wrap">
  ${top ? card(top, true) : '<p>Zatiaľ žiadne články.</p>'}
  ${rest.map((r) => card(r)).join('')}
</div>
<footer>Novinko — automatizovaná krypto redakcia · ${arts.length} článkov · ${dt(new Date())}</footer>
</body></html>`;

  mkdirSync(new URL('../web', import.meta.url).pathname, { recursive: true });
  const out = new URL('../web/index.html', import.meta.url).pathname;
  writeFileSync(out, html);
  return { out, count: arts.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateWeb().then((r) => {
    console.log(`✅ Web vygenerovaný: ${r.out}  (${r.count} článkov)`);
    console.log(`\n   Otvor v prehliadači:  xdg-open ${r.out}`);
    process.exit(0);
  }).catch((e) => { console.error('❌', e); process.exit(1); });
}
