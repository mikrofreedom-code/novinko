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
// STAV:          🟢 LIVE (večerná príprava + ranná aktivácia + fallback)
// AI vrstva:     najviac 3 Haiku (po 4 znameniach), bez plateného retry
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
// je jednoduchšie generovanie rozdeliť: 3 kratšie Haiku volania namiesto
// jedného na hrane limitov. Poškodená dávka sa už neopakuje za peniaze —
// chýbajúce znamenia okamžite doplní dátumovo obmieňaný fallback. Ako bonus menšia dávka = model
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
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const AGENT = '16-horoskop';
const SRC = 'horoskop';

// Od ktorej hodiny smie generátor bežať. Skôr než Záhrada (9:00) — kto si
// horoskop číta, chce ho hneď ráno, nie až po obede. Po nočnej pauze
// (do 5:00, viď run-pipeline.mjs), s malým odstupom.
const GENERATOR_HOUR = Number(process.env.HOROSKOP_GENERATOR_HOUR ?? 6);
// Horoskop nepotrebuje aktuálne dáta. O 20:00 preto pripravíme zajtrajší do
// lokálnej cache; ráno sa už len vloží do fronty bez čakania na AI a rozpočet.
const PREPARE_HOUR = Number(process.env.HOROSKOP_PREPARE_HOUR ?? 20);
const STATIC_IMAGE_URL = process.env.HOROSKOP_IMAGE_URL
  ?? 'https://novinko.sk/assets/horoskop-zverokruh.webp';
const CACHE_DIR = process.env.HOROSKOP_CACHE_DIR
  ?? fileURLToPath(new URL('../../drafts/horoskop-cache/', import.meta.url));

// Lokálny kalendárny deň, nie UTC. Pipeline aj redakčný dátum používajú čas
// Europe/Bratislava; ISO UTC by sa pri ručnom behu okolo polnoci mohol rozísť.
export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function posunDni(datum, pocet) {
  const out = new Date(datum);
  out.setDate(out.getDate() + pocet);
  return out;
}

