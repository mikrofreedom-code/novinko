// ============================================================
// 07. Writer
// ------------------------------------------------------------
// ROLA:          Z faktov napíše ORIGINÁLNY SK článok. NIKDY nevidí pôvodné vety, len facts JSON. Drahý model, až na konci lievika.
// VSTUP status:  clustered
// VÝSTUP status: written
// STAV:          🟢 MVP
// AI vrstva:     3 Sonnet (tier 'smart')
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================
//
// LEGAL (CLAUDE.md → Legal architektúra, Model 2):
//   - Writer dostáva LEN `item.facts` (výstup 05/06). NIKDY zdrojový text.
//   - Píše ORIGINÁLNY slovenský text len z faktov; nič si nevymýšľa.
//   - Ak facts.attribution_required === true (medzi faktami je secondary zdroj),
//     článok MUSÍ uviesť „podľa {source_name}" pri danom tvrdení.
//
// KONTRAKT vstupu (`item.facts`, produkuje 05, zlúči 06):
//   {
//     entity, event_type, lang_source, attribution_required,
//     facts: [{ claim, statement, value, unit, source_name, source_url, source_type, confidence }]
//   }
// ============================================================

import { claim, advance } from '../_shared/queue.js';
import { ask } from '../_shared/ai-gateway.js';
import { tryPriceTemplate } from '../_shared/price-template.js';

export const STAGE = {
  index: 7,
  name: "Writer",
  input: "clustered",
  output: "written",
};

const AGENT = '07-writer';

const WRITER_SYSTEM = `Si slovenský spravodajský redaktor pre krypto denník.
Dostaneš IBA štruktúrované fakty (JSON). NIKDY si nevymýšľaj nič, čo nie je vo faktoch.
Píš pôvodný, neutrálny spravodajský text v slovenčine. Výstup je IBA validný JSON, bez code fences, bez prózy navyše.
Schéma výstupu: {"headline": string, "perex": string, "body": string, "attribution_used": boolean}
Pravidlá:
- Použi VÝHRADNE poskytnuté fakty. Nepridávaj žiadne vonkajšie poznatky, dohady ani kontext.
- "headline": výstižný SK titulok, max ~12 slov.
- "perex": 1–2 vety zhrnutia v SK.
- "body": telo článku v SK, krátke odseky (plain text, prázdny riadok medzi odsekmi). Žiadny markdown nadpis.
- Čísla uvádzaj presne tak, ako sú vo faktoch (value + unit).
- Ak má fakt source_type "secondary", v texte ho MUSÍŠ atribuovať: „podľa {source_name}".
- Fakty s source_type "primary" netreba menovite atribuovať (zhrnie ich zoznam zdrojov pod článkom).
- "attribution_used": true ak si v texte uviedol aspoň jednu „podľa {zdroj}" atribúciu.
- Neutrálny tón, žiadny marketing, žiadne hodnotenie.`;

function stripFences(s) {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

// Unikátne zdroje pre zoznam pod článkom (dedup podľa url).
function uniqueSources(facts) {
  const seen = new Map();
  for (const f of facts) {
    if (f.source_url && !seen.has(f.source_url)) {
      seen.set(f.source_url, {
        name: f.source_name ?? null,
        url: f.source_url,
        type: f.source_type ?? 'primary',
      });
    }
  }
  return [...seen.values()];
}

// Vstup pre model: kompaktné fakty, BEZ pôvodného textu (legálna hranica).
function factsForPrompt(fc) {
  return JSON.stringify({
    entity: fc.entity ?? null,
    event_type: fc.event_type ?? 'other',
    attribution_required: fc.attribution_required === true,
    facts: (fc.facts ?? []).map((f) => ({
      claim: f.claim,
      statement: f.statement ?? null,
      value: f.value ?? null,
      unit: f.unit ?? null,
      source_name: f.source_name ?? null,
      source_type: f.source_type ?? 'primary',
    })),
  }, null, 2);
}

// ---------- Spracuj JEDNU položku (cluster) ----------
export async function run(item) {
  const fc = item.facts;
  if (!fc || !Array.isArray(fc.facts) || fc.facts.length === 0) {
    throw new Error('item.facts chýba alebo je prázdne — Writer nemá z čoho písať');
  }

  // CENOVÝ POHYB → šablóna bez AI (lacné). Inak → Sonnet.
  let base = tryPriceTemplate(fc);

  if (!base) {
    const raw = await ask({
      tier: 'smart',
      agent: AGENT,
      queueId: item.id,
      system: WRITER_SYSTEM,
      prompt: factsForPrompt(fc),
      maxTokens: 1600,
      temperature: 0.4,
    });

    let parsed;
    try {
      parsed = JSON.parse(stripFences(raw));
    } catch {
      throw new Error(`Writer vrátil non-JSON: ${raw.slice(0, 200)}`);
    }
    if (!parsed.headline || !parsed.body) {
      throw new Error('Writer výstup nemá headline/body');
    }
    // Legálna poistka: ak boli potrebné atribúcie, ale model žiadnu neuviedol → chyba.
    if (fc.attribution_required && parsed.attribution_used !== true) {
      throw new Error('attribution_required, ale Writer neuviedol žiadnu atribúciu „podľa X"');
    }
    base = {
      headline: String(parsed.headline).trim(),
      perex: parsed.perex ? String(parsed.perex).trim() : null,
      body: String(parsed.body).trim(),
      attribution_used: parsed.attribution_used === true,
      generated_by: 'ai',
    };
  }

  const sources = uniqueSources(fc.facts);
  const article = {
    headline: base.headline,
    perex: base.perex ?? null,
    body: base.body,
    lang: 'sk',
    entity: fc.entity ?? null,
    event_type: fc.event_type ?? 'other',
    sources,
    attribution_used: base.attribution_used,
    generated_by: base.generated_by,            // 'template' alebo 'ai'
    word_count: base.body.trim().split(/\s+/).filter(Boolean).length,
    written_at: new Date().toISOString(),
  };

  await advance(item.id, STAGE.output, { article });
  return article;
}

// ---------- Dávkové spracovanie fronty v stave `clustered` ----------
export async function runBatch(limit = 10) {
  // Zberový režim (AI_ENABLED=false): nepíš nič, vybrané položky nechaj
  // čakať v stave 'clustered'. Až keď budeme vedieť články vidieť/publikovať,
  // zapneme písanie a backlog sa dopíše.
  if (process.env.AI_ENABLED === 'false') {
    const waiting = await claim(STAGE.input, limit);
    return { ok: 0, failed: 0, parked: waiting.length };
  }

  const items = await claim(STAGE.input, limit);
  const results = { ok: 0, failed: 0 };
  for (const item of items) {
    try {
      await run(item);
      results.ok++;
    } catch (err) {
      results.failed++;
      await advance(item.id, 'error', { error: `${AGENT}: ${err.message}` });
    }
  }
  return results;
}
