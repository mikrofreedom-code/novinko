// ============================================================
// 17. Recepty — sezónny/evergreen generátor (NIE facts-driven pipeline)
// ------------------------------------------------------------
// ROLA:          Raz denne napíše JEDEN recept z PLÁNU tém, nie z udalosti.
//                Vstupom nie je RSS ani facts JSON, ale osnova v
//                content/recepty/plan.md. Rovnaký architektonický vzor ako
//                15-zahrada.js — pozri jeho hlavičku pre plné zdôvodnenie
//                (prečo vlastný spúšťač, prečo sa obchádza aj 08-proofreader).
// VSTUP:         content/recepty/plan.md (nie queue status)
// VÝSTUP status: rovno 'proofed' — obchádza 01-07 AJ 08 zámerne.
// STAV:          🟢 MVP
// AI vrstva:     1 Sonnet (napíše recept z osnovy, štruktúrovaný JSON)
// ------------------------------------------------------------
// PREČO ŠTRUKTÚROVANÝ JSON (suroviny[]/postup[]), NIE VOĽNÝ TEXT: recept bez
// prehľadného zoznamu surovín a číslovaných krokov je na nič. Hárok ale nemá
// stĺpce na štruktúru (len A:I, telo je jedna bunka) — riešenie je rovnaké,
// aké si vynútila živá chyba pri Horoskope 7. 9.: `paragraphsToCell()`
// v article-row.js delí telo na `¶¶` podľa PRÁZDNYCH riadkov (`\n{2,}`), a
// keď je čo i len JEDEN taký riadok v texte, delí VŠADE — aj tam, kde model
// napísal len jednoduché zalomenie. Formátovanie preto NIKDY nerobí model
// (zabúda prázdne riadky), robí ho kód (formatRecept() nižšie), presne ako
// formatZnamenie() v 16-horoskop.js. recepty.html potom parsuje späť podľa
// predpony odseku ("Suroviny:", "Postup:"), rovnako ako horoskop.html.
// ============================================================

import { db } from '../_shared/queue.js';
import { askFull } from '../_shared/ai-gateway.js';
import { parseModelJson } from '../_shared/json.js';
import { loadPlan, ZDROJE } from '../_shared/recepty-plan.js';
import { jeVOkne, dniDoKoncaOkna } from '../_shared/recepty-plan.js';

const AGENT = '17-recepty';
const SRC = 'recepty';

// Rovnaká druhá brána ako 15-zahrada.js (GENERATOR_HOUR) — po rannom recape,
// nech má používateľ veci v Telegrame v rozumnom poradí. Vlastná premenná,
// nech sa dá časovanie oboch generátorov ladiť nezávisle.
const GENERATOR_HOUR = Number(process.env.RECEPTY_GENERATOR_HOUR ?? 10);

function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

// ---------- Ktoré slugy už NIEKEDY vznikli (bez ročného orezania) ----------
// Identický princíp ako 15-zahrada.js: slug je adresa navždy, kým nepribudne
// aktualizačný režim (rovnaké TODO pred 2027-01 platí aj tu).
async function pouziteSlugy() {
  const { data, error } = await db.from('queue')
    .select('raw_data')
    .eq('raw_data->>_src', SRC);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.raw_data?.slug).filter(Boolean));
}

