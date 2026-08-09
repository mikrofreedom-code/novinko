// COST ENGINE — loguj každé AI volanie.
import { db } from './queue.js';
// model: [input_usd_per_1M, output_usd_per_1M]. Kľúče = presne to, čo posiela ai-gateway
// (hodnoty z .env), plus bare aliasy pre istotu. Aktualizuj pri zmene cien.
const PRICING = {
  'claude-haiku-4-5-20251001': [1.00, 5.00],
  'claude-haiku-4-5': [1.00, 5.00],
  'claude-sonnet-4-6': [3.00, 15.00],
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

export async function logCost({ agent, model, usage, queueId }) {
  const i = usage?.input_tokens ?? 0, o = usage?.output_tokens ?? 0;
  const [pin, pout] = PRICING[model] ?? [0, 0];
  const cost_usd = (i/1e6)*pin + (o/1e6)*pout;
  await db.from('ai_cost_log').insert({
    agent, model, input_tokens: i, output_tokens: o, cost_usd, queue_id: queueId ?? null,
  });
  _spend.val += cost_usd; // drž cache aktuálnu počas behu
}

// Dnešný AI náklad v USD (od polnoci). Pre budget guard v ai-gateway.
export async function todaySpendUsd() {
  if (Date.now() - _spend.ts < 60000) return _spend.val;
  const since = new Date(); since.setHours(0, 0, 0, 0);
  const { data, error } = await db.from('ai_cost_log')
    .select('cost_usd').gte('created_at', since.toISOString());
  if (!error) _spend = { ts: Date.now(), val: (data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0) };
  return _spend.val;
}