async function generovanePreDen(day) {
  const { data, error } = await db.from('queue')
    .select('id,status,error').eq('raw_data->>_src', SRC).eq('raw_data->>day', day).limit(1);
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
Schéma výstupu: {"znamenia": [{"nazov": string, "atmosfera": string, "laska": string, "praca": string, "energia": string, "rada": string}, ...]}
Presne JEDEN objekt v poli "znamenia" pre KAŽDÉ zo zadaných znamení, v zadanom poradí. KAŽDÉ pole je JEDEN krátky text bez odriadkovania — znak nového riadku nepatrí do žiadnej hodnoty, rozloženie do riadkov rieši systém, nie ty.

ŠTÝL:
- Prirodzený, pozitívny, mierne tajomný tón — nie prehnane ezoterický, nie dramatický, nie katastrofický.
- Formulácie ako "môže", "oplatí sa", "dnešok môže priať", "môžete cítiť", "situácia môže priniesť". NIKDY isté tvrdenia: "určite sa stane", "hviezdy garantujú", "musíte", "stopercentne".
- Pri každom zo zadaných znamení INÝ obsah a INÁ vetná štruktúra — nikdy mierne prepísané varianty toho istého textu. Striedaj témy: rozhodovanie, komunikácia, práca, rodina, partnerstvo, nové kontakty, odpočinok, organizácia, kreativita, financie, motivácia, osobný rozvoj.
- "nazov": znamenie presne tak, ako ti bolo zadané (so symbolom).
- "atmosfera": 1-2 krátke prirodzené vety, spolu najviac 40 slov.
- "laska": hodnotenie vzťahov a emócií, tvar "[1-5 hviezdičiek, napr. ⭐⭐⭐⭐☆] — komentár najviac 12 slov".
- "praca": hodnotenie práce, kariéry, financií, rovnaký tvar, komentár najviac 12 slov.
- "energia": hodnotenie energie, tempa a pohody, rovnaký tvar, komentár najviac 12 slov.
- "rada": jedna praktická alebo povzbudzujúca veta, najviac 12 slov, bez hviezdičiek.
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

async function zavolajDavku(datum, znameniaVDavke) {
  return askFull({
    tier: 'cheap',
    agent: AGENT,
    section: 'horoskop',
    system: HOROSKOP_SYSTEM,
    prompt: buildPrompt(datum, znameniaVDavke),
    // Kratšia schéma má tvrdé slovné limity. 1400 tokenov tak ostáva s veľkou
    // rezervou, ale model neplatíme za pôvodné 2-4 vetné odseky.
    maxTokens: 1400,
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
  'Dnes sa môže oplatiť spojiť praktický prístup s trochou tvorivosti a neponáhľať sa.',
  'Bežný rozhovor môže priniesť zaujímavý podnet, ak mu venujete dostatok pozornosti.',
  'Dnešná atmosféra môže priať uzatváraniu drobných povinností aj novému začiatku.',
  'Pokojnejší pohľad na situáciu vám môže ukázať riešenie, ktoré predtým zostávalo bokom.',
];
const FALLBACK_HVIEZDICKY = ['⭐⭐☆☆☆', '⭐⭐⭐☆☆', '⭐⭐⭐⭐☆', '⭐⭐⭐⭐⭐'];
const FALLBACK_LASKA = [
  'pokojné a vyrovnané chvíle.', 'priestor na úprimný rozhovor.',
  'trpezlivosť sa dnes oplatí.', 'čas venovaný blízkym môže padnúť vhod.',
  'malé gesto môže zlepšiť atmosféru.', 'počúvanie dnes zaváži viac než rada.',
  'otvorenosť môže priniesť viac porozumenia.',
];
const FALLBACK_PRACA = [
  'dobrý deň na dokončenie rozbehnutého.', 'jedna priorita bude lepšia než priveľa úloh.',
  'drobný pokrok sa môže počítať viac než veľké plány.', 'organizácia môže ušetriť energiu na neskôr.',
  'praktické riešenie môže byť dnes najlepšie.', 'nový nápad si zaslúži pokojné posúdenie.',
  'sústredenie môže priniesť viditeľný výsledok.', 'rozvaha pomôže pri finančnom rozhodovaní.',
  'spolupráca môže urýchliť náročnejšiu úlohu.',
];
const FALLBACK_ENERGIA = [
  'primeraná, bez väčších výkyvov.', 'nerozdeľujte ju medzi priveľa vecí.',
  'krátka prestávka môže pomôcť.', 'lepšie sa využije v pokojnejšom tempe.',
  'môže postupne rásť počas dňa.', 'rovnováha medzi pohybom a pokojom prospeje.',
  'šetrite si čas aj na večerný oddych.', 'dobré tempo pomôže udržať sústredenie.',
];
const FALLBACK_RADA = [
  'Doprajte si dnes chvíľu len pre seba.', 'Skúste malý krok namiesto veľkého rozhodnutia.',
  'Otvorená komunikácia dnes pomôže viac než mlčanie.', 'Nechajte si priestor aj na oddych.',
  'Najskôr dokončite to, čo už máte rozbehnuté.', 'Všímajte si aj nenápadné dobré príležitosti.',
  'Dajte dôležitému rozhodnutiu trochu času.', 'Neporovnávajte svoje tempo s ostatnými.',
  'Jednoduché riešenie môže byť dnes najúčinnejšie.', 'Oceňte aj malý posun správnym smerom.',
  'Povedzte jasne, čo dnes potrebujete.',
];

// Seed odvodený z dátumu a znamenia mení výber medzi znameniami aj dňami bez
// generátora náhody — deterministické, ale nie jednotvárne.
const vyberFallback = (zoznam, seed) => zoznam[((seed % zoznam.length) + zoznam.length) % zoznam.length];

// Stabilný hash dátumu a znamenia: rovnaký deň sa dá bezpečne zopakovať, ale
// ďalší deň nevygeneruje tú istú núdzovú zostavu. Kombinácie polí majú stovky
// možností, hoci všetok text zostáva vopred schválený a bezplatný.
export function fallbackSeed(datum, nazov) {
  let hash = 2166136261;
  for (const ch of `${dayKey(datum)}|${nazov}`) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

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
// Rovnaké najrizikovejšie témy ako v 09-legal kontrolujeme už TU. Ak Haiku
// poruší prompt, nenecháme celý hotový deň neskôr zamietnuť — iba konkrétne
// znamenie nahradíme bezpečným fallbackom.
const NEBEZPECNY_OBSAH_RE = /(určite sa stane\w*|stopercentne|garantovan[ýáé]\w*|hviezdy garantujú|na sto percent|bez pochýb\w*|diagnóz\w*|ochoriet[ei]|ochorenie\w*|nehod\w*|úraz\w*|zomrie\w*|smrť\w*|infarkt\w*|rakovin\w*|mŕtvic\w*|otehotni\w*|tehotenstv\w*|čaká\s+dieťa|podvádza\s+v[áa]s|je\s+v[áa]m\s+nevern[áý]|nevern[áý]\s+partner\w*|rozíde\s+sa\s+s\s+vami|čaká\s+v[áa]s\s+rozchod|vyhráte\s+v\s+lot[ée]ri\w*|výherné\s+čísl\w*|stavte\s+na\b|tipujte\s+čísl\w*|(kúpte|investujte\s+do|nakúpte)\s+(bitcoin\w*|akci[ea]\w*|zlato|kryptomen\w*)|retrográdn\w*|spln(?![\p{L}])|splnu\b|splnom\b|nov\s+mesiac\w*|konjunkci\w*|Merkúr\w*|Venuš\w*|Mars(?![\p{L}])|Jupiter\w*|Saturn\w*|Urán\w*|Neptún\w*|vstupuje\s+do\b)/iu;

function maPlatneHviezdicky(value) {
  const [rating, komentar] = String(value).split(/\s+—\s+/, 2);
  return [...(rating ?? '')].length === 5
    && /^[⭐☆]+$/u.test(rating)
    && Boolean(komentar?.trim());
}

export function jePlatnaPolozka(z) {
  const zaklad = !!z && typeof z === 'object' && POLIA_ZNAMENIA.every((k) => (
    typeof z[k] === 'string'
    && z[k].trim().length > 0
    && z[k].length <= 500
    && !/[\r\n]/.test(z[k])
  ));
  if (!zaklad || NEBEZPECNY_OBSAH_RE.test(POLIA_ZNAMENIA.map((k) => z[k]).join(' '))) return false;
  return ['laska', 'praca', 'energia'].every((k) => maPlatneHviezdicky(z[k]));
}

// Presne JEDEN pokus na dávku. Platený retry poškodeného JSON-u 8. 9. zvýšil
// cenu bez záruky opravy; teraz sa nepoužiteľné jednotlivé znamenia okamžite
// doplnia bezpečným textom. Celý deň tak stojí najviac tri AI volania.
async function znameniaZDavky(datum, znameniaVDavke) {
  let znameniaOdAI = [];
  if (process.env.AI_ENABLED !== 'false') {
    try {
      const raw = await zavolajDavku(datum, znameniaVDavke);
      const pokus = parseModelJson(raw.text);
      if (!raw.truncated && pokus.ok && Array.isArray(pokus.value?.znamenia)) {
        znameniaOdAI = pokus.value.znamenia;
      } else {
        console.warn(`${AGENT}: dávka [${znameniaVDavke.join(', ')}] vrátila nepoužiteľný JSON — dopĺňam fallback bez plateného retry`);
      }
    } catch (err) {
      console.warn(`${AGENT}: dávka [${znameniaVDavke.join(', ')}] zlyhala (${err.message}) — dopĺňam z núdzového zásobníka`);
    }
  }

  let pouzitFallback = 0;
  const vysledok = znameniaVDavke.map((nazov) => {
    const zhoda = znameniaOdAI.find((z) => z?.nazov === nazov);
    if (jePlatnaPolozka(zhoda)) return zhoda;
    pouzitFallback++;
    return znamenieZFallbacku(nazov, fallbackSeed(datum, nazov));
  });
  if (pouzitFallback > 0) {
    console.warn(`${AGENT}: ${pouzitFallback}/${znameniaVDavke.length} znamení v dávke [${znameniaVDavke.join(', ')}] je z núdzového zásobníka`);
  }
  return { znamenia: vysledok, fallback: pouzitFallback };
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
  let fallbackCount = 0;
  for (const davka of ZNAMENIA_DAVKY) {
    const { znamenia, fallback } = await znameniaZDavky(datum, davka);
    casti.push(...znamenia.map(formatZnamenie));
    fallbackCount += fallback;
  }
  const { headline, perex } = headlinePerex(datum);
  const model = fallbackCount === ZNAMENIA.length
    ? 'fallback'
    : fallbackCount > 0 ? 'haiku+fallback' : 'haiku';

  return {
    headline,
    perex,
    body: `${casti.join('\n\n')}\n\n${DISCLAIMER}`,
    section: 'horoskop',
    category: 'horoskop',
    sources: [{ name: 'Novinko — Horoskop', url: '', type: 'primary' }],
    generated_by: 'horoskop',
    generated_for: dayKey(datum),
    generation_meta: { model, fallback_count: fallbackCount },
    image_url: STATIC_IMAGE_URL,
    image_credit: 'Novinko / AI ilustrácia',
  };
}

export function jePlatnyHoroskop(article, expectedDay) {
  return article?.section === 'horoskop'
    && article.generated_for === expectedDay
    && typeof article.headline === 'string'
    && typeof article.perex === 'string'
    && typeof article.body === 'string'
    && ZNAMENIA.every((nazov) => article.body.includes(nazov));
}

function cachePath(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`neplatný deň cache: ${day}`);
  return `${CACHE_DIR}/${day}.json`;
}

async function citajPripraveny(day) {
  try {
    const parsed = JSON.parse(await readFile(cachePath(day), 'utf8'));
    if (jePlatnyHoroskop(parsed?.article, day)) return parsed.article;
    console.warn(`${AGENT}: cache ${day} je neplatná — pripravím ju znova`);
  } catch (err) {
    if (err.code !== 'ENOENT') console.warn(`${AGENT}: cache ${day} sa nedá načítať (${err.message})`);
  }
  return null;
}

async function ulozPripraveny(day, article) {
  if (!jePlatnyHoroskop(article, day)) throw new Error(`odmietnutý neúplný horoskop pre ${day}`);
  await mkdir(CACHE_DIR, { recursive: true });
  const ciel = cachePath(day);
  const docasny = `${ciel}.${process.pid}.tmp`;
  await writeFile(docasny, `${JSON.stringify({ prepared_at: new Date().toISOString(), article }, null, 2)}\n`, { mode: 0o600 });
  await rename(docasny, ciel); // atómové: ranný beh nikdy neuvidí polovicu JSON-u
}

async function vlozDoFronty(day, article) {
  const { error } = await db.from('queue').insert({
    source_id: null,
    status: 'proofed',
    raw_data: { _src: SRC, day },
    // Rovnaká defenzívna vetva ako 15-zahrada.js — žiadny kód tu 09-legal
    // (HOROSKOP_CHECKS) nepotrebuje attribution_required, ale iné miesta
    // v pipeline môžu bez optional chainingu čítať item.facts.section.
    facts: { attribution_required: false, section: 'horoskop' },
    article,
  });
  if (error) throw error;
}

// ---------- Vstupný bod pre pipeline ----------
export async function run({ force = false, dryRun = false, now = new Date() } = {}) {
  const hour = now.getHours();
  const dnes = dayKey(now);

  if (force) {
    const article = await napisHoroskop(now);
    if (dryRun) return { dryRun: true, action: 'generate-now', article };
    await vlozDoFronty(dnes, article);
    return { ok: true, action: 'generated-now', headline: article.headline };
  }

  if (hour < GENERATOR_HOUR) return { skipped: `pred ${GENERATOR_HOUR}:00` };

  // RÁNO: najprv aktivuj večer pripravený článok. Ak cache chýba (počítač bol
  // vypnutý), vyrob ho teraz; každá zlyhaná AI dávka má bezpečný fallback.
  if (!await generovanePreDen(dnes)) {
    const pripraveny = await citajPripraveny(dnes);
    const article = pripraveny ?? await napisHoroskop(now);
    if (dryRun) return { dryRun: true, action: pripraveny ? 'activate-cache' : 'generate-now', article };
    await vlozDoFronty(dnes, article);
    return { ok: true, action: pripraveny ? 'activated-cache' : 'generated-now', headline: article.headline };
  }

  // VEČER: priprav zajtrajší článok mimo ranného deadline a s takmer celým
  // priebežným rozpočtom. Cache sa zapisuje atómovo a pri chybe vloženia do DB
  // zostane zachovaná, takže ďalší hodinový beh už AI znova neplatí.
  if (hour >= PREPARE_HOUR) {
    const zajtraDatum = posunDni(now, 1);
    const zajtra = dayKey(zajtraDatum);
    if (await citajPripraveny(zajtra)) return { skipped: `horoskop na ${zajtra} je pripravený` };
    const article = await napisHoroskop(zajtraDatum);
    if (dryRun) return { dryRun: true, action: 'prepare-tomorrow', article };
    await ulozPripraveny(zajtra, article);
    return { ok: true, action: 'prepared-tomorrow', day: zajtra, headline: article.headline };
  }

  return { skipped: 'dnešný horoskop už existuje' };
}
