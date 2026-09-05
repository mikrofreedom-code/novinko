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
//   corporate_earnings 45— tesne nad latkou: prejde, ale v round-robine prehrá
//                          takmer so všetkým ostatným. Nemáme signál veľkosti
//                          firmy (mcapPoints funguje len na krypto metrikách),
//                          takže výsledky malej firmy nevieme odlíšiť od veľkej.
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
  corporate_earnings: 45,
  other: 40,
  market_reaction: 30,
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
    category: 'ai',
    keywordRe: AI_RE,
    eventBase: AI_EVENT_BASE,
    // Web s kategóriou 'ai' je nasadený (2026-07-01) → sekcia je živá:
    // Writer píše AI články a Publisher ich zverejňuje do tabu „AI".
    live: true,
  },
  ekonomika: {
    id: 'ekonomika',
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
