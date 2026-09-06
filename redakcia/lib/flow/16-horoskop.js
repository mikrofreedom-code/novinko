// ============================================================
// 16. Horoskop — denný generátor (NIE facts-driven pipeline)
// ------------------------------------------------------------
// ROLA:          Raz denne napíše JEDEN článok — horoskop pre všetkých
//                12 znamení na dnešný dátum. Vstupom nie je RSS ani facts
//                JSON, ale dnešný dátum samotný — na rozdiel od Záhrady tu
//                nie je ani "plán tém", lebo téma je vždy tá istá (dnešok),
//                len obsah sa mení deň čo deň.
// VÝSTUP status: rovno 'proofed' — obchádza 01-08 zámerne, rovnaký dôvod
//                ako 15-zahrada.js: horoskop nemá fakty, ktoré by 08 mohol
//                overovať proti zdroju, a 05/06 nemajú z čoho extrahovať
//                udalosť. Celá reťaz 01-06 sa preto obchádza úplne.
// STAV:          🟢 MVP
// AI vrstva:     3 Sonnet (po 4 znameniach — viď "PREČO 3 VOLANIA" nižšie)
// ------------------------------------------------------------
// PREČO VLASTNÝ SPÚŠŤAČ: rovnaká úvaha ako pri Záhrade (BIBLIA-ZAHRADA.md
// kapitola 3) — horoskop nemá udalosti, nemá zdroje, nemá fakty. Je to čistá
// lifestylová fikcia (BIBLIA-HOROSKOP V1.0 kapitola 1: "nemá byť prezentovaný
// ako vedecká predpoveď ani ako isté tvrdenie o budúcnosti"). Rozdiel oproti
// Záhrade: Záhrada MÁ aspoň register reálnych inštitúcií (ÚKSÚP, SHMÚ) ako
// zdroj — horoskop nemá za sebou nič overiteľné, čo aj biblia sama priznáva.
// Presne preto je z celej pipeline vynechaná AJ 08-proofreader rovnako ako
// pri Záhrade a ZDROJE sa (rovnako ako tam) neskladajú z modelu, ale kódom
// — tu jednoducho fixná sebaatribúcia "Novinko — Horoskop", žiadny register
// netreba, lebo žiadna externá inštitúcia sa necituje.
//
// PREČO 3 VOLANIA PO 4 ZNAMENIACH, NIE JEDNO PO 12 (nájdené 6. 9. naživo):
// jedno volanie so všetkými 12 znameniami naraz (~2500-3500 slov výstupu)
// opakovane padalo na "Request timed out" aj po zdvihnutí AI_TIMEOUT_MS na
// 120s a raz aj na orezaný/nevalidný JSON pri maxTokens 4000 — model buď
// nestihol dokončiť generovanie, alebo ho zaťal strop tokenov uprostred.
// Namiesto naťahovania stropov ešte vyššie (krehké, len odsúva problém)
// je jednoduchšie generovanie rozdeliť: 3 kratšie, rýchle a spoľahlivé
// volania namiesto jedného na hrane limitov. Ako bonus menšia dávka = model
// sa v rámci nej menej opakuje (biblia kapitola 10: žiadne 2 znamenia
// nesmú znieť rovnako). Nadpis aj perex sa NEGENERUJÚ modelom vôbec —
// sú formulka (biblia kapitola 5 dáva rovno 3 príklady, "titulky možno
// obmieňať"), skladajú sa kódom nižšie, zadarmo a bez rizika.
//
// 09-legal (vlastný profil HOROSKOP_CHECKS), 11-image aj 12-publisher bežia
// ďalej nezmenené — len 09 má pre `section: 'horoskop'` vlastnú vetvu.
// Telegram schvaľovanie platí rovnako ako pre každý iný článok.
// ============================================================

import { db } from '../_shared/queue.js';
import { askFull } from '../_shared/ai-gateway.js';
import { parseModelJson } from '../_shared/json.js';

const AGENT = '16-horoskop';
const SRC = 'horoskop';

// Od ktorej hodiny smie generátor bežať. Skôr než Záhrada (9:00) — kto si
// horoskop číta, chce ho hneď ráno, nie až po obede. Po nočnej pauze
// (do 5:00, viď run-pipeline.mjs), s malým odstupom.
const GENERATOR_HOUR = Number(process.env.HOROSKOP_GENERATOR_HOUR ?? 6);

function dayKey(d = new Date()) { return d.toISOString().slice(0, 10); }

