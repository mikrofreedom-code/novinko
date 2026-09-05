// ============================================================
// SECTION REGISTRY — každý „desk" (krypto, ai, …) ako konfigurácia.
// ------------------------------------------------------------
// Pridať novú sekciu = pridať sem jeden záznam + jej feedy (pole `section`
// v _shared/feeds.js). Generický pipeline si section prečíta z každej položky
// a podľa nej vyberie kategóriu, importance profil a keyword filter.
// Nič iné sa nemení → sekcie len pribúdajú, kód sa nerozhadzuje.
//
// Section sa pretiahne položkou: raw_data.section → facts.section → article.section.
// Default je 'krypto' (spätná kompatibilita — existujúce dáta bez section).
// ============================================================

// event_type → základná dôležitosť (0-100). Ladí sa TU, per sekcia.
const KRYPTO_EVENT_BASE = {
  regulatory: 90,        // MiCA, SEC, centrálne banky
  security: 88,          // hack, exploit, zastavené výbery — vykradnutá burza je vždy správa
  announcement: 72,      // oznámenia, partnerstvá, PR
  listing: 68,           // nové listingy
  protocol_release: 55,  // upgrade protokolu
  sentiment: 55,         // extrémna nálada trhu (Fear & Greed)
  tvl_shift: 50,
  governance: 38,        // technické DAO návrhy → väčšinou pod latkou
  other: 40,
};

// AI desk používa ZATIAĽ rovnaké event typy ako určuje 05 (announcement/
// protocol_release/regulatory/…). Nové typy (model_release, research, funding)
// pridáme až keď rozšírime 05 prompt — dovtedy sem mapujeme existujúce.
const AI_EVENT_BASE = {
  regulatory: 82,        // AI Act, EU/US politika
  announcement: 74,      // nové modely, funkcie, partnerstvá, ceny — jadro AI správ
  security: 70,          // úniky dát, jailbreaky, zneužitie modelu — reálne, ale nie jadro sekcie
  listing: 60,
  protocol_release: 25,  // GitHub releases nástrojov/knižníc — pod latkou, nech neprechádza automaticky (potrebuje súbeh zdrojov)
  sentiment: 45,
  tvl_shift: 40,
  governance: 34,
  other: 42,
};

// Ekonomika. Skóre je kalibrované proti latke IMPORTANCE_BAR = 42:
//
//   rate_decision 90     — rozhodnutie centrálnej banky je najväčšia plánovaná
//                          hospodárska správa, aká existuje.
//   trade_policy 78      — clá a obchodné vojny dopadajú na exportnú ekonomiku
//                          priamo, čitateľa zaujímajú viac než väčšina štatistík.
//   data_release 65      — jadro hospodárskej redakcie (CPI, HDP, nezamestnanosť).
//   corporate_earnings 35— POD latkou. Znížené z 45 po prvom ostrom behu 5. 9.:
//                          MarketWatch priniesol „Why Oracle's stock looks like
//                          a compelling buy ahead of earnings" — akciový tip
//                          s DVOMA faktami, ktorý by pri 45 prešiel a stal sa
//                          dvojvetovým útržkom. Veľkosť firmy rozlíšiť nevieme
//                          (mcapPoints funguje len na krypto metrikách), takže
//                          latku musí zdvihnúť niečo iné: dôraz zdroja (+8 → 43)
//                          alebo súbeh dvoch ďalších redakcií (+10 → 45).
//                          Jediné médium so svojím tipom teda neprejde.
//   market_reaction 30   — POD latkou zámerne. „DAX klesol o 1 %" nie je článok.
//                          Cez latku sa dostane až súbehom zdrojov (+5 za každý
//                          ďalší), teda keď to hlási viacero redakcií naraz.
//   other 40             — pod latkou, rovnako ako pri krypte.
const EKONOMIKA_EVENT_BASE = {
  rate_decision: 90,
  trade_policy: 78,
  regulatory: 75,
  fiscal_policy: 72,
  data_release: 65,
  security: 60,
  announcement: 55,
  forecast: 50,
  corporate_earnings: 35,
  other: 40,
  market_reaction: 30,
};

