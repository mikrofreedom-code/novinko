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

// Posledná poistka NAD znameniaZDavky() nižšie — tá už pri zlom AI výstupe
// nehádže (dopĺňa fallback), takže táto vetva by sa mala trafiť len pri
// niečom nepredvídanom (napr. chyba v samotnom kóde, nie v AI odpovedi). Bez
// stropu by sa pri takej chybe pipeline pokúšalo o celý (3-volaniový)
// horoskop znova KAŽDÚ hodinu až do polnoci. MAX_ATTEMPTS_PER_DAY=2 znamená:
// dnes to skúsime dvakrát, tretíkrát už nie — čaká sa na zajtrajší reset dayKey().
const MAX_ATTEMPTS_PER_DAY = Number(process.env.HOROSKOP_MAX_ATTEMPTS ?? 2);
const ATTEMPT_SRC = 'horoskop-attempt';

async function pokusovDnes() {
  const { data, error } = await db.from('queue')
    .select('id').eq('raw_data->>_src', ATTEMPT_SRC).eq('raw_data->>day', dayKey());
  if (error) throw error;
  return (data ?? []).length;
}

async function zapisNeuspesnyPokus(chyba) {
  const { error } = await db.from('queue').insert({
    source_id: null,
    status: 'error',
    raw_data: { _src: ATTEMPT_SRC, day: dayKey() },
    facts: { attribution_required: false, section: 'horoskop' },
    error: `${AGENT}: ${chyba.message}`,
  });
  if (error) throw error;
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
Schéma výstupu: {"znamenia": [{"nazov": string, "atmosfera": string, "laska": string, "praca": string, "energia": string, "rada": string}, ...]}
Presne JEDEN objekt v poli "znamenia" pre KAŽDÉ zo zadaných znamení, v zadanom poradí. KAŽDÉ pole je JEDEN krátky text bez odriadkovania — znak nového riadku nepatrí do žiadnej hodnoty, rozloženie do riadkov rieši systém, nie ty.

ŠTÝL:
- Prirodzený, pozitívny, mierne tajomný tón — nie prehnane ezoterický, nie dramatický, nie katastrofický.
- Formulácie ako "môže", "oplatí sa", "dnešok môže priať", "môžete cítiť", "situácia môže priniesť". NIKDY isté tvrdenia: "určite sa stane", "hviezdy garantujú", "musíte", "stopercentne".
- Pri každom zo zadaných znamení INÝ obsah a INÁ vetná štruktúra — nikdy mierne prepísané varianty toho istého textu. Striedaj témy: rozhodovanie, komunikácia, práca, rodina, partnerstvo, nové kontakty, odpočinok, organizácia, kreativita, financie, motivácia, osobný rozvoj.
- "nazov": znamenie presne tak, ako ti bolo zadané (so symbolom).
- "atmosfera": 2-4 prirodzené vety opisujúce atmosféru dňa pre toto znamenie.
- "laska": hodnotenie vzťahov a emócií, tvar "[1-5 hviezdičiek, napr. ⭐⭐⭐⭐☆] — krátky komentár".
- "praca": hodnotenie práce, kariéry, financií, rovnaký tvar "[hviezdičky] — krátky komentár".
- "energia": hodnotenie energie, tempa, osobnej pohody, rovnaký tvar "[hviezdičky] — krátky komentár".
- "rada": jedna krátka praktická alebo povzbudzujúca veta, bez hviezdičiek.
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

async function zavolajDavku(datum, znameniaVDavke, extraPokyn) {
  return askFull({
    tier: 'smart',
    agent: AGENT,
    section: 'horoskop',
    system: HOROSKOP_SYSTEM,
    prompt: buildPrompt(datum, znameniaVDavke) + (extraPokyn ? `\n\n${extraPokyn}` : ''),
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
}

// ---------- Núdzový obsah (KÓD, nie AI) — posledná poistka ----------
// "Nemôže zlyhať" v praxi neznamená skúšať donekonečna (to je len drahšie
// zlyhávanie, presne to sa stalo 8. 9.) — znamená, že KAŽDÉ jednotlivé
// znamenie dostane text: buď od modelu, alebo výnimočne z tohto vopred
// schváleného, konzervatívneho zásobníka. Rovnaký princíp ako DISCLAIMER a
// "sources" vyššie — kritické miesto sa nerieši spoliehaním sa, že model
// zareaguje správne aj na druhý pokus. Vety sú zámerne všeobecné, bez
// akejkoľvek konkrétnej udalosti — bezpečne prejdú HOROSKOP_CHECKS aj úplne
// bez AI, presne ako keby to napísal model podľa vlastných pravidiel vyššie.
const FALLBACK_ATMOSFERA = [
  'Dnešok môže priniesť pokojnejšie tempo, ktoré sa oplatí využiť na premyslenie ďalších krokov.',
  'Deň môže priať drobným, no užitočným rozhodnutiam — netreba riešiť všetko naraz.',
  'Môžete cítiť chuť posunúť veci vpred, aj keď nie všetko musí ísť presne podľa plánu.',
  'Atmosféra dňa môže byť vhodná na to, aby ste si urobili poriadok vo vlastných prioritách.',
];
const FALLBACK_HVIEZDICKY = ['⭐⭐☆☆☆', '⭐⭐⭐☆☆', '⭐⭐⭐⭐☆', '⭐⭐⭐⭐⭐'];
const FALLBACK_LASKA = ['pokojné, vyrovnané obdobie.', 'priestor na úprimný rozhovor.', 'trpezlivosť sa dnes oplatí.', 'chvíľa venovaná blízkym môže dnes padnúť vhod.'];
const FALLBACK_PRACA = ['dobrý deň na dokončenie rozbehnutého.', 'oplatí sa uprednostniť jednu vec pred viacerými naraz.', 'drobný pokrok sa dnes môže počítať viac než veľké plány.', 'organizácia dňa môže ušetriť energiu na neskôr.'];
const FALLBACK_ENERGIA = ['primeraná, bez väčších výkyvov.', 'oplatí sa nerozdrobiť ju na priveľa vecí naraz.', 'krátka prestávka počas dňa môže pomôcť.', 'lepšie využitá v pokojnejšom tempe.'];
const FALLBACK_RADA = ['Doprajte si dnes chvíľu len pre seba.', 'Skúste jeden malý krok namiesto veľkého rozhodnutia.', 'Otvorená komunikácia dnes pomôže viac než mlčanie.', 'Nechajte si priestor aj na oddych, nielen na povinnosti.'];

// `seed` (pozícia znamenia 0-11 posunutá o pár, aby sa polia v rámci jedného
// znamenia nezhodovali) mení výber medzi znameniami aj dňami bez toho, aby
// bol treba ďalší generátor náhody — deterministické, ale nie jednotvárne.
const vyberFallback = (zoznam, seed) => zoznam[((seed % zoznam.length) + zoznam.length) % zoznam.length];

function znamenieZFallbacku(nazov, seed) {
  return {
    nazov,
    atmosfera: vyberFallback(FALLBACK_ATMOSFERA, seed),
    laska: `${vyberFallback(FALLBACK_HVIEZDICKY, seed + 1)} — ${vyberFallback(FALLBACK_LASKA, seed + 1)}`,
    praca: `${vyberFallback(FALLBACK_HVIEZDICKY, seed + 2)} — ${vyberFallback(FALLBACK_PRACA, seed + 2)}`,
    energia: `${vyberFallback(FALLBACK_HVIEZDICKY, seed + 3)} — ${vyberFallback(FALLBACK_ENERGIA, seed + 3)}`,
    rada: vyberFallback(FALLBACK_RADA, seed + 4),
  };
}

const POLIA_ZNAMENIA = ['nazov', 'atmosfera', 'laska', 'praca', 'energia', 'rada'];
function jePlatnaPolozka(z) {
  return !!z && typeof z === 'object' && POLIA_ZNAMENIA.every((k) => typeof z[k] === 'string' && z[k].trim().length > 0);
}

function chybajuceZnamenia(pokus, znameniaVDavke) {
  if (!pokus.ok || !Array.isArray(pokus.value?.znamenia)) return znameniaVDavke;
  return znameniaVDavke.filter((nazov) => !jePlatnaPolozka(pokus.value.znamenia.find((z) => z?.nazov === nazov)));
}

function spatnaVazba(pokus, znameniaVDavke, chybajuce) {
  const dovod = pokus.ok
    ? `chýbajú alebo majú prázdne/neplatné polia: ${chybajuce.join(', ')}`
    : `JSON sa nedal spracovať (${pokus.chyba})`;
  return `(Predošlý pokus zlyhal — ${dovod}. Over si, že pole "znamenia" má presne jeden objekt pre KAŽDÉ zo zadaných znamení ${znameniaVDavke.join(', ')}, každý so všetkými poľami nazov/atmosfera/laska/praca/energia/rada ako NEPRÁZDNY text bez znaku nového riadku, a že "nazov" sedí presne so zadaním.)`;
}

// Nájdené 8. 9.: dávka [Strelec, Kozorožec, Vodnár, Ryby] vrátila dva dni po
// sebe nevalidný JSON. Predošlá oprava (retry s pripomienkou) len znížila
// cenu zlyhania — user chcel niečo, čo NEZLYHÁ, nie lacnejšie zlyhávanie.
// Tri vrstvy teraz namiesto jednej:
//   1. Schéma vyššie žiada KRÁTKE polia bez odriadkovania — model už nemusí
//      sám formátovať viacriadkový blok do JSON stringu (najčastejšia
//      príčina rozbitia), riadky skladá kód (formatZnamenie nižšie).
//   2. Keď aj tak dávka zlyhá (parse, alebo chýbajúce/prázdne znamenie),
//      retry TEJ ISTEJ dávky s KONKRÉTNOU spätnou väzbou (ktoré znamenie,
//      prečo) namiesto všeobecnej pripomienky — model má čo opraviť.
//   3. Keby zlyhal aj retry (pretrvávajúci problém, výpadok API), CHÝBAJÚCE
//      znamenia sa doplnia z fallback zásobníka. Táto funkcia už NEHÁDŽE
//      výnimku pri obsahových problémoch — horoskop sa publikuje VŽDY,
//      v najhoršom prípade s pár všeobecnejšími vetami namiesto AI textu.
async function znameniaZDavky(datum, znameniaVDavke, indexPrveho) {
  let znameniaOdAI = [];
  try {
    let raw = await zavolajDavku(datum, znameniaVDavke);
    let pokus = parseModelJson(raw.text);
    let chybajuce = chybajuceZnamenia(pokus, znameniaVDavke);
    if (chybajuce.length > 0) {
      raw = await zavolajDavku(datum, znameniaVDavke, spatnaVazba(pokus, znameniaVDavke, chybajuce));
      pokus = parseModelJson(raw.text);
    }
    if (pokus.ok && Array.isArray(pokus.value?.znamenia)) znameniaOdAI = pokus.value.znamenia;
  } catch (err) {
    console.warn(`${AGENT}: dávka [${znameniaVDavke.join(', ')}] zlyhala aj na úrovni volania (${err.message}) — dopĺňam z núdzového zásobníka`);
  }

  let pouzitFallback = 0;
  const vysledok = znameniaVDavke.map((nazov, i) => {
    const zhoda = znameniaOdAI.find((z) => z?.nazov === nazov);
    if (jePlatnaPolozka(zhoda)) return zhoda;
    pouzitFallback++;
    return znamenieZFallbacku(nazov, indexPrveho + i);
  });
  if (pouzitFallback > 0) {
    console.warn(`${AGENT}: ${pouzitFallback}/${znameniaVDavke.length} znamení v dávke [${znameniaVDavke.join(', ')}] je z núdzového zásobníka (AI výstup nebol použiteľný ani po opakovaní)`);
  }
  return vysledok;
}

// Skladá riadky znamenia KÓDOM, nie model — odstraňuje riziko, ktoré tu
// pôvodne riešila rozdeľRiadky() (model zabudne prázdny riadok medzi časťami
// znamenia, `paragraphsToCell()` v article-row.js potom zlepí celé znamenie
// do jednej vety, nájdené 7. 9. na živom článku). Keď riadky skladá kód,
// tento spôsob zlyhania štrukturálne nemôže nastať.
function formatZnamenie(z) {
  return [
    z.nazov,
    z.atmosfera,
    `Láska: ${z.laska}`,
    `Práca a peniaze: ${z.praca}`,
    `Energia: ${z.energia}`,
    `Rada dňa: ${z.rada}`,
  ].join('\n\n');
}

// ---------- Napíš dnešný horoskop (3 dávky sekvenčne) ----------
export async function napisHoroskop(datum = new Date()) {
  const casti = [];
  let indexPrveho = 0;
  for (const davka of ZNAMENIA_DAVKY) {
    const znamenia = await znameniaZDavky(datum, davka, indexPrveho);
    casti.push(...znamenia.map(formatZnamenie));
    indexPrveho += davka.length;
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
  if (!force) {
    const pokusy = await pokusovDnes();
    if (pokusy >= MAX_ATTEMPTS_PER_DAY) {
      return { skipped: `vzdané pre dnešok — ${pokusy} neúspešné pokusy (limit ${MAX_ATTEMPTS_PER_DAY})` };
    }
  }

  let article;
  try {
    article = await napisHoroskop(now);
  } catch (err) {
    if (!dryRun) await zapisNeuspesnyPokus(err);
    throw err;
  }
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
