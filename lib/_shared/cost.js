// COST ENGINE — loguj každé AI volanie.
import { db } from './queue.js';
// model: [input_usd_per_1M, output_usd_per_1M]. Kľúče = presne to, čo posiela ai-gateway
// (hodnoty z .env), plus bare aliasy pre istotu. Aktualizuj pri zmene cien.
const PRICING = {
  'claude-haiku-4-5-20251001': [1.00, 5.00],
  'claude-haiku-4-5': [1.00, 5.00],
  'claude-sonnet-4-6': [3.00, 15.00],
};
export async function logCost({ agent, model, usage, queueId }) {
  const i = usage?.input_tokens ?? 0, o = usage?.output_tokens ?? 0;
  const [pin, pout] = PRICING[model] ?? [0, 0];
  await db.from('ai_cost_log').insert({
    agent, model, input_tokens: i, output_tokens: o,
    cost_usd: (i/1e6)*pin + (o/1e6)*pout, queue_id: queueId ?? null,
  });
}