// Svet. Kalibrácia proti latke IMPORTANCE_BAR = 42.
//
// PÔVODNE mala byť chrbticou skórovania konfluencia — základy tesne pod latkou,
// cez ňu by správu dostal až súbeh dvoch-troch redakcií, čo by bolo „potvrdené
// dvoma zdrojmi" zabudované do kódu. DÁTA TO ZAMIETLI: klastre s viac ako
// jedným zdrojom sú 5-10 % (AI 15 z 291, krypto 18 z 186, ekonomika 2 z 41).
// Dôvod je v clusterKey() v 06 — kľúč je `sekcia|entita|typ` a zhodovať sa musí
// PRESNÝ normalizovaný reťazec entity. Osem redakcií o tej istej udalosti píše
// „United States", „US" aj „US military", takže sa nezlúčia. Pri takom návrhu
// by 90 % svetových správ neprešlo nikdy a rubrika by mlčala.
//
// Základy preto stoja samy, konfluencia je bonus, keď náhodou nastane.
//
//   election 75, diplomacy 72   jadro zahraničnej rubriky
//   institutional 70            rozhodnutia OSN/NATO/EÚ — sem padnú primárne
//                               zdroje (UN News, IAEA), ktoré majú prejsť samy
//   disaster 68                 katastrofy, vysoký čitateľský záujem
//   announcement 40             POD latkou — poučenie z ekonomiky, kde 55
//                               pustilo „Trump na minci". Vecné kroky vlád
//                               padnú do institutional/diplomacy/sanctions,
//                               takže announcement je zvyškový kôš.
//   conflict 25                 HLBOKO pod latkou, dohodnuté s používateľom:
//                               frontovú líniu robí redakcia ručne. Cez latku
//                               sa dostane až pri masívnom súbehu (25+20=45),
//                               teda keď to hlásia štyri a viac redakcií.
const SVET_EVENT_BASE = {
  election: 75,
  diplomacy: 72,
  institutional: 70,
  sanctions: 70,
  disaster: 68,
  court_ruling: 62,
  regulatory: 60,
  security: 55,
  protest: 50,
  announcement: 40,
  other: 35,
  conflict: 25,
};

// Keyword filter pre cross-topic feedy (regulátori pri krypte, NVIDIA/politika pri AI).
const KRYPTO_RE = /\b(crypto|bitcoin|btc|ethereum|ether|blockchain|stablecoin|digital[ -]?asset|crypto[ -]?asset|tokeniz|web3|defi|mica|virtual currenc|distributed ledger|stable[ -]?coin)\b/i;
const AI_RE = /\b(a\.?i\.?|artificial intelligence|machine learning|deep learning|neural network|LLM|large language model|generative|chatbot|GPT|OpenAI|Anthropic|Claude|Gemini|DeepMind|transformer|diffusion|AGI|foundation model|inference)\b/i;

// Ekonomika. Dve veci, ktoré tento regex robí inak než dva vyššie:
//
// 1. VÝHRADNE PO ANGLICKY. Filter beží v 02-gateway nad surovým textom feedu a
//    všetky zdroje sekcie sú anglické. Slovenské tvary by tu boli mŕtva váha.
// 2. Žiadne kmene pred koncovou `\b`. KRYPTO_RE má na tomto latentnú chybu:
//    „tokeniz" nasledované `\b` nemôže sadnúť na „tokenization", lebo po „z"
//    ide písmeno. Preto sú tu len celé slová a explicitné varianty (`wages?`,
//    `tax(es|ation)?`, `customs (duty|duties)`).
//
// Zámerne SEM NEPATRÍ holé „economy"/„economic". Bolo by to najširšie sito zo
// všetkých a tlačová správa Komisie tie slová obsahuje takmer vždy — pustili by
// sme dnu pol agendy EÚ a platili Haiku za extrakciu z nej. Radšej užšie sito:
// keď sa ukáže, že nám uniká typ správ, doplní sa termín. Chýbajúci článok je
// vidieť, tiché míňanie rozpočtu nie.
const EKONOMIKA_RE = /\b(inflation|deflation|disinflation|unemployment|jobless|payrolls|jobs report|job (gains|losses|growth)|labou?r market|wages?|economists?|recession|economic growth|GDP(?!R)|CPI|PPI|PMI|consumer price|producer price|retail sales|industrial production|consumer confidence|central bank|monetary policy|interest rates?|rate (cut|hike|rise|decision)|basis points?|Federal Reserve|Fed|ECB|Bundesbank|Bank of England|bond yields?|treasury yields?|budget deficit|fiscal|public debt|national debt|sovereign debt|tax(es|ation)?|tariffs?|trade (war|deal|dispute|talks|agreement|deficit)|customs (duty|duties)|exports?|imports?|eurozone|euro area|Wall Street|stock market|earnings|profit warning|IPO|privatisation|privatization|acquisition|merger|bankruptcy|layoffs?)\b/i;

