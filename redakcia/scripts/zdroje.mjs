// KTORÝ ZDROJ SA OPLATÍ — koľko ktorý feed stojí a čo z neho reálne vyšlo.
//
//   node --env-file=.env scripts/zdroje.mjs
//
// Spája ai_cost_log.queue_id → queue.id, takže každý dolár vie priradiť
// konkrétnemu zdroju. Odpovedá na dve otázky naraz:
//   1. kam odchádza kredit
//   2. čo za to dostávame (koľko článkov sa naozaj zverejnilo)
//
// Kľúčové číslo je POSLEDNÝ stĺpec: cena za jeden zverejnený článok.
// Zdroj, ktorý stojí veľa a nič z neho nevyjde, je kandidát na vyhodenie.
//
// Nič nemení a nič nestojí.

import { db } from '../lib/_shared/queue.js';

const strankuj = async (tabulka, stlpce, uprav = (q) => q) => {
  const out = [];
  for (let od = 0; ; od += 1000) {
    const { data, error } = await uprav(db.from(tabulka).select(stlpce)).range(od, od + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
};

console.log('sťahujem náklady…');
const naklady = await strankuj('ai_cost_log', 'agent,cost_usd,queue_id');

// queue_id → náklad
const podlaId = new Map();
for (const r of naklady) {
  if (!r.queue_id) continue;
  const p = podlaId.get(r.queue_id) ?? { usd: 0, volani: 0 };
  p.usd += Number(r.cost_usd || 0);
  p.volani += 1;
  podlaId.set(r.queue_id, p);
}

console.log(`sťahujem položky fronty (${podlaId.size} s nákladom + všetky zverejnené)…`);
const ids = [...podlaId.keys()];
const polozky = [];
for (let i = 0; i < ids.length; i += 200) {
  const { data } = await db.from('queue').select('id,status,raw_data').in('id', ids.slice(i, i + 200));
  if (data) polozky.push(...data);
}
// zverejnené bez nákladu (napr. šablóny) tiež chceme započítať do výnosu
const zverejnene = await strankuj('queue', 'id,status,raw_data', (q) => q.eq('status', 'published'));
const videne = new Set(polozky.map((p) => p.id));
for (const z of zverejnene) if (!videne.has(z.id)) polozky.push(z);

// Zdroj: pri náhrobkoch (zamietnuté položky) je raw_data osekané a source_name
// v ňom už nie je — ostala len source_url. Bez prekladu domény späť na meno by
// sa ten istý feed rozpadol na dva riadky („Bitfinex Alpha" a
// „blog.bitfinex.com") a report by klamal: pri mene by sedeli články, pri
// doméne náklady bez článkov.
const { FEEDS } = await import('../lib/_shared/feeds.js');
const domenaNaMeno = new Map();
for (const f of FEEDS) {
  try { domenaNaMeno.set(new URL(f.url).hostname.replace(/^www\./, ''), f.name); } catch { /* nič */ }
}

const zdrojOf = (rd) => {
  if (rd?.source_name) return rd.source_name;
  if (rd?._src && rd._src !== 'feed') return rd._src;            // coingecko/defillama/feargreed
  if (rd?.source_url) {
    try {
      const h = new URL(rd.source_url).hostname.replace(/^www\./, '');
      return domenaNaMeno.get(h) ?? h;
    } catch { /* nič */ }
  }
  return '(neznámy)';
};

const per = new Map();
for (const p of polozky) {
  const z = zdrojOf(p.raw_data);
  const s = per.get(z) ?? { usd: 0, volani: 0, polozky: 0, zverejnene: 0, zamietnute: 0, chyby: 0 };
  const n = podlaId.get(p.id);
  if (n) { s.usd += n.usd; s.volani += n.volani; }
  s.polozky += 1;
  if (p.status === 'published') s.zverejnene += 1;
  else if (p.status === 'rejected' || p.status === 'merged') s.zamietnute += 1;
  else if (p.status === 'error') s.chyby += 1;
  per.set(z, s);
};

const riadky = [...per.entries()].sort((a, b) => b[1].usd - a[1].usd);
const spolu = riadky.reduce((s, [, v]) => s + v.usd, 0);
const clankySpolu = riadky.reduce((s, [, v]) => s + v.zverejnene, 0);

console.log(`\n${'zdroj'.padEnd(26)} ${'$'.padStart(8)} ${'podiel'.padStart(7)} ${'položiek'.padStart(9)} ${'článkov'.padStart(8)} ${'zahodené'.padStart(9)}  $/článok`);
console.log('─'.repeat(88));
for (const [z, v] of riadky) {
  if (v.usd === 0 && v.zverejnene === 0) continue;
  const naClanok = v.zverejnene ? `$${(v.usd / v.zverejnene).toFixed(3)}` : (v.usd > 0 ? '—  nič z toho' : '—');
  console.log(
    `${z.slice(0, 25).padEnd(26)} ${('$' + v.usd.toFixed(3)).padStart(8)} ${((v.usd / spolu * 100).toFixed(1) + '%').padStart(7)}`
    + ` ${String(v.polozky).padStart(9)} ${String(v.zverejnene).padStart(8)} ${String(v.zamietnute).padStart(9)}  ${naClanok}`,
  );
}
console.log('─'.repeat(88));
console.log(`${'SPOLU'.padEnd(26)} ${('$' + spolu.toFixed(3)).padStart(8)} ${''.padStart(7)} ${''.padStart(9)} ${String(clankySpolu).padStart(8)}`);

// ── kam ide kredit podľa KROKU ──
const perAgent = new Map();
for (const r of naklady) {
  const a = r.agent ?? '?';
  const s = perAgent.get(a) ?? { usd: 0, n: 0 };
  s.usd += Number(r.cost_usd || 0); s.n += 1;
  perAgent.set(a, s);
}
const spoluAg = [...perAgent.values()].reduce((s, v) => s + v.usd, 0);
console.log(`\nKAM IDE KREDIT PODĽA KROKU`);
console.log('─'.repeat(50));
for (const [a, v] of [...perAgent.entries()].sort((x, y) => y[1].usd - x[1].usd)) {
  console.log(`  ${a.padEnd(20)} ${String(v.n).padStart(5)}×  ${('$' + v.usd.toFixed(3)).padStart(8)}  ${(v.usd / spoluAg * 100).toFixed(1).padStart(5)} %`);
}

console.log(`\nAKO TO ČÍTAŤ`);
console.log('─'.repeat(50));
console.log('  „$/článok" je cena za jeden ZVEREJNENÝ článok z daného zdroja.');
console.log('  Zdroj s vysokou cenou a nulou článkov = platíš a nič z toho nemáš.');
console.log('  Zdroje s $0.000 sú číselné (CoinGecko/DefiLlama) — nestoja AI nič,');
console.log('  len zapĺňajú frontu; ich cena je miesto v DB, nie kredit.\n');