async function generovaneDnes() {
  const { data, error } = await db.from('queue')
    .select('id').eq('raw_data->>_src', SRC).eq('raw_data->>day', dayKey()).limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

// ---------- Znamenia, rozdelené na 3 dávky po 4 ----------
// Poradie presne podľa biblie kapitoly 3. Delenie na dávky je len technické
// (veľkosť volania) — poradie vo finálnom článku sa zachová spojením dávok
// za sebou, čitateľ rozdelenie nikdy neuvidí.
const ZNAMENIA = [
  '♈ Baran', '♉ Býk', '♊ Blíženci', '♋ Rak',
  '♌ Lev', '♍ Panna', '♎ Váhy', '♏ Škorpión',
  '♐ Strelec', '♑ Kozorožec', '♒ Vodnár', '♓ Ryby',
];
function dávky(zoznam, vPreDavku) {
  const out = [];
  for (let i = 0; i < zoznam.length; i += vPreDavku) out.push(zoznam.slice(i, i + vPreDavku));
  return out;
}
const ZNAMENIA_DAVKY = dávky(ZNAMENIA, 4);

// ---------- Nadpis a perex — FORMULKA, nie AI (zadarmo, spoľahlivo) ----------
// Biblia kapitola 5 sama dáva 3 príklady a hovorí "titulky možno obmieňať" —
// presne to, čo rotácia podľa dňa v mesiaci robí, bez rizika, že si model
// vymyslí clickbait alebo prekročí dĺžku.
const HEADLINE_TEMPLATES = [
  (d) => `Denný horoskop na ${d}: čo dnes čaká jednotlivé znamenia?`,
  (d) => `Horoskop na ${d}: ktorým znameniam môže dnešok priniesť nové príležitosti?`,
  (d) => `Denný horoskop na ${d}: láska, peniaze a energia jednotlivých znamení`,
];
const PEREX_TEMPLATES = [
  (d) => `Pozrite si denný horoskop pre všetkých 12 znamení zverokruhu na ${d}. Dnešok môže niekomu priniesť viac energie, inému potrebu spomaliť a premyslieť si ďalšie kroky. Čo môže čakať vaše znamenie v láske, práci a financiách?`,
  (d) => `Denný horoskop na ${d} pre všetkých 12 znamení. Niektoré znamenia dnes môžu cítiť príležitosť posunúť sa vpred, iné skôr potrebu venovať sa vzťahom alebo si oddýchnuť. Pozrite si, čo hviezdy naznačujú práve pre vaše znamenie.`,
];
function vyberPodlaDna(templates, datum) {
  return templates[datum.getDate() % templates.length];
}
function headlinePerex(datum) {
  const dnesTxt = datum.toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
  return {
    headline: vyberPodlaDna(HEADLINE_TEMPLATES, datum)(dnesTxt),
    perex: vyberPodlaDna(PEREX_TEMPLATES, datum)(dnesTxt),
  };
}

// ---------- Writer prompt (na JEDNU dávku 4 znamení) ----------
// Tvrdé zákazy nižšie sú PRVÁ vrstva (rovnaký princíp ako v 15-zahrada.js
// a BIBLIA-ZAHRADA.md kapitola 5 — "jedna vrstva nestačí, model inštrukciu
// občas obíde"). Druhá vrstva sú strojové kontroly v 09-legal.js
// (HOROSKOP_CHECKS).
const HOROSKOP_SYSTEM = `Si profesionálny lifestylový redaktor slovenského portálu Novinko. Píšeš úsek denného horoskopu pre PRESNE tie znamenia, ktoré dostaneš v zozname — nie pre všetky znamenia zverokruhu, len pre tie zadané.

Horoskop je zábavný lifestylový obsah, NIE veda ani istá predpoveď budúcnosti. Čitateľ má po prečítaní cítiť "pozriem sa, čo dnes píšu pre moje znamenie" — nie "horoskop mi povedal, čo sa mi určite stane".

Výstup je IBA validný JSON, bez code fences, bez prózy navyše.
Schéma výstupu: {"body": string}

ŠTÝL:
- Prirodzený, pozitívny, mierne tajomný tón — nie prehnane ezoterický, nie dramatický, nie katastrofický.
- Formulácie ako "môže", "oplatí sa", "dnešok môže priať", "môžete cítiť", "situácia môže priniesť". NIKDY isté tvrdenia: "určite sa stane", "hviezdy garantujú", "musíte", "stopercentne".
- Pri každom zo zadaných znamení INÝ obsah a INÁ vetná štruktúra — nikdy mierne prepísané varianty toho istého textu. Striedaj témy: rozhodovanie, komunikácia, práca, rodina, partnerstvo, nové kontakty, odpočinok, organizácia, kreativita, financie, motivácia, osobný rozvoj.
- "body": pre KAŽDÉ zo zadaných znamení presne v tomto tvare, oddelené prázdnym riadkom (blank line), žiadny markdown nadpis (##):

[znamenie presne tak, ako ti bolo zadané]
2-4 prirodzené vety opisujúce atmosféru dňa pre toto znamenie.
Láska: [1-5 hviezdičiek, napr. ⭐⭐⭐⭐☆] — krátke hodnotenie vzťahov a emócií.
Práca a peniaze: [hviezdičky] — krátke hodnotenie práce, kariéry, financií.
Energia: [hviezdičky] — krátke hodnotenie energie, tempa, osobnej pohody.
Rada dňa: jedna krátka praktická alebo povzbudzujúca veta.

- Hviezdičkové hodnotenia rozlož PRIRODZENE — nie stále rovnaký počet, nie samé 4-5 hviezdičiek. Občas aj slabšie hodnotenie (2-3 hviezdičky), nech to pôsobí úprimne, nie ako plošná pochvala.

TÉMY, KTORÝM SA VYHNÚŤ ÚPLNE (nielen zmierniť formuláciu — vôbec ich nespomínaj):
- konkrétne investičné rady (názov kryptomeny, akcie, "kúpte", "investujte do"), čísla lotérie alebo výhry v hazardných hrách,
- zdravotné diagnózy, predpovede choroby, nehody alebo smrti — namiesto toho len všeobecne "energia" alebo "pohoda", nanajvýš odporúčanie odpočinku/spánku/pohybu,
- isté tvrdenia o nevere alebo rozchode ("partner vás podvádza") — najviac jemné, otvorené formulácie typu "ak cítite, že medzi vami niečo zostalo nevypovedané, otvorený rozhovor môže priniesť viac jasno",
- tehotenské predpovede,
- konkrétne astronomické či astrologické udalosti (retrográdny Merkúr, spln, nov, konjunkcia planét a podobne) — nemáš k dispozícii overené astronomické dáta, takže si ich NEVYMÝŠĽAJ. Píš len všeobecne o "energii dňa" alebo "dnešnej atmosfére".

Nepridávaj žiadne redakčné upozornenie ani odriekanie na koniec — to pripája systém automaticky.`;

function buildPrompt(datum, znameniaVDavke) {
  const dnesTxt = datum.toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' });
  return `Dnešný dátum: ${dnesTxt}. Napíš horoskop presne pre tieto znamenia, v tomto poradí: ${znameniaVDavke.join(', ')}.`;
}

// Pevná redakčná poznámka — NEPÝTA sa modelu (rovnaký princíp ako ZDROJE
// v 15-zahrada.js: kritický text sa neponecháva na pravdepodobnosť, že ho
// model zopakuje verne, ale skladá sa kódom).
const DISCLAIMER = 'Horoskop je určený na zábavné a lifestylové účely. Nemal by byť považovaný za odborné, zdravotné, právne ani finančné odporúčanie.';

async function napisDavku(datum, znameniaVDavke) {
  const raw = await askFull({
    tier: 'smart',
    agent: AGENT,
    section: 'horoskop',
    system: HOROSKOP_SYSTEM,
    prompt: buildPrompt(datum, znameniaVDavke),
    // Zdvihnuté z 1400 na 2200 6. 9. — reálny test ukázal, že 1400 nestačilo
    // ani na 4 znamenia (druhá dávka sa orezala, truncated:true). Model píše
    // "2-4 vety" verbóznejšie, než odhad počítal. Stále ďaleko pod 60s
    // pôvodným timeoutom aj tokenovým stropom na rozdiel od jedného volania
    // na všetkých 12 naraz.
    maxTokens: 2200,
    // Vyššia teplota než pri Záhrade (0.5) — cieľom je, aby boli znamenia
    // skutočne odlišné, nie preformulovania tej istej vety.
    temperature: 0.8,
  });
  const pokus = parseModelJson(raw.text);
  if (!pokus.ok) {
    throw new Error(`dávka [${znameniaVDavke.join(', ')}] vrátila non-JSON (truncated=${raw.truncated}): ${raw.text.slice(0, 200)}`);
  }
  const telo = pokus.value?.body;
  if (!telo) throw new Error(`dávka [${znameniaVDavke.join(', ')}] vynechala "body"`);
  return String(telo).trim();
}

// ---------- Napíš dnešný horoskop (3 dávky sekvenčne) ----------
export async function napisHoroskop(datum = new Date()) {
  const casti = [];
  for (const davka of ZNAMENIA_DAVKY) {
    casti.push(await napisDavku(datum, davka));
  }
  const { headline, perex } = headlinePerex(datum);

  return {
    headline,
    perex,
    body: `${casti.join('\n\n')}\n\n${DISCLAIMER}`,
    section: 'horoskop',
    category: 'horoskop',
    sources: [{ name: 'Novinko — Horoskop', url: '', type: 'primary' }],
    generated_by: 'horoskop',
  };
}

// ---------- Vstupný bod pre pipeline ----------
export async function run({ force = false, dryRun = false } = {}) {
  const now = new Date();
  const hour = now.getHours();
  if (!force && hour < GENERATOR_HOUR) return { skipped: `pred ${GENERATOR_HOUR}:00` };
  if (!force && await generovaneDnes()) return { skipped: 'dnešný horoskop už existuje' };

  const article = await napisHoroskop(now);
  if (dryRun) return { dryRun: true, article };

  const { error } = await db.from('queue').insert({
    source_id: null,
    status: 'proofed',
    raw_data: { _src: SRC, day: dayKey(now) },
    // Rovnaká defenzívna vetva ako 15-zahrada.js — žiadny kód tu 09-legal
    // (HOROSKOP_CHECKS) nepotrebuje attribution_required, ale iné miesta
    // v pipeline môžu bez optional chainingu čítať item.facts.section.
    facts: { attribution_required: false, section: 'horoskop' },
    article,
  });
  if (error) throw error;
  return { ok: true, headline: article.headline };
}
