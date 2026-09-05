// AI GATEWAY — agent pýta SCHOPNOSŤ (cheap/smart), nie model ani providera.
// Model aj provider sa rozhodujú TU, na jednom mieste. Loguje náklady.
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { logCost, hasPrice, todaySpendUsd, allowanceUsd, dailyBudgetUsd } from './cost.js';
import { modelsFor } from '../sections/index.js';

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 60000);
const AI_MAX_RETRIES = Number(process.env.AI_MAX_RETRIES ?? 4);

// Klienty vznikajú až pri prvom skutočnom použití — providera, ktorého žiadna
// sekcia nepoužíva, tak nepotrebuje mať ani nastavený API kľúč.
let _anthropic, _gemini, _openai;
const anthropicClient = () => (_anthropic ??= new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: AI_MAX_RETRIES, timeout: AI_TIMEOUT_MS,
}));
// @google/genai nemá vlastný retry mechanizmus ako druhé dve SDK — dočasné
// chyby preto zachytáva až retry.js na úrovni fronty (TRANSIENT regex).
const geminiClient = () => (_gemini ??= new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: AI_TIMEOUT_MS },
}));
const openaiClient = () => (_openai ??= new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, maxRetries: AI_MAX_RETRIES, timeout: AI_TIMEOUT_MS,
}));

