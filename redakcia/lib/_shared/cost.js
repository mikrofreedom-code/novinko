// COST ENGINE — loguj každé AI volanie.
import { db } from './queue.js';
// model: [input_usd_per_1M, output_usd_per_1M]. Kľúče = presne to, čo posiela ai-gateway
// (bare model meno bez "provider:" prefixu), plus bare aliasy pre istotu.
// Aktualizuj pri zmene cien.
//
// MODEL BEZ CENY SA NESMIE ZAVOLAŤ. Kým bol provider jeden, chýbajúci kľúč
// znamenal len skreslený log. Pri troch providerov a piatich rubrikách je to
// diera do rozpočtu: náklad by sa logoval ako $0, budget guard by videl nulu
// a nikdy by nezasiahol. Preto ho ai-gateway cez hasPrice() zastaví PRED
// volaním — radšej hlasná chyba pri prvom behu než tichý účet na konci mesiaca.
const PRICING = {
  'claude-haiku-4-5-20251001': [1.00, 5.00],
  'claude-haiku-4-5': [1.00, 5.00],
  'claude-sonnet-4-6': [3.00, 15.00],
  // Zavedená cena do 31.12.2026 (ai.google.dev, overené 3.9.2026); od 1.1.2027
  // $1.50 / $7.50 — vtedy preceniť. Over si presný reťazec model ID v Google
  // AI Studio pred nasadením, "gemini-3.8-flash" je najpravdepodobnejší tvar,
  // nie 100% istota z dokumentácie.
  'gemini-3.8-flash': [0.75, 3.75],
  // OpenAI/ChatGPT: pridaj sem cenu hneď ako padne konkrétny model — bez
  // riadku tu beží "naostro", ale za $0 v logoch, čo skreslí budget guard.
};
// Cache dnešného nákladu (refresh každých 60 s; logCost ho priebežne navyšuje).
let _spend = { ts: 0, val: 0 };

// ---- PRIEBEŽNÝ STROP (rozloženie rozpočtu cez deň) ----
//
// PREČO: pôvodná poistka bola „míňaj, kým nedôjde, potom stop". Rozpočet sa tým
// minul ráno a redakcia bola do polnoci ticho — namerané 6.8.2026 strop o 13:01,
// 7.8.2026 už o 08:01. Web tak vyzeral, že po obede prestal existovať.
//
// Teraz sa rozpočet uvoľňuje priebežne: o polnoci je k dispozícii len náskok,
// o 22:00 celý denný strop. Deň sa tým nepredraží — len sa minie rovnomerne.
//
// NÁSKOK: bez neho by prvé behy po polnoci nemali z čoho žiť (o 00:30 by bolo
// povolené ~1 % rozpočtu = ani jedno volanie). Dve hodiny náskoku dajú hneď na
// štarte dňa priestor zhruba na jeden celý beh.
const DAILY_BUDGET = Number(process.env.DAILY_BUDGET_USD ?? 5);
const HEAD_START_H = Number(process.env.BUDGET_HEAD_START_H ?? 2);

export function dailyBudgetUsd() {
  return DAILY_BUDGET;
}

// Koľko z denného rozpočtu smie byť minuté PRÁVE TERAZ.
// Deň sa počíta rovnako ako v todaySpendUsd() — od LOKÁLNEJ polnoci.
export function allowanceUsd(now = new Date()) {
  const hodin = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  return Math.min(DAILY_BUDGET, (DAILY_BUDGET * (hodin + HEAD_START_H)) / 24);
}

// Má model zapísanú cenu? ai-gateway sa pýta pred každým volaním.
export function hasPrice(model) {
  return Array.isArray(PRICING[model]);
}

// Náklad, ktorý sa nepodarilo zapísať do DB — ďalší refresh by ho inak zo súčtu vypustil.
let _unlogged = 0;
// Ako dlho smie guard veriť poslednej overenej hodnote, keď DB neodpovedá.
const SPEND_STALE_MS = 10 * 60 * 1000;

export async function logCost({ agent, model, usage, queueId }) {
  const i = usage?.input_tokens ?? 0, o = usage?.output_tokens ?? 0;
  const [pin, pout] = PRICING[model] ?? [0, 0];
  const cost_usd = (i/1e6)*pin + (o/1e6)*pout;
  const { error } = await db.from('ai_cost_log').insert({
    agent, model, input_tokens: i, output_tokens: o, cost_usd, queue_id: queueId ?? null,
  });
  _spend.val += cost_usd; // drž cache aktuálnu počas behu
  if (error) {
    _unlogged += cost_usd;
    console.error(`⚠️ ai_cost_log: zápis zlyhal ($${cost_usd.toFixed(4)}, ${agent}) — náklad drží len pamäť behu: ${error.message}`);
  }
}

// Dnešný AI náklad v USD (od polnoci). Pre budget guard v ai-gateway.
// Neoverený náklad zastaví platené volanie; „budget guard" v správe vráti položku cez retry.js bez pokusu.
export async function todaySpendUsd() {
  if (Date.now() - _spend.ts < 60000) return _spend.val;
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const { data, error } = await db.from('ai_cost_log')
    .select('cost_usd').gte('created_at', since.toISOString());
  if (!error) {
    _spend = { ts: Date.now(), val: (data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0) + _unlogged };
    return _spend.val;
  }
  if (_spend.ts && Date.now() - _spend.ts < SPEND_STALE_MS) return _spend.val;
  throw new Error(`budget guard: dnešný AI náklad sa nedá overiť (${error.message}) — platené volanie zastavené`);
}
