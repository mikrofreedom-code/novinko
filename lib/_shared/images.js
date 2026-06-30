// OBRÁZKY — Flux Schnell (Replicate) + upload do Supabase Storage.
// Rovnaký prístup ako existujúce Novinko (images.js), aby boli obrázky
// na tom istom mieste a konzistentné. Používa IMAGE_SUPABASE_* (úložisko
// pôvodného Novinka), ZÁMERNE oddelené od našej queue Supabase.
import Replicate from 'replicate';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
if (!globalThis.WebSocket) globalThis.WebSocket = ws;

const BUCKET = process.env.SUPABASE_BUCKET || 'article-images';

// Coin → tematický vizuál (ako v pôvodnom Novinku).
const COIN_THEMES = [
  { keys: ['bitcoin', 'btc'], theme: 'golden Bitcoin coin, orange and gold tones' },
  { keys: ['ethereum', 'eth'], theme: 'Ethereum crystal logo, silver and blue tones' },
  { keys: ['solana', 'sol'], theme: 'Solana abstract waves, purple and teal gradient' },
  { keys: ['xrp', 'ripple'], theme: 'XRP coin, dark blue tones' },
  { keys: ['cardano', 'ada'], theme: 'Cardano blue geometric theme' },
  { keys: ['bnb', 'binance'], theme: 'BNB gold coin, black and yellow' },
];
const KRYPTO_DEFAULT = 'cryptocurrency and blockchain, digital coins, trading charts';

export function buildPrompt(title) {
  const t = (title || '').toLowerCase();
  const hit = COIN_THEMES.find((c) => c.keys.some((k) => new RegExp(`\\b${k}\\b`).test(t)));
  const subject = hit ? hit.theme : KRYPTO_DEFAULT;
  return `professional news illustration, ${subject}, dark modern background, `
       + `dramatic lighting, clean digital art, high detail, editorial style, no text, no words, no letters`;
}

function storage() {
  return createClient(process.env.IMAGE_SUPABASE_URL, process.env.IMAGE_SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Vráti permanentnú URL obrázka, alebo '' ak čokoľvek zlyhá (článok ostane bez obrázka).
export async function generateImage(title, id) {
  try {
    if (!process.env.REPLICATE_API_TOKEN || !process.env.IMAGE_SUPABASE_URL || !process.env.IMAGE_SUPABASE_KEY) {
      return '';
    }
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    const input = { prompt: buildPrompt(title), aspect_ratio: '16:9', output_format: 'webp', num_outputs: 1 };

    // Replicate má pri nízkom kredite limit 6/min (burst 1) → pri 429 počkaj a skús znova.
    let out;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try { out = await replicate.run('black-forest-labs/flux-schnell', { input }); break; }
      catch (e) {
        const m = /retry.?after["\s:]+(\d+)/i.exec(e.message);
        const is429 = /\b429\b|throttl|rate limit/i.test(e.message);
        if (is429 && attempt < 4) {
          const wait = ((m ? Number(m[1]) : 11) + 1) * 1000;
          console.error(`[image] 429 rate limit, čakám ${wait / 1000}s…`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw e;
      }
    }
    const buffer = Buffer.from(await out[0].blob().then((b) => b.arrayBuffer()));

    const supabase = storage();
    const safeId = String(id || Date.now()).replace(/[^a-z0-9_-]/gi, '');
    const path = `krypto/${safeId}.webp`;
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      const { error } = await supabase.storage.from(BUCKET)
        .upload(path, buffer, { contentType: 'image/webp', upsert: true });
      if (!error) { ok = true; break; }
      console.error(`[image] upload pokus ${attempt}/3 zlyhal: ${error.message}`);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
    if (!ok) return '';
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl || '';
  } catch (e) {
    console.error('generateImage zlyhalo:', e.message);
    return '';
  }
}
