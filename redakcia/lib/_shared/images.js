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
const AI_DEFAULT = 'artificial intelligence and machine learning, abstract neural network, futuristic technology, glowing data streams';
const SECTION_DEFAULT = { krypto: KRYPTO_DEFAULT, ai: AI_DEFAULT };

// Vizuálny základ podľa SEKCIE + entity + titulku (FALLBACK bez AI).
// Spätná kompat: string argument = title (krypto). Objekt = { section, entity, title }.
export function buildPrompt(arg) {
  const a = typeof arg === 'string' ? { title: arg } : (arg || {});
  const section = a.section ?? 'krypto';
  let subject;
  if (section === 'krypto') {
    // krypto: konkrétna minca podľa entity/titulku, inak všeobecný krypto vizuál
    const t = `${a.entity ?? ''} ${a.title ?? ''}`.toLowerCase();
    const hit = COIN_THEMES.find((c) => c.keys.some((k) => new RegExp(`\\b${k}\\b`).test(t)));
    subject = hit ? hit.theme : KRYPTO_DEFAULT;
  } else {
    const base = SECTION_DEFAULT[section] ?? `${section} theme`;
    subject = a.entity ? `${base}, themed around ${a.entity}` : base;
  }
  return `professional news illustration, ${subject}, dark modern background, `
       + `dramatic lighting, clean digital art, high detail, editorial style, `
       + `no text, no words, no letters, no logos, no real people`;
}

function storage() {
  return createClient(process.env.IMAGE_SUPABASE_URL, process.env.IMAGE_SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Vráti permanentnú URL obrázka, alebo '' ak čokoľvek zlyhá (článok ostane bez obrázka).
// opts: { section, entity, prompt }. `prompt` (napr. z Haiku) prebije šablónu.
export async function generateImage(title, id, opts = {}) {
  try {
    if (!process.env.REPLICATE_API_TOKEN || !process.env.IMAGE_SUPABASE_URL || !process.env.IMAGE_SUPABASE_KEY) {
      return '';
    }
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    const prompt = opts.prompt || buildPrompt({ section: opts.section, entity: opts.entity, title });
    const input = { prompt, aspect_ratio: '16:9', output_format: 'webp', num_outputs: 1 };

    // Replicate má pri nízkom kredite limit 6/min (burst 1) → pri 429 počkaj a skús znova.
    //
    // 404 "No adapter found for model" (2026-07-31): Replicate ho občas vráti aj
    // pri existujúcom modeli — v jednom behu padli 2 z 3 volaní, tretie prešlo,
    // a priame overenie modelu cez /v1/models hneď nato vrátilo 200. Je to teda
    // PRECHODNÁ chyba na ich strane, nie zlá referencia modelu. Predtým sa brala
    // ako smrteľná a článok zostal bez obrázka.
    let out;
    let lastPrediction = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        out = await replicate.run('black-forest-labs/flux-schnell', { input },
                                  (p) => { lastPrediction = p; });
        break;
      }
      catch (e) {
        const m = /retry.?after["\s:]+(\d+)/i.exec(e.message);
        const is429 = /\b429\b|throttl|rate limit/i.test(e.message);
        const isNoAdapter = /no adapter found for model/i.test(e.message);
        if ((is429 || isNoAdapter) && attempt < 4) {
          const wait = is429 ? ((m ? Number(m[1]) : 11) + 1) * 1000 : 3000 * attempt;
          console.error(`[image] ${is429 ? '429 rate limit' : '404 no-adapter (prechodné)'}, čakám ${wait / 1000}s…`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw e;
      }
    }
    // run() vráti null, keď serverové čakanie (Prefer: wait, ~60 s) vyprší a predikcia
    // ešte beží: index.js:172 pokladá za nedokončený IBA stav 'starting', takže pri
    // 'processing' preskočí dopollovanie, stav nie je 'failed' a vráti prázdny output.
    // Predikcia pritom normálne dobehne — treba ju len dopollovať. Doteraz to spadlo
    // na out[0] ako "Cannot read properties of null" (87× v logu do 2026-08-10),
    // článok išiel bez obrázka a už zaplatená predikcia sa zahodila.
    if (!out && lastPrediction) {
      const done = await replicate.wait(lastPrediction, { interval: 1000 });
      if (done.status === 'failed') throw new Error(`Prediction failed: ${done.error}`);
      out = done.output;
      const tvar = Array.isArray(out) ? `pole[${out.length}]` : typeof out;
      console.error(`[image] run() vrátil null (stav ${lastPrediction.status}) — dopollované, výstup: ${tvar}`);
    }
    if (!out) throw new Error('Replicate nevrátil žiadny výstup');

    // Výstup chodí v TROCH tvaroch a všetky tri treba zvládnuť:
    //   run()  → pole FileOutput objektov (majú .blob())
    //   wait() → pole URL stringov, ALEBO samotný URL string
    //
    // Ten posledný prípad zhodil 17 z 19 dopollovaní 12.8.2026: out[0] z reťazca
    // "https://…" vybralo znak "h" a fetch spadol na "Failed to parse URL from h".
    // Preto sa najprv normalizuje na pole a až potom sa siaha na prvý prvok.
    const list = Array.isArray(out) ? out : [out];
    const first = list[0];
    if (!first) throw new Error('Replicate nevrátil žiadny výstup');

    let buffer;
    if (typeof first === 'string') {
      if (!/^https?:\/\//.test(first)) throw new Error(`Replicate vrátil neplatnú URL: ${first.slice(0, 40)}`);
      buffer = Buffer.from(await (await fetch(first)).arrayBuffer());
    } else {
      buffer = Buffer.from(await first.blob().then((b) => b.arrayBuffer()));
    }

    const supabase = storage();
    const safeId = String(id || Date.now()).replace(/[^a-z0-9_-]/gi, '');
    const folder = (opts.section || 'krypto').replace(/[^a-z0-9_-]/gi, '') || 'krypto';
    const path = `${folder}/${safeId}.webp`;
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