export const SECTIONS = {
  krypto: {
    id: 'krypto',
    scoutEveryH: 2,      // krypto sa v poslednej dobe toľko nedeje
    scoutOffsetH: 0,     // párne hodiny: 6, 8, 10 … 20
    category: 'krypto',        // kategória na webe (Google Sheet stĺpec G)
    keywordRe: KRYPTO_RE,      // filter pre feedy s keyword_filter=true
    eventBase: KRYPTO_EVENT_BASE,
    live: true,                // píše sa a publikuje
  },
  // Voliteľné pole `models` prepne providera len pre túto sekciu, napr.:
  //   models: { smart: 'gemini:gemini-3.8-flash' }
  // Bez neho platí globálny default z .env. Model MUSÍ mať cenu v cost.js,
  // inak ho ai-gateway odmietne zavolať (viď PRICING).
  ai: {
    id: 'ai',
    scoutEveryH: 4,
    scoutOffsetH: 1,     // 5, 9, 13, 17, 21
    category: 'ai',
    keywordRe: AI_RE,
    eventBase: AI_EVENT_BASE,
    // Web s kategóriou 'ai' je nasadený (2026-07-01) → sekcia je živá:
    // Writer píše AI články a Publisher ich zverejňuje do tabu „AI".
    live: true,
  },
  ekonomika: {
    id: 'ekonomika',
    scoutEveryH: 3,
    scoutOffsetH: 1,     // 7, 10, 13, 16, 19
    category: 'ekonomika',
    keywordRe: EKONOMIKA_RE,
    eventBase: EKONOMIKA_EVENT_BASE,
    // ZATIAĽ NEŽIVÁ. `liveFor()` gatuje Writera (07-writer.js), takže položky
    // sa zbierajú, extrahujú a skórujú, ale žiadny článok sa nenapíše — a teda
    // ani nezaplatí. Prepnúť na true AŽ keď web bude mať tab „Ekonomika",
    // inak by Publisher zverejňoval do kategórie, ktorú stránka nevykreslí.
    // (Presne v tomto poradí išla aj sekcia AI.)
    live: false,
    // Model zámerne NEPREPÍNAME na lacnejší. Pôvodná úvaha („nové rubriky =
    // priestor skúsiť Gemini") tu neplatí: presnosť v číslach, percentuálnych
    // bodoch, obdobiach a stave údaja je presne to, na čom lacný model šmykne,
    // a chyba typu „0,25 %" namiesto „0,25 p. b." je pre hospodársku redakciu
    // diskvalifikačná. Extraktor beží na Haiku (globálny MODEL_CHEAP) ako
    // všade, Writer na Sonnete. Prepnúť až keď to compare-models.mjs zmeria
    // na číselných textoch, nie od stola.
  },
  svet: {
    id: 'svet',
    // Bolo scoutEveryH: 1 (každú hodinu) — znížené 5. 9. na požiadanie, rovnaká
    // kadencia ako krypto. Posun 1 (nepárne hodiny) zámerne DOPĹŇA krypto
    // (párne, offset 0), nie sa s ním kryje — spolu pokrývajú každú hodinu.
    scoutEveryH: 2,
    scoutOffsetH: 1,
    category: 'svet',
    eventBase: SVET_EVENT_BASE,
    // ZÁMERNE BEZ keywordRe. Všetky zdroje sekcie sú vydavateľom zúžené na
    // svetové spravodajstvo (BBC World, Guardian World, UN News…), takže sito
    // nepotrebujú — rovnako ako CNBC Economy a Euronews Business, ktoré dnes
    // dávajú najlepší výstup. „Svetová správa“ navyše nemá kľúčové slová:
    // ekonomika mala slovník (inflácia, clá, HDP), svet sa definuje tým, čím
    // NIE JE, a brána v 02 vie filtrovať len zaraďovaním, nie vylučovaním.
    //
    // POZOR: keby sem niekto pridal feed s `keywordFilter: true`, spadne to —
    // keywordReFor() vráti undefined a brána naň zavolá .test(). Vtedy treba
    // najprv dopísať SVET_RE.
    live: false,
    // Nežije z rovnakého dôvodu ako ekonomika: web tab „Svet“ síce existuje
    // (z ručného publikovania), ale Writer s novou vetvou promptu ešte nikdy
    // nebežal. Zapnúť až po obhliadke reálnych faktov.
  },
  zahrada: {
    id: 'zahrada',
    category: 'zahrada',
    // Bez eventBase a keywordRe zámerne — obe patria mechanike 02-gateway
    // a 06-chief-editor (prah dôležitosti, filter cross-topic feedov), ktorú
    // Záhrada celú obchádza. Má vlastný spúšťač (15-zahrada.js), nie feed.
    // Sem sa píše LEN kvôli categoryFor() (12-publisher) a modelsFor()
    // (ai-gateway) — bez záznamu by section('zahrada') ticho spadla na
    // DEFAULT_SECTION (krypto) a 11-image by obrázku dal krypto kategóriu.
    live: true,
    // `live` tu nemá funkčný účinok — liveFor() sa pýta LEN 07-writer.js,
    // ktorý Záhrada nikdy neprejde (vlastný generátor píše rovno). true je
    // tu len pre čitateľnosť, nech register netvrdí niečo, čo nie je pravda.
  },
};