async function generovaneDnes() {
  const { data, error } = await db.from('queue')
    .select('id').eq('raw_data->>_src', SRC).eq('raw_data->>day', dayKey()).limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

// ---------- Výber dnešnej témy (identické so 15-zahrada.js) ----------
export function vyberTemu(temy, usedSlugy, now = new Date()) {
  const kandidati = temy.filter((t) => jeVOkne(t.obdobie, now) && !usedSlugy.has(t.slug));
  if (!kandidati.length) return null;
  kandidati.sort((a, b) => {
    if (a.priorita !== b.priorita) return a.priorita - b.priorita;
    return dniDoKoncaOkna(a.obdobie, now) - dniDoKoncaOkna(b.obdobie, now);
  });
  return kandidati[0];
}

// ---------- Zdroje pre article.sources ----------
// Recepty na rozdiel od Záhrady necitujú externú inštitúciu — ZDROJE
// register (recepty-plan.js) je zámerne prázdny, len samoodkaz na rubriku.
function buildSources(topic) {
  const sources = [];
  for (const key of topic.zdroje) {
    const inst = ZDROJE[key];
    if (inst) sources.push({ name: inst.nazov, url: inst.url, type: 'primary' });
  }
  sources.push({ name: 'Novinko — Recepty', url: '', type: 'primary' });
  return sources;
}

// ---------- Writer prompt ----------
// Tvrdé zákazy nižšie sú PRVÁ vrstva, druhá vrstva sú strojové kontroly
// v 09-legal.js (RECEPTY_CHECKS) — rovnaká dvojvrstvová filozofia ako Záhrada.
// Na rozdiel od Záhrady sú TU čísla (gramáž, teplota, čas) ŽELANÉ, nie zakázané
// — recept bez presných množstiev je na nič. Zákaz presného dátumu zo Záhrady
// sa NEPREBERÁ, lebo tu nejde o klimaticky nepresvedčivé tvrdenie.
const RECEPTY_WRITER_SYSTEM = `Si skúsený slovenský redaktor rubriky Recepty na Novinku. Píšeš pre bežného domáceho kuchára, nie pre profesionálnu kuchyňu — praktický, vyskúšateľný recept, nie gastronomická báseň.

Dostaneš OSNOVU — heslovitý podklad, o aké jedlo ide a na čo dať dôraz. NIE je to hotový recept, je to zadanie. Vymysli z neho KONKRÉTNE množstvá surovín aj presný postup v krokoch — to je tvoja práca, osnova ich zámerne nedáva.

Výstup je IBA validný JSON, bez code fences, bez prózy navyše.
Schéma výstupu:
{
  "headline": string,
  "perex": string,
  "intro": string,
  "time_prep_min": number,
  "time_cook_min": number,
  "servings": number,
  "ingredients": [ { "mnozstvo": string, "nazov": string } ],
  "steps": [ string ]
}

"intro": 2-4 vety, prečo je jedlo dobré/kedy sa hodí — NIE opakovanie názvu, NIE zoznam surovín (ten ide zvlášť).
"time_prep_min": čas na prípravu (krájanie, miešanie) v minútach.
"time_cook_min": čas varenia/pečenia/dusenia v minútach. Keď sa jedlo nevarí ani nepečie (napr. studený dezert, smoothie), daj 0.
"servings": počet porcií ako celé číslo.
"ingredients": KAŽDÁ položka samostatne, "mnozstvo" obsahuje číslo aj jednotku spolu (napr. "400 g", "2 ks", "1 PL", "podľa chuti"), "nazov" je názov suroviny bez množstva. Poradie podľa použitia v postupe.
"steps": KAŽDÝ krok samostatná veta/dve, praktický a konkrétny (čo urobiť, ako dlho, akým spôsobom spoznať, že je to hotové). NEDÁVAJ číslo kroku na začiatok textu, to dopĺňa web sám.

NAJDÔLEŽITEJŠIE PRAVIDLO: text nesmie pôsobiť ako generovaný umelou inteligenciou. Píš prirodzene, ako niekto, kto tento recept naozaj varil.

ŠTÝL:
- Vykaj čitateľovi prirodzene, nie strojene.
- NIKDY nepoužívaj tieto typické AI formulácie: "V dnešnej dobe...", "Je dôležité si uvedomiť...", "Či už ste skúsený kuchár alebo začiatočník...", "Kľúčom k úspechu je...", "Bez ďalších okolkov...", "Tento recept vás nadchne...", ani prehnane nadšené marketingové frázy ("dokonalý", "božský", "úžasný" vo väčšine viet).
- "steps" majú znieť ako reálny postup, nie ako marketingový popis jedla.
- Vysvetli aj PREČO pri kľúčovom kroku (prečo studené maslo, prečo prepláchnuť quinou), keď to osnova naznačuje — kontext robí radu zapamätateľnú.

SEO — nadpis a perex rozhodujú, či sa recept vôbec zobrazí v Googli:
- "headline": prirodzený, konkrétny, obsahuje hlavnú surovinu/jedlo. Max ~12 slov. Nie klikbajt ("TOTO musíte vyskúšať!").
- "perex": 2-3 vety, fungujú aj samostatne vo výsledkoch vyhľadávania.

TVRDÉ ZÁKAZY (kontrolujú sa aj strojovo pred zverejnením — obídenie sa neoplatí, recept len spadne):
- ŽIADNY alkohol ako surovina (víno, rum, pivo, likér...) — ani v malom množstve.
- ŽIADNE surové/nedopečené jedlo (tatár, carpaccio, surové vajcia v krémoch bez tepelnej úpravy, sushi, domáca majonéza) — riziko salmonely/E. coli.
- ŽIADNE huby ako surovina.
- ŽIADNE domáce zaváranie, nakladanie na zimu, kvasenie ani fermentácia.
- ŽIADNA detská/dojčenská výživa.
- ŽIADNE zdravotné/liečivé tvrdenia o jedle ("posilňuje imunitu", "spaľuje tuk", "detoxikuje", "lieči"). Jedlo je jedlo, nie liek.
- Keď je v recepte surové mäso/hydina/ryba/vajcia, ASPOŇ JEDEN krok v "steps" MUSÍ obsahovať jasný znak prepečenia/uvarenia (napr. "kým mäso nie je vo vnútri celkom biele a šťava číra", "kým žĺtok nestuhne", "kým sa mäso ľahko nerozpadá vidličkou") — nielen čas, aj vizuálny/hmatový signál.
- ŽIADNA konkrétna značka výrobku/potraviny — len druhová kategória ("balzamikový ocot", nie názov konkrétnej fľaše).
- ŽIADNA rada, čo si má čitateľ kúpiť, ani výzva na kúpu.

PRED ODOVZDANÍM SI POLOŽ OTÁZKY: Dá sa podľa tohto postupu jedlo naozaj uvariť bez ďalších otázok? Je pri surovom mäse/vajciach jasný znak prepečenia? Znie text ako človek, ktorý recept naozaj varil, nie ako AI?`;

function buildPrompt(topic) {
  return `TÉMA (slug): ${topic.slug}\nKATEGÓRIA: ${topic.oblast}\n\nOSNOVA:\n${topic.osnova}`;
}

// ---------- Zostav telo článku z JSON (kód, nie model — viď hlavička súboru) ----------
function formatMnozstvo(i) {
  return `${i.mnozstvo ?? ''} ${i.nazov ?? ''}`.trim();
}
function formatMeta(a) {
  const casti = [`Príprava: ${a.time_prep_min} min`];
  if (Number(a.time_cook_min) > 0) casti.push(`Varenie: ${a.time_cook_min} min`);
  casti.push(`Porcie: ${a.servings}`);
  return casti.join(' · ');
}
// Ľudský štítok kategórie (recepty.sk vzor: malý štítok na karte, napr.
// "MLETÉ MÄSO"). Hárok nemá stĺpec na sub-kategóriu (rovnaké obmedzenie ako
// Záhrada — pozri CLAUDE.md, "Záhrada: oblasť/typ metadata sa nedostane na
// web") — namiesto zmeny schémy hárku sa štítok zakóduje ako ďalší ¶¶ odsek
// v tele, presne ako meta riadok (čas/porcie). recepty.html a clanok.js ho
// parsujú späť podľa predpony "Kategória:".
const OBLAST_LABELS = {
  'hlavne-jedla': 'Hlavné jedlá',
  polievky: 'Polievky',
  dezerty: 'Dezerty',
  'bezmasite-fit': 'Bezmäsité a fit',
};

function formatRecept(a, oblast) {
  const casti = [
    a.intro,
    `Kategória: ${OBLAST_LABELS[oblast] ?? oblast}`,
    formatMeta(a),
    'Suroviny:',
    ...a.ingredients.map(formatMnozstvo),
    'Postup:',
    ...a.steps.map((s, i) => `${i + 1}. ${String(s).trim()}`),
  ];
  return casti.filter(Boolean).join('\n\n');
}

// ---------- Napíš JEDEN recept ----------
export async function napisClanok(topic) {
  const raw = await askFull({
    tier: 'smart',
    agent: AGENT,
    section: 'recepty',
    system: RECEPTY_WRITER_SYSTEM,
    prompt: buildPrompt(topic),
    // Štruktúrovaný JSON so surovinami aj postupom potrebuje viac priestoru
    // než Záhrada (2400) — rovnaký dôvod na zdvihnutie, aký mala ona:
    // diakritika ~1.5-2 tokeny/slovo, orezaný JSON by pipeline zahodil.
    maxTokens: 2800,
    temperature: 0.5,
  });
  const pokus = parseModelJson(raw.text);
  if (!pokus.ok) {
    throw new Error(`Writer vrátil non-JSON: ${raw.text.slice(0, 200)}`);
  }
  const a = pokus.value;
  if (!a.headline || !a.intro) throw new Error('Writer vynechal headline alebo intro');
  if (!Array.isArray(a.ingredients) || !a.ingredients.length) throw new Error('Writer vynechal suroviny');
  if (!Array.isArray(a.steps) || !a.steps.length) throw new Error('Writer vynechal postup');

  return {
    headline: String(a.headline).trim(),
    perex: a.perex ? String(a.perex).trim() : null,
    body: formatRecept(a, topic.oblast),
    section: 'recepty',
    category: 'recepty',
    sources: buildSources(topic),
    generated_by: 'recepty',
    recepty_oblast: topic.oblast,
  };
}

// ---------- Vstupný bod pre pipeline ----------
export async function run({ force = false, dryRun = false } = {}) {
  const now = new Date();
  const hour = now.getHours();
  if (!force && hour < GENERATOR_HOUR) return { skipped: `pred ${GENERATOR_HOUR}:00` };
  if (!force && await generovaneDnes()) return { skipped: 'dnešný recept už existuje' };

  const temy = loadPlan();
  const used = await pouziteSlugy();
  const topic = vyberTemu(temy, used, now);
  if (!topic) return { skipped: 'žiadna téma v okne (alebo všetky použité)' };

  if (dryRun) return { dryRun: true, slug: topic.slug, oblast: topic.oblast };

  // Rovnaká brána ako 15-zahrada.js — AŽ TU, po výbere témy, nech dryRun
  // funguje aj so zapnutým zberovým režimom.
  if (process.env.AI_ENABLED === 'false') return { skipped: 'AI_ENABLED=false (zberový režim)', wouldPick: topic.slug };

  const article = await napisClanok(topic);

  const { error } = await db.from('queue').insert({
    source_id: null,
    status: 'proofed',
    raw_data: { _src: SRC, slug: topic.slug, day: dayKey(now) },
    facts: { attribution_required: false, section: 'recepty' },
    article,
  });
  if (error) throw error;

  return { written: topic.slug, headline: article.headline };
}
