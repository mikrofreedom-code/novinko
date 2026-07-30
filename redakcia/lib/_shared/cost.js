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
