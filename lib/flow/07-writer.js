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
import { tryPriceTemplate, tryTvlTemplate, trySentimentTemplate } from '../_shared/price-template.js';
import { liveFor } from '../sections/index.js';

export const STAGE = {
  index: 7,
  name: "Writer",
  input: "clustered",
  output: "written",
};

const AGENT = '07-writer';

export const WRITER_SYSTEM = `Si slovenský spravodajský redaktor pre krypto denník. Píšeš pre bežného čitateľa.
Dostaneš IBA štruktúrované fakty (JSON). NIKDY si nevymýšľaj nič, čo nie je vo faktoch.
Píš pôvodný, čitateľný spravodajský text v slovenčine. Výstup je IBA validný JSON, bez code fences, bez prózy navyše.
Schéma výstupu: {"headline": string, "perex": string, "body": string, "attribution_used": boolean}

ŠTÝL (dôležité):
- Píš ĽUDSKOU, plynulou rečou — ako novinár, nie ako technický výpis.
- Vysvetli, ČO sa stalo a PREČO to čitateľa zaujíma, nie zoznam údajov.
- NEUVÁDZAJ všetky čísla a technické detaily. Vyber len tie PODSTATNÉ pre čitateľa.
- VYNECHAJ technické drobnosti: hashe, digesty, identifikátory, presné čísla verzií
  (rc.0, beta, v2.52.1…), SHA, adresy kontraktov a podobné — bežný čitateľ ich nepotrebuje.
- Dôležité čísla (cena, percento, dátum, väčšia suma, počet) pokojne uveď; technický balast nie.
- DĹŽKA nech vyplýva z toho, koľko materiálu naozaj máš. Pri bohatom podklade
  (viac faktov, pozadie, citáty) napíš viacodsekový, substantívny článok ako
  seriózny denník — nie odflaknutú brevku na dve vety. Pri chudobnom podklade
  (1-2 fakty) ostaň krátky. NIKDY nepridávaj vatu ani opakovanie len preto,
  aby bol text dlhší — dĺžka je dôsledok materiálu, nie cieľ sám osebe.
- Štruktúra pri bohatšom podklade (voľne, nie rigidne): úvodný odsek (čo sa
  stalo + prečo je to dôležité) → pozadie/kontext, ak je → detaily → citáty,
  ak sú → širšie súvislosti/dôsledky.
- Smieš stručne a NEUTRÁLNE uviesť, čo subjekt je (napr. „oracle sieť", „burza"),
  ak to pomôže čitateľovi. ALE žiadne hodnotenia ani superlatívy, ktoré nie sú vo
  faktoch — NEPÍŠ „najväčší", „najrozšírenejší", „popredný" a podobne.

PRAVIDLÁ:
- Použi VÝHRADNE poskytnuté fakty. Nepridávaj žiadne vonkajšie poznatky ani dohady.
- "headline": výstižný SK titulok, max ~12 slov.
- "perex": 1–2 vety zhrnutia v SK.
- "body": telo v SK, krátke odseky (prázdny riadok medzi odsekmi). Žiadny markdown nadpis.
- Ak má fakt source_type "secondary", v texte ho MUSÍŠ atribuovať: „podľa {source_name}".
- "attribution_used": true ak si uviedol aspoň jednu „podľa {zdroj}" atribúciu.
- Neutrálny tón, žiadny marketing, žiadne hodnotenie.

FAKTY S "kind":
- kind="quote": doslovný citát s "quote_speaker" — vlož ho do JEDNODUCHÝCH
  úvodzoviek ' ... ' a jasne pripíš rečníkovi (napr. „X uviedol: 'citát'").
  NIKDY nepouži dvojité rovné úvodzovky " " okolo citátu — výstup je JSON
  a znak " vnútri textu by rozbil formát. NEPREPISUJ citát vlastnými slovami.
- kind="background": kontext o subjekte (čo firma/projekt je/robí) — použi na
  jeden-dva úvodné/vysvetľujúce odsahy, nech čitateľ bez predchádzajúcich
  znalostí chápe kontext. Nie je to hlavná správa, len pozadie.
- kind="fact" (predvolené): bežný atomický fakt ako doteraz.
- Viac faktov v podklade = viac reálneho materiálu na odseky. Použi ich všetky,
  ktoré dávajú zmysel, namiesto toho, aby si väčšinu ignoroval.`;

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
export function factsForPrompt(fc) {
  return JSON.stringify({
    entity: fc.entity ?? null,
    event_type: fc.event_type ?? 'other',
    attribution_required: fc.attribution_required === true,
    facts: (fc.facts ?? []).map((f) => ({
      kind: f.kind ?? 'fact',
      claim: f.claim,
      statement: f.statement ?? null,
      quote_speaker: f.quote_speaker ?? null,
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

  // Dátové udalosti (cena/TVL/nálada) → šablóna bez AI (lacné). Inak → Sonnet.
  let base = tryPriceTemplate(fc) || tryTvlTemplate(fc) || trySentimentTemplate(fc);

  if (!base) {
    const basePrompt = factsForPrompt(fc);
    // Občas model vloží citát v rovných úvodzovkách " ", čo rozbije JSON výstup
    // (viď WRITER_SYSTEM). Radšej než to nechať spadnúť na chybu, skús ešte raz
    // s explicitnou pripomienkou — lacnejšie než zahodiť celý cluster.
    let raw = await ask({
      tier: 'smart', agent: AGENT, queueId: item.id,
      system: WRITER_SYSTEM, prompt: basePrompt, maxTokens: 2200, temperature: 0.4,
    });
    let parsed;
    try {
      parsed = JSON.parse(stripFences(raw));
    } catch {
      raw = await ask({
        tier: 'smart', agent: AGENT, queueId: item.id,
        system: WRITER_SYSTEM,
        prompt: `${basePrompt}\n\n(Predošlý pokus vrátil nevalidný JSON — pravdepodobne kvôli rovným úvodzovkám " " okolo citátu. Over si, že v "body" nepoužívaš znak " nikde okrem okrajov JSON reťazcov.)`,
        maxTokens: 2200, temperature: 0.4,
      });
      try {
        parsed = JSON.parse(stripFences(raw));
      } catch {
        throw new Error(`Writer vrátil non-JSON aj po opakovaní: ${raw.slice(0, 200)}`);
      }
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
    section: fc.section ?? 'krypto',
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

// Koľko článkov maximálne napísať za jeden beh a NA SEKCIU (pri hodinovom crone
// = za hodinu na sekciu). Každá sekcia má vlastný slot → krypto neprebíja AI.
const MAX_PER_RUN = Number(process.env.MAX_ARTICLES_PER_RUN ?? 2);

// Vyber top `cap` položiek (podľa importance) v KAŽDEJ sekcii samostatne.
export function topPerSection(items, cap, sectionOf, importanceOf) {
  const by = new Map();
  for (const it of items) {
    const sec = sectionOf(it) ?? 'krypto';
    if (!by.has(sec)) by.set(sec, []);
    by.get(sec).push(it);
  }
  const out = [];
  for (const arr of by.values()) {
    arr.sort((a, b) => (importanceOf(b) ?? 0) - (importanceOf(a) ?? 0));
    out.push(...arr.slice(0, cap));
  }
  return out;
}

// ---------- Dávkové spracovanie fronty v stave `clustered` ----------
export async function runBatch(limit = 50) {
  // Zberový režim (AI_ENABLED=false): nepíš nič, vybrané položky nechaj čakať.
  if (process.env.AI_ENABLED === 'false') {
    const waiting = await claim(STAGE.input, limit);
    return { ok: 0, failed: 0, parked: waiting.length };
  }

  const items = await claim(STAGE.input, limit);
  // Sekcie, ktoré ešte nie sú 'live' (napr. AI pred nasadením webu): nepíš ich,
  // nechaj čakať v 'clustered' — žiadny Sonnet/obrázok/publish, kým sa neprepnú.
  const writable = items.filter((it) => liveFor(it.facts?.section ?? 'krypto'));
  const parked = items.length - writable.length;
  // ŠKRT: top N najdôležitejších PER SEKCIA (aby krypto neprebíjalo AI a ďalšie).
  const top = topPerSection(writable, MAX_PER_RUN, (it) => it.facts?.section, (it) => it.facts?.importance);

  const results = { ok: 0, failed: 0, skipped: Math.max(writable.length - top.length, 0), parked };
  for (const item of top) {
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
