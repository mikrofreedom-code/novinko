// POROVNANIE MODELOV NA ROVNAKOM VSTUPE — rozhodovací nástroj, nie pipeline.
//
//   node --env-file=.env scripts/compare-models.mjs [počet] [model…]
//   node --env-file=.env scripts/compare-models.mjs 5 anthropic:claude-sonnet-4-6 gemini:gemini-3.8-flash
//
// Vezme POSLEDNÉ reálne facts JSON z fronty (to isté, čo dostal Writer naostro),
// pustí ich cez každý model a vypíše výsledky vedľa seba + súhrn.
//
// NIČ NEZAPISUJE do fronty ani do hárku. Volania sa logujú do ai_cost_log pod
// agentom 'compare' — teda sa počítajú do denného rozpočtu (to je zámer, test
// nesmie prejsť cez strop) a zároveň neskreslia analýzu produkčných nákladov.
//
// ČO SA MERIA: nie „páči sa mi to", ale čísla, ktoré rozhodujú o cene za
// PUBLIKOVANÝ článok:
//   • JSON ok/fail   — Sonnet baseline je 2,7 % zlyhaní (9 z 329 za 30 dní,
//                      merané 3.9.2026). Model, ktorý padá častejšie, si každé
//                      zlyhanie zaplatí druhým plným volaním — a jeho nižšia
//                      cena za token sa tým zje.
//   • truncated      — urezané na limite tokenov (iná porucha než zlý JSON)
//   • tokeny a $     — skutočný náklad na tento konkrétny výstup

import { db } from '../lib/_shared/queue.js';
import { askFull } from '../lib/_shared/ai-gateway.js';
import { WRITER_SYSTEM, factsForPrompt } from '../lib/flow/07-writer.js';
import { parseModelJson } from '../lib/_shared/json.js';

const POCET = Number(process.argv[2] ?? 3);
const MODELY = process.argv.slice(3);
if (MODELY.length < 1) {
  console.error('Zadaj aspoň jeden model, napr.:\n'
    + '  node --env-file=.env scripts/compare-models.mjs 3 anthropic:claude-sonnet-4-6 gemini:gemini-3.8-flash');
  process.exit(1);
}

const ciara = (t) => console.log(`\n${'═'.repeat(76)}\n${t}\n${'═'.repeat(76)}`);
const kratko = (s, n = 300) => (s ?? '').replace(/\s+/g, ' ').slice(0, n);

// ---------- vstupy: reálne facts z fronty ----------
const { data: items, error } = await db.from('queue')
  .select('id, facts, created_at')
  .not('facts', 'is', null)
  .order('created_at', { ascending: false })
  .limit(POCET);
if (error) { console.error('Nepodarilo sa načítať frontu:', error.message); process.exit(1); }

const vzorka = (items ?? []).filter((it) => Array.isArray(it.facts?.facts) && it.facts.facts.length > 0);
if (!vzorka.length) { console.error('Vo fronte nie sú položky s faktami.'); process.exit(1); }

console.log(`vzorka: ${vzorka.length} položiek × ${MODELY.length} modelov = ${vzorka.length * MODELY.length} volaní`);

const suhrn = new Map(MODELY.map((m) => [m, { ok: 0, jsonFail: 0, truncated: 0, chyba: 0, inTok: 0, outTok: 0 }]));

for (const [i, item] of vzorka.entries()) {
  const fc = item.facts;
  ciara(`[${i + 1}/${vzorka.length}]  ${fc.entity ?? '—'}  ·  ${fc.event_type ?? '—'}  ·  sekcia ${fc.section ?? 'krypto'}`);
  const prompt = factsForPrompt(fc);

  for (const spec of MODELY) {
    const s = suhrn.get(spec);
    try {
      const res = await askFull({
        tier: 'smart', model: spec, agent: 'compare', queueId: item.id,
        system: WRITER_SYSTEM, prompt, maxTokens: 2200, temperature: 0.4,
      });
      const pokus = parseModelJson(res.text);
      if (res.truncated) s.truncated++;

      if (pokus.ok) {
        s.ok++;
        const a = pokus.value;
        console.log(`\n── ${spec} ── JSON ✅${res.truncated ? '  ⚠️ urezané' : ''}`);
        console.log(`   TITULOK: ${a.headline}`);
        console.log(`   PEREX:   ${kratko(a.perex, 200)}`);
        console.log(`   TELO:    ${kratko(a.body, 400)}…`);
        console.log(`   atribúcia použitá: ${a.attribution_used === true ? 'ÁNO' : 'NIE'}`);
      } else {
        s.jsonFail++;
        console.log(`\n── ${spec} ── JSON ❌ (${res.truncated ? 'urezané na limite' : 'nevalidný'})`);
        console.log(`   ${kratko(res.text, 200)}`);
      }
    } catch (err) {
      s.chyba++;
      console.log(`\n── ${spec} ── CHYBA: ${err.message}`);
    }
  }
}

// ---------- súhrn ----------
ciara('SÚHRN');
console.log('model'.padEnd(38) + 'JSON ok'.padStart(9) + 'JSON fail'.padStart(11) + 'urezané'.padStart(9) + 'chyba'.padStart(7));
for (const [spec, s] of suhrn) {
  console.log(spec.padEnd(38)
    + String(s.ok).padStart(9)
    + String(s.jsonFail).padStart(11)
    + String(s.truncated).padStart(9)
    + String(s.chyba).padStart(7));
}

// Náklad ber z ai_cost_log — je to to isté číslo, aké uvidíš v rozpočte,
// nie vlastný prepočet, ktorý by sa mohol rozísť s cenníkom.
const { data: naklady } = await db.from('ai_cost_log')
  .select('model, cost_usd, input_tokens, output_tokens')
  .eq('agent', 'compare')
  .gte('created_at', new Date(Date.now() - 3600e3).toISOString());

if (naklady?.length) {
  const podlaModelu = new Map();
  for (const r of naklady) {
    const p = podlaModelu.get(r.model) ?? { usd: 0, n: 0, inT: 0, outT: 0 };
    p.usd += Number(r.cost_usd); p.n++; p.inT += r.input_tokens; p.outT += r.output_tokens;
    podlaModelu.set(r.model, p);
  }
  console.log('\nnáklad (posledná hodina, agent=compare):');
  for (const [model, p] of podlaModelu) {
    console.log(`   ${model.padEnd(35)} $${p.usd.toFixed(4)}  za ${p.n} volaní`
      + `  (${p.inT} in / ${p.outT} out tokenov, $${(p.usd / p.n).toFixed(4)}/volanie)`);
  }
}

console.log('\nLatka na prepnutie: JSON fail ≤ 3 % (Sonnet baseline 2,7 %).');
console.log('Pri malej vzorke je jedno zlyhanie veľa — na rozhodnutie chceš desiatky položiek, nie tri.');
