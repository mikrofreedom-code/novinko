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
  listing: 60,
  protocol_release: 56,  // GitHub releases nástrojov/knižníc
  sentiment: 45,
  tvl_shift: 40,
  governance: 34,
  other: 42,
};

// Keyword filter pre cross-topic feedy (regulátori pri krypte, NVIDIA/politika pri AI).
const KRYPTO_RE = /\b(crypto|bitcoin|btc|ethereum|ether|blockchain|stablecoin|digital[ -]?asset|crypto[ -]?asset|tokeniz|web3|defi|mica|virtual currenc|distributed ledger|stable[ -]?coin)\b/i;
const AI_RE = /\b(a\.?i\.?|artificial intelligence|machine learning|deep learning|neural network|LLM|large language model|generative|chatbot|GPT|OpenAI|Anthropic|Claude|Gemini|DeepMind|transformer|diffusion|AGI|foundation model|inference)\b/i;

export const SECTIONS = {
  krypto: {
    id: 'krypto',
    category: 'krypto',        // kategória na webe (Google Sheet stĺpec G)
    keywordRe: KRYPTO_RE,      // filter pre feedy s keyword_filter=true
    eventBase: KRYPTO_EVENT_BASE,
    live: true,                // píše sa a publikuje
  },
  ai: {
    id: 'ai',
    category: 'ai',
    keywordRe: AI_RE,
    eventBase: AI_EVENT_BASE,
    // Web s kategóriou 'ai' je nasadený (2026-07-01) → sekcia je živá:
    // Writer píše AI články a Publisher ich zverejňuje do tabu „AI".
    live: true,
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
