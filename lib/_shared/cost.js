// COST ENGINE — loguj každé AI volanie.
import { db } from './queue.js';
const PRICING = {}; // model: [input_usd_per_1M, output_usd_per_1M] — OVER a doplň
export async function logCost({ agent, model, usage, queueId }) {
  const i = usage?.input_tokens ?? 0, o = usage?.output_tokens ?? 0;
  const [pin, pout] = PRICING[model] ?? [0, 0];
  await db.from('ai_cost_log').insert({
    agent, model, input_tokens: i, output_tokens: o,
    cost_usd: (i/1e6)*pin + (o/1e6)*pout, queue_id: queueId ?? null,
  });
}
