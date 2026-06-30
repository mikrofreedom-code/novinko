// ============================================================
// 11. Image
// ------------------------------------------------------------
// ROLA:          Vygeneruje vlastný obrázok cez Flux Schnell. Vlastný = právna ochrana.
// VSTUP status:  written   (dočasne; 08-10 sú stuby, preskakujú sa)
// VÝSTUP status: imaged
// STAV:          🟢 MVP (Flux Schnell + Supabase Storage)
// AI vrstva:     — (obrazový model cez Replicate)
// ------------------------------------------------------------
// VYMENIŤ TENTO KROK? Meníš LEN tento súbor. Žiadny iný agent
// sa nedotkne — všetci komunikujú cez status v Event Bus.
// ============================================================

import { claim, advance } from '../_shared/queue.js';
import { generateImage } from '../_shared/images.js';

export const STAGE = {
  index: 11,
  name: "Image",
  input: "written",
  output: "imaged",
};

const AGENT = '11-image';

export async function run(item) {
  const article = item.article;
  if (!article?.headline) throw new Error('item.article chýba headline');

  // Graceful: ak generovanie zlyhá, image_url ostane '' a článok ide ďalej.
  const imageUrl = await generateImage(article.headline, item.id);
  const updated = { ...article, image_url: imageUrl };
  await advance(item.id, STAGE.output, { article: updated });
  return { image_url: imageUrl };
}

export async function runBatch(limit = 10) {
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
