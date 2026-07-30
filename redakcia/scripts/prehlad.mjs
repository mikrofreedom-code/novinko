// PREHĽAD VYBRANÝCH SPRÁV — vygeneruje prehlad.html (otvoríš v prehliadači).
// Žiadne AI, žiadny náklad. Ukáže, čo robot považuje za dôležité.
//   node --env-file=.env scripts/prehlad.mjs
import { db } from '../lib/_shared/queue.js';
import { writeFileSync } from 'node:fs';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const metric = (facts, claim) => { const f = (facts?.facts ?? []).find((x) => x.claim === claim); return typeof f?.value === 'number' ? f.value : null; };
const nf = (x, d) => Number(x).toLocaleString('sk-SK', { minimumFractionDigits: d, maximumFractionDigits: d });
function fmtBig(x) { if (x == null) return ''; if (x >= 1e9) return `${nf(x / 1e9, 1)} mld. USD`; if (x >= 1e6) return `${nf(x / 1e6, 1)} mil. USD`; return `${nf(x, 0)} USD`; }
function fmtPrice(p) { const d = p >= 1000 ? 0 : p >= 1 ? 2 : p >= 0.01 ? 4 : 6; return `${nf(p, d)} USD`; }

function scoreBadge(score) {
  const s = Math.round(score ?? 0);
  const col = s >= 70 ? '#d62828' : s >= 50 ? '#e8820c' : '#6c757d';
  return `<span class="badge" style="background:${col}">${s}</span>`;
}

