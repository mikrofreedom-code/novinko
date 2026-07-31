// ============================================================
// 11. Image
// ------------------------------------------------------------
// ROLA:          Vygeneruje vlastný obrázok cez Flux Schnell. Vlastný = právna ochrana.
// VSTUP status:  legal_ok  (od 2026-07-31; predtým 'written', lebo 08-10 boli stuby)
// VÝSTUP status: imaged
// STAV:          🟢 MVP (Flux Schnell + Supabase Storage)
// AI vrstva:     — (obrazový model cez Replicate)
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

import { claim, advance } from '../_shared/queue.js';
import { generateImage } from '../_shared/images.js';
import { ask } from '../_shared/ai-gateway.js';

export const STAGE = {
  index: 11,
  name: "Image",
  // Obrázok sa generuje AŽ po korektúre (08) a právnej kontrole (09) — nemá
  // zmysel platiť za obrázok k článku, ktorý neprejde bránou.
  input: "legal_ok",
  output: "imaged",
};

const AGENT = '11-image';

// Haiku napíše KRÁTKY vizuálny prompt k téme článku (nie generický mincový obrázok).
const IMG_SYSTEM = `You write a SHORT visual prompt for an editorial news illustration produced by an image generator.
Output ONLY the prompt text, one line, IN ENGLISH, no quotes, max ~25 words.
Describe a symbolic, conceptual scene relevant to the article topic and its section (e.g. crypto, AI).
Strict: NO text/words/letters in the image, NO real or recognizable people, NO company logos or brand marks, NO watermarks.
Style: clean, modern, editorial.`;

async function aiImagePrompt(item) {
  const a = item.article || {};
  try {
    const raw = await ask({
      tier: 'cheap',
      agent: AGENT,
      queueId: item.id,
      system: IMG_SYSTEM,
      prompt: `Section: ${a.section ?? 'krypto'}\nHeadline: ${a.headline}\n`
            + `Summary: ${a.perex ?? ''}\nEntity: ${a.entity ?? ''}\nEvent type: ${a.event_type ?? ''}`,
      maxTokens: 90,
      temperature: 0.6,
    });
    const p = String(raw || '').trim().split('\n')[0].replace(/^["'`]+|["'`]+$/g, '').trim();
    if (p.length < 8) return null;
    // Poistka: doplň zákazy aj keď ich model vynechá.
    return `${p}, editorial news illustration, dark modern background, clean digital art, `
         + `no text, no words, no logos, no real people`;
  } catch {
    return null; // padne na sekciovú šablónu v generateImage
  }
}

export async function run(item) {
  const article = item.article;
  if (!article?.headline) throw new Error('item.article chýba headline');

  // Prompt k téme cez Haiku; ak zlyhá, generateImage použije sekciovú šablónu.
  const prompt = await aiImagePrompt(item);
  // Graceful: ak generovanie zlyhá, image_url ostane '' a článok ide ďalej.
  const imageUrl = await generateImage(article.headline, item.id, {
    section: article.section,
    entity: article.entity,
    prompt: prompt || undefined,
  });
  const updated = { ...article, image_url: imageUrl };
  await advance(item.id, STAGE.output, { article: updated });
  return { image_url: imageUrl };
}

export async function runBatch(limit = 30) {
  // Obrázky sú produkčný náklad — v zberovom režime ich negeneruj.
  if (process.env.AI_ENABLED === 'false') {
    const waiting = await claim(STAGE.input, limit);
    return { ok: 0, failed: 0, parked: waiting.length };
  }
  const items = await claim(STAGE.input, limit);
  const res = { ok: 0, failed: 0 };
  for (const item of items) {
    try {
      await run(item);
      res.ok++;
    } catch (err) {
      res.failed++;
      await advance(item.id, 'error', { error: `${AGENT}: ${err.message}` });
    }
  }
  return res;
}
