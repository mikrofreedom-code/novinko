// AI GATEWAY — agent pýta SCHOPNOSŤ (cheap/smart), nie model.
// Model vymeníš tu, na jednom mieste. Loguje náklady.
import Anthropic from '@anthropic-ai/sdk';
import { logCost, todaySpendUsd } from './cost.js';

// SDK sám retryuje 429/529/5xx + sieťové chyby s exponenciálnym odstupom.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: Number(process.env.AI_MAX_RETRIES ?? 4),
  timeout: Number(process.env.AI_TIMEOUT_MS ?? 60000),
});
const MODELS = { cheap: process.env.MODEL_CHEAP, smart: process.env.MODEL_SMART };
const DAILY_BUDGET = Number(process.env.DAILY_BUDGET_USD ?? 5);

export async function ask({ tier, system, prompt, agent, queueId, maxTokens = 1500, temperature = 0.2 }) {
  // POISTKA NÁKLADOV: keď dnešný náklad dosiahne strop, AI sa zastaví.
  const spent = await todaySpendUsd();
  if (spent >= DAILY_BUDGET) {
    throw new Error(`budget guard: dnešný AI náklad $${spent.toFixed(2)} dosiahol strop $${DAILY_BUDGET}`);
  }

  const model = MODELS[tier] ?? MODELS.cheap;
  const res = await anthropic.messages.create({
    model, max_tokens: maxTokens, temperature, system,
    messages: [{ role: 'user', content: prompt }],
  });
  await logCost({ agent, model, usage: res.usage, queueId });
  return res.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
}