// Každý provider má iný tvar požiadavky aj odpovede — tu sa to zjednotí na
// { text, stopReason, truncated, usage: { input, output } }, aby o tom
// volajúci (05-verification, 07-writer, …) nemuseli vedieť vôbec nič.
const CALLERS = {
  async anthropic(model, { system, prompt, maxTokens, temperature }) {
    const res = await anthropicClient().messages.create({
      model, max_tokens: maxTokens, temperature, system,
      messages: [{ role: 'user', content: prompt }],
    });
    return {
      text: res.content.filter(b => b.type === 'text').map(b => b.text).join('\n'),
      stopReason: res.stop_reason,          // 'end_turn' | 'max_tokens' | 'stop_sequence' | …
      truncated: res.stop_reason === 'max_tokens',
      usage: { input: res.usage.input_tokens, output: res.usage.output_tokens },
    };
  },

  async gemini(model, { system, prompt, maxTokens, temperature }) {
    const res = await geminiClient().models.generateContent({
      model,
      contents: prompt,
      config: { systemInstruction: system, maxOutputTokens: maxTokens, temperature },
    });
    const finishReason = res.candidates?.[0]?.finishReason;
    return {
      text: res.text ?? '',
      stopReason: finishReason,             // 'STOP' | 'MAX_TOKENS' | 'SAFETY' | …
      truncated: finishReason === 'MAX_TOKENS',
      usage: {
        input: res.usageMetadata?.promptTokenCount ?? 0,
        output: res.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  },

  async openai(model, { system, prompt, maxTokens, temperature }) {
    // Responses API (aktuálne primárne rozhranie OpenAI SDK, Chat Completions
    // je len „supported indefinitely"). instructions = system, input = prompt.
    const res = await openaiClient().responses.create({
      model, instructions: system, input: prompt,
      max_output_tokens: maxTokens, temperature,
    });
    const reason = res.incomplete_details?.reason;
    return {
      text: res.output_text ?? '',
      stopReason: reason ?? 'completed',    // 'max_output_tokens' | 'max_messages' | 'content_filter' | 'completed'
      truncated: reason === 'max_output_tokens',
      usage: { input: res.usage?.input_tokens ?? 0, output: res.usage?.output_tokens ?? 0 },
    };
  },
};

// "gemini:gemini-3.8-flash" → { provider: 'gemini', model: 'gemini-3.8-flash' }.
// Bez prefixu = anthropic — existujúci .env (MODEL_CHEAP=claude-haiku-4-5-…)
// tak funguje bez zmeny, provider je vždy voliteľný opt-in.
function parseModelSpec(spec) {
  const i = spec.indexOf(':');
  return i === -1
    ? { provider: 'anthropic', model: spec }
    : { provider: spec.slice(0, i), model: spec.slice(i + 1) };
}

const MODELS = { cheap: process.env.MODEL_CHEAP, smart: process.env.MODEL_SMART };

// KTORÝ MODEL ODPOVIE. Poradie je zámerné:
//   1. explicitný `model` vo volaní — pre porovnávací skript a jednorazové testy
//   2. `models[tier]` sekcie (lib/sections/index.js) — redakčné rozhodnutie v gite
//   3. globálny default z .env
// Rozhodnutie sa vracia aj s dôvodom, nech je v chybovej hláške vidieť, odkiaľ
// model prišiel — inak sa pri troch zdrojoch pravdy ťažko hľadá, prečo píše iný.
export function resolveModel({ tier, section, model }) {
  if (model) return { ...parseModelSpec(model), spec: model, zdroj: 'explicitný' };

  const zoSekcie = section ? modelsFor(section)[tier] : undefined;
  if (zoSekcie) return { ...parseModelSpec(zoSekcie), spec: zoSekcie, zdroj: `sekcia ${section}` };

  const globalny = MODELS[tier] ?? MODELS.cheap;
  if (!globalny) throw new Error(`ai-gateway: tier "${tier}" nemá model — chýba MODEL_${String(tier).toUpperCase()} v .env`);
  return { ...parseModelSpec(globalny), spec: globalny, zdroj: 'globálny default' };
}

// Chyby providerov normalizuj na jeden tvar "<provider> <status>: <správa>".
//
// PREČO: retry.js rozhoduje o tom, či je chyba dočasná, regexom nad TEXTOM
// správy (429|503|timeout|fetch failed|…). Ten text dnes formuluje Anthropic
// SDK; ako presne píše chyby Gemini SDK, nevieme. Keby sa regex netrafil,
// rate-limit by sa vyhodnotil ako trvalá chyba a článok by zomrel namiesto
// opakovania o hodinu. Prefix so statusom to robí nezávislým od formulácií SDK.
function normalizeError(provider, err) {
  const status = err?.status ?? err?.code ?? err?.response?.status ?? '';
  const e = new Error(`${provider}${status ? ` ${status}` : ''}: ${err?.message ?? err}`);
  e.cause = err;
  return e;
}

// askFull() vracia aj stopReason/truncated. Volajúci, ktorý čaká JSON, tak vie
// rozlíšiť „model odpovedal nezmysel" od „odpoveď sa urezala na limite
// tokenov" — druhý prípad sa dá opraviť zvýšením limitu, prvý nie. Bez tohto
// rozlíšenia sa urezané odpovede hlásili ako „returned non-JSON" a správa sa
// zahodila (medzi 30.6. a 9.7.2026 takto padlo 356 položiek). Každý provider
// vyššie preto MUSÍ vedieť spoľahlivo odpovedať na otázku „urezalo sa to?".
export async function askFull({
  tier, system, prompt, agent, queueId, section, model,
  maxTokens = 1500, temperature = 0.2,
}) {
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

  const { provider, model: modelName, spec, zdroj } = resolveModel({ tier, section, model });

  const caller = CALLERS[provider];
  if (!caller) {
    throw new Error(`ai-gateway: neznámy provider "${provider}" (spec "${spec}", ${zdroj}). Podporované: ${Object.keys(CALLERS).join(', ')}`);
  }

  // CENOVÁ BRÁNA — bez ceny sa nevolá. Model, ktorý nie je v PRICING, by sa
  // logoval za $0, budget guard by videl nulu a nezastavil by nič.
  if (!hasPrice(modelName)) {
    throw new Error(`ai-gateway: model "${modelName}" (${zdroj}) nemá cenu v PRICING v cost.js — doplň ju pred nasadením, inak prestane fungovať budget guard`);
  }

  let res;
  try {
    res = await caller(modelName, { system, prompt, maxTokens, temperature });
  } catch (err) {
    throw normalizeError(provider, err);
  }

  await logCost({
    agent, model: modelName, queueId,
    usage: { input_tokens: res.usage.input, output_tokens: res.usage.output },
  });
  return { text: res.text, stopReason: res.stopReason, truncated: res.truncated, model: modelName };
}

// Pôvodné rozhranie — vracia len text. Ostáva nezmenené kvôli existujúcim volajúcim.
export async function ask(opts) {
  return (await askFull(opts)).text;
}