export async function generatePrehlad() {
  // 1) Vybrané dôležité (clustered) — prešli latkou, čakajú na napísanie
  const { data: selected } = await db.from('queue').select('facts, updated_at').eq('status', 'clustered').limit(200);
  const sel = (selected ?? []).map((r) => ({
    score: r.facts?.importance ?? 0, entity: r.facts?.entity, et: r.facts?.event_type,
    change: metric(r.facts, 'change_24h_pct'), price: metric(r.facts, 'price_usd'),
    mcap: metric(r.facts, 'market_cap_usd'), ts: r.updated_at,
  })).sort((a, b) => b.score - a.score);

  // 2) Textové správy zo zdrojov (collected, parkované) — regulátori navrch
  const { data: parked } = await db.from('queue').select('raw_data, created_at').eq('status', 'collected').limit(300);
  const texts = (parked ?? []).filter((r) => r.raw_data?._src === 'feed').map((r) => ({
    title: r.raw_data.title, source: r.raw_data.source_name, layer: r.raw_data.layer,
    reg: r.raw_data.layer === 'C', url: r.raw_data.source_url, ts: r.raw_data.published ?? r.created_at,
  })).sort((a, b) => (b.reg - a.reg) || (new Date(b.ts) - new Date(a.ts)));

  // 3) Už napísané články
  const { data: written } = await db.from('queue').select('article, facts, updated_at').eq('status', 'written').order('updated_at', { ascending: false }).limit(50);
  const arts = (written ?? []).filter((r) => r.article);

  // náklad dnes
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const { data: cost } = await db.from('ai_cost_log').select('cost_usd').gte('created_at', since.toISOString());
  const todayCost = (cost ?? []).reduce((s, x) => s + Number(x.cost_usd), 0);

  const rowsSel = sel.map((s) => {
    const info = s.et === 'price_move' && s.price != null
      ? `${s.change < 0 ? '▼' : '▲'} ${nf(Math.abs(s.change ?? 0), 1)} % · ${fmtPrice(s.price)}${s.mcap ? ' · ' + fmtBig(s.mcap) : ''}`
      : esc(s.et);
    return `<tr><td>${scoreBadge(s.score)}</td><td><b>${esc(s.entity)}</b></td><td>${info}</td><td class="muted">${esc(s.et)}</td></tr>`;
  }).join('');

  const rowsText = texts.map((t) => `<tr>
    <td>${t.reg ? '<span class="tag reg">REGULÁCIA</span>' : '<span class="tag proj">projekt</span>'}</td>
    <td><a href="${esc(t.url)}" target="_blank">${esc(t.title)}</a></td>
    <td class="muted">${esc(t.source)}</td></tr>`).join('');

  const cardsArt = arts.map((r) => `<div class="art">
    <div class="arth">${scoreBadge(r.facts?.importance)} <b>${esc(r.article.headline)}</b></div>
    <div class="muted">${esc(r.article.perex ?? '')}</div>
    <div class="src">${(r.article.sources ?? []).map((s) => esc(s.name)).join(', ')} · ${r.article.generated_by ?? '?'}</div></div>`).join('');

  const html = `<!doctype html><html lang="sk"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Novinko — prehľad vybraných správ</title>
<style>
  body{font:15px/1.5 system-ui,sans-serif;max-width:900px;margin:0 auto;padding:24px;color:#1a1a1a;background:#fafafa}
  h1{font-size:22px;margin:0 0 4px} h2{font-size:16px;margin:28px 0 8px;border-bottom:2px solid #eee;padding-bottom:4px}
  .sub{color:#888;margin-bottom:16px}
  table{width:100%;border-collapse:collapse} td{padding:7px 8px;border-bottom:1px solid #eee;vertical-align:top}
  .badge{color:#fff;border-radius:10px;padding:1px 8px;font-weight:700;font-size:13px}
  .muted{color:#999;font-size:13px} a{color:#0b5cad;text-decoration:none} a:hover{text-decoration:underline}
  .tag{font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px} .reg{background:#d62828;color:#fff} .proj{background:#e9ecef;color:#555}
  .art{padding:10px;border-bottom:1px solid #eee} .arth{margin-bottom:3px} .src{color:#aaa;font-size:12px;margin-top:3px}
  .stat{display:inline-block;background:#fff;border:1px solid #eee;border-radius:8px;padding:8px 14px;margin:4px 6px 0 0}
  .stat b{font-size:18px;display:block}
</style></head><body>
<h1>📰 Novinko — prehľad vybraných správ</h1>
<div class="sub">Vygenerované ${new Date().toLocaleString('sk-SK')} · zberový režim (robot vyberá, nepíše)</div>
<div>
  <span class="stat"><b>${sel.length}</b> vybraných udalostí</span>
  <span class="stat"><b>${texts.length}</b> textových správ čaká</span>
  <span class="stat"><b>${arts.length}</b> napísaných</span>
  <span class="stat"><b>$${todayCost.toFixed(2)}</b> dnešný náklad</span>
</div>

<h2>📌 Vybrané dôležité udalosti (pripravené, čakajú na napísanie)</h2>
${sel.length ? `<table>${rowsSel}</table>` : '<div class="muted">(zatiaľ žiadne — robot práve nič dôležité nevybral)</div>'}

<h2>🏛️ Textové správy zo zdrojov (regulácie navrch)</h2>
${texts.length ? `<table>${rowsText}</table>` : '<div class="muted">(žiadne textové správy v okne)</div>'}

<h2>✅ Už napísané články</h2>
${arts.length ? cardsArt : '<div class="muted">(žiadne)</div>'}
</body></html>`;

  const out = new URL('../prehlad.html', import.meta.url).pathname;
  writeFileSync(out, html);
  return { out, selected: sel.length, texts: texts.length, written: arts.length, todayCost };
}

// Priame spustenie: vygeneruj a vypíš.
if (import.meta.url === `file://${process.argv[1]}`) {
  generatePrehlad().then((r) => {
    console.log(`✅ Prehľad vygenerovaný: ${r.out}`);
    console.log(`   Vybraných: ${r.selected} · Textových čaká: ${r.texts} · Napísaných: ${r.written} · Náklad dnes: $${r.todayCost.toFixed(2)}`);
    console.log(`\n   Otvor v prehliadači:  xdg-open ${r.out}`);
    process.exit(0);
  }).catch((e) => { console.error('❌', e); process.exit(1); });
}
