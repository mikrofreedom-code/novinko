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

// ZÁHRADA dostáva fotorealistický štýl, nie symbolickú ilustráciu (na žiadosť
// používateľa, 2026-09-06) — abstraktné "digital art" nesedí k záhradkárskej
// téme rovnako, ako sedí ku krypto/AI. Množina je zámerne rozšíriteľná: Dom
// aj Byt (ak pribudnú) budú chcieť to isté, nie symbolickú ilustráciu.
//
// POZOR — nemení sa bezpečnostná brána: `no_ai_image` (BIBLIA-ZAHRADA kap. 8)
// stále beží PRED týmto krokom a vyradí témy, kde treba rozpoznať konkrétneho
// škodcu/chorobu. Sem sa dostanú len bezpečné, všeobecné témy — fotorealizmus
// tam riziko nezvyšuje.
const PHOTOREALISTIC_SECTIONS = new Set(['zahrada']);

// Sprísnené 6. 9. na žiadosť používateľa: "musia viac sedieť s témou, akoby
// som to fotil ja a písal som ja o tom" — dva samostatné problémy s prvou
// verziou. (1) prompt bol príliš všeobecný/atmosférický (napr. "grass
// seedlings in soil" k téme o jesennej starostlivosti o trávnik — súviselo,
// ale nezobrazovalo KONKRÉTNY krok z článku). (2) štýl "shot on DSLR, shallow
// depth of field" vyzeral ako profesionálna stock fotka, nie ako vlastná
// fotka autora, ktorý o téme reálne píše.
const IMG_SYSTEM_FOTO = `You write a SHORT visual prompt for a candid photograph that looks like it was taken by the article's own author, documenting the EXACT action or thing the article describes — as if they did it themselves and photographed it on the spot.
Output ONLY the prompt text, one line, IN ENGLISH, no quotes, max ~25 words.
Describe the SPECIFIC concrete action or subject from the headline/summary — what is literally happening (e.g. hands scattering grass seed over a bare lawn patch, a watering can tilted over a flower bed, a houseplant pot being carried through a doorway) — NOT a generic mood/atmosphere shot of the general topic. NOT a specific identifiable pest, disease, or plant variety that would need precise identification.
Strict: NO text/words/letters in the image, hands/tools doing the work are fine but NO visible faces or identifiable people, NO brand marks, NO watermarks.
Style: candid smartphone snapshot, natural unstaged composition, slightly imperfect framing, real garden or home — NOT polished stock photography, NOT professional studio or DSLR look.`;

async function aiImagePrompt(item) {
  const a = item.article || {};
  const foto = PHOTOREALISTIC_SECTIONS.has(a.section);
  try {
    const raw = await ask({
      tier: 'cheap',
      agent: AGENT,
      queueId: item.id,
      section: a.section,
      system: foto ? IMG_SYSTEM_FOTO : IMG_SYSTEM,
      prompt: `Section: ${a.section ?? 'krypto'}\nHeadline: ${a.headline}\n`
            + `Summary: ${a.perex ?? ''}\nEntity: ${a.entity ?? ''}\nEvent type: ${a.event_type ?? ''}`,
      maxTokens: 90,
      temperature: 0.6,
    });
    const p = String(raw || '').trim().split('\n')[0].replace(/^["'`]+|["'`]+$/g, '').trim();
    if (p.length < 8) return null;
    // Poistka: doplň zákazy aj keď ich model vynechá.
    return foto
      ? `${p}, candid smartphone photo, natural unstaged lighting, authentic amateur snapshot, real garden or home, `
        + `no text, no words, no logos, no visible faces`
      : `${p}, editorial news illustration, dark modern background, clean digital art, `
        + `no text, no words, no logos, no real people`;
  } catch {
    return null; // padne na sekciovú šablónu v generateImage
  }
}

export async function run(item) {
  const article = item.article;
  if (!article?.headline) throw new Error('item.article chýba headline');

  // Denné/evergreen formáty môžu mať vlastný trvalý redakčný vizuál. Keď je
  // URL pripravená už v článku, nevolaj Haiku ani Replicate a neprepisuj ju.
  if (article.image_url) {
    await advance(item.id, STAGE.output, { article });
    return { image_url: article.image_url, skipped: 'článok už má vlastný obrázok' };
  }

  // ZÁHRADA — identifikačné riziko (BIBLIA-ZAHRADA.md kapitola 8): vygenerovaná
  // voška alebo pleseň vyzerá presvedčivo a je vymyslená, čitateľ podľa nej
  // koná. 15-zahrada.js nastaví article.no_ai_image=true pre témy, kde ide
  // o rozpoznávanie škodcu/choroby (zoznam + regex, viď ten súbor). Bez
  // obrázka je podporovaný, bezpečný stav — image_url ostane '' rovnako ako
  // pri zlyhanom generovaní, článok ide ďalej.
  if (article.no_ai_image === true) {
    const updated = { ...article, image_url: '' };
    await advance(item.id, STAGE.output, { article: updated });
    return { image_url: '', skipped: 'identifikačné riziko — bez AI obrázka (BIBLIA-ZAHRADA kap. 8)' };
  }

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