export const DEFAULT_SECTION = 'krypto';

export function section(id) {
  return SECTIONS[id] || SECTIONS[DEFAULT_SECTION];
}
export function categoryFor(id) { return section(id).category; }
export function eventBaseFor(id) { return section(id).eventBase; }
export function keywordReFor(id) { return section(id).keywordRe; }
export function liveFor(id) { return section(id).live !== false; }

// ---- VOĽBA MODELU PRE SEKCIU ----
//
// Sekcia môže mať `models: { smart, cheap }` s hodnotou "provider:model"
// (napr. 'gemini:gemini-3.8-flash'). Čo tu nie je, spadne na globálny default
// z .env (MODEL_SMART / MODEL_CHEAP) — teda dnešný Anthropic.
//
// PREČO TU A NIE V .env: toto je redakčné rozhodnutie („Svet píše Gemini"),
// nie tajomstvo. V .env by nemalo históriu ani dôvod, hoci CLAUDE.md hovorí,
// že git log je hlavný záznam. Pipeline navyše beží z lokálneho cronu, takže
// zmena .js nestojí deploy ani Netlify kredity — obvyklý argument „env sa mení
// bez nasadenia" tu neplatí. A preklep v názve env premennej zlyhá ticho
// (spadne na Sonnet a platíš 4×), preklep tu je vidieť v diffe.
export function modelsFor(id) { return section(id).models ?? {}; }

// ---- AKO ČASTO SA SEKCIA VÔBEC STIAHNE ----
//
// Redakčné rozhodnutie, preto TU a nie v .env — rovnako ako voľba modelu.
// „Krypto stačí každé 2 hodiny, lebo sa tam toľko nedeje" je úsudok, ktorý má
// mať v gite históriu a dôvod; preklep v názve env premennej by navyše zlyhal
// ticho a sekcia by sa buď prestala sťahovať, alebo by bežala každú hodinu.
//
// Pravidlo je `hodina % interval === 0`, teda kotvené o polnoci. Je to zámerne
// hlúpe a predvídateľné: bez stavu, bez ďalšieho dotazu do databázy.
//
// ZNÁMY KOMPROMIS: keď stroj práve spí (viď „Spiaci stroj" v CLAUDE.md), zmešká
// sa celý slot a sekcia počká na ďalší — AI tak môže mať medzeru až 8 hodín.
// Alternatíva „pozri, kedy sa sťahovalo naposledy" by výpadok dobehla, ale
// potrebuje stav a časom driftuje. Keby sa medzery ukázali ako problém, je to
// malá zmena — dovtedy platí jednoduchšia verzia.
export function scoutIntervalFor(id) {
  return Math.max(1, Number(section(id).scoutEveryH ?? 1));
}

// POSUN (scoutOffsetH) rozhadzuje sekcie po hodinách, aby sa nezhlukovali.
// Bez neho by `hodina % interval === 0` posadilo krypto, AI aj ekonomiku na tie
// isté hodiny (0, 12) a inde by ostal len svet. S posunmi má takmer každá
// hodina v aktívnom okne 5:00-21:00 dve sekcie, najviac tri, a nikdy štyri.
export function sectionDue(id, date = new Date()) {
  const n = scoutIntervalFor(id);
  const off = Number(section(id).scoutOffsetH ?? 0);
  return (((date.getHours() - off) % n) + n) % n === 0;
}
