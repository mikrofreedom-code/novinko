// AI GATEWAY — agent pýta SCHOPNOSŤ (cheap/smart), nie model.
// Model vymeníš tu, na jednom mieste. Loguje náklady.
import Anthropic from '@anthropic-ai/sdk';
import { logCost, todaySpendUsd, allowanceUsd, dailyBudgetUsd } from './cost.js';

// SDK sám retryuje 429/529/5xx + sieťové chyby s exponenciálnym odstupom.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  maxRetries: Number(process.env.AI_MAX_RETRIES ?? 4),
  timeout: Number(process.env.AI_TIMEOUT_MS ?? 60000),
});
const MODELS = { cheap: process.env.MODEL_CHEAP, smart: process.env.MODEL_SMART };

// askFull() vracia aj stopReason. Volajúci, ktorý čaká JSON, tak vie rozlíšiť
// „model odpovedal nezmysel" od „odpoveď sa urezala na limite tokenov" — druhý
// prípad sa dá opraviť zvýšením limitu, prvý nie. Bez tohto rozlíšenia sa
// urezané odpovede hlásili ako „returned non-JSON" a správa sa zahodila
// (medzi 30.6. a 9.7.2026 takto padlo 356 položiek).
export async function askFull({ tier, system, prompt, agent, queueId, maxTokens = 1500, temperature = 0.2 }) {
  // POISTKA NÁKLADOV: strop nie je denný nárazník, ale PRIEBEŽNÝ — uvoľňuje sa
  // s pribúdajúcimi hodinami (viď allowanceUsd v cost.js). Položka, ktorá tu
  // spadne, nie je stratená: retry.js ju vráti späť, len čo strop dorastie.
  const spent = await todaySpendUsd();
  const allowance = allowanceUsd();
  if (spent >= allowance) {
    throw new Error(
      `budget guard: dnešný AI náklad $${spent.toFixed(2)} dosiahol priebežný strop `
      + `$${allowance.toFixed(2)} (denný $${dailyBudgetUsd().toFixed(2)})`,
    );
  }

  const model = MODELS[tier] ?? MODELS.cheap;
  const res = await anthropic.messages.create({
    model, max_tokens: maxTokens, temperature, system,
    messages: [{ role: 'user', content: prompt }],
  });
  await logCost({ agent, model, usage: res.usage, queueId });
  return {
    text: res.content.filter(b => b.type === 'text').map(b => b.text).join('\n'),
    stopReason: res.stop_reason,          // 'end_turn' | 'max_tokens' | 'stop_sequence' | …
    truncated: res.stop_reason === 'max_tokens',
  };
}

// Pôvodné rozhranie — vracia len text. Ostáva nezmenené kvôli existujúcim volajúcim.
export async function ask(opts) {
  return (await askFull(opts)).text;
}
