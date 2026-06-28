// AI GATEWAY — agent pýta SCHOPNOSŤ (cheap/smart), nie model.
// Model vymeníš tu, na jednom mieste. Loguje náklady.
import Anthropic from '@anthropic-ai/sdk';
import { logCost } from './cost.js';
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODELS = { cheap: process.env.MODEL_CHEAP, smart: process.env.MODEL_SMART };

export async function ask({ tier, system, prompt, agent, queueId, maxTokens = 1500, temperature = 0.2 }) {
  const model = MODELS[tier] ?? MODELS.cheap;
  const res = await anthropic.messages.create({
    model, max_tokens: maxTokens, temperature, system,
    messages: [{ role: 'user', content: prompt }],
  });
  await logCost({ agent, model, usage: res.usage, queueId });
  return res.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
}
