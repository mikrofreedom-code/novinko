// Generovanie obrázkov ku článkom cez Flux Schnell (Replicate) + upload do Supabase Storage.
const Replicate = require("replicate");
const { createClient } = require("@supabase/supabase-js");

// ws fallback pre Node < 22 (Netlify býva novší, lokálne Node 20 nie)
let wsTransport;
try { wsTransport = require("ws"); } catch (e) { wsTransport = undefined; }

const BUCKET = process.env.SUPABASE_BUCKET || "article-images";

// Detekcia coinu v titulku → tematický vizuál
const COIN_THEMES = [
  { keys: ["bitcoin", "btc"],       theme: "golden Bitcoin coin, orange and gold tones" },
  { keys: ["ethereum", "eth"],      theme: "Ethereum crystal logo, silver and blue tones" },
  { keys: ["solana", "sol"],        theme: "Solana abstract waves, purple and teal gradient" },
  { keys: ["xrp", "ripple"],        theme: "XRP coin, dark blue tones" },
  { keys: ["cardano", "ada"],       theme: "Cardano blue geometric theme" },
  { keys: ["dogecoin", "doge"],     theme: "playful Dogecoin coin, yellow tones" },
  { keys: ["bnb", "binance"],       theme: "BNB gold coin, black and yellow" },
];

const CATEGORY_THEMES = {
  krypto:    "cryptocurrency and blockchain, digital coins, trading charts",
  svet:      "world news, global map, abstract editorial photo",
  ekonomika: "finance and economy, stock charts, banknotes, business",
  sport:     "sports action, stadium, dynamic motion",
  slovensko: "Slovak news, editorial, modern clean",
};

function buildPrompt(title, category) {
  const t = (title || "").toLowerCase();
  let subject = CATEGORY_THEMES[category] || "news editorial illustration";
  if (category === "krypto") {
    const hit = COIN_THEMES.find((c) => c.keys.some((k) => new RegExp(`\\b${k}\\b`).test(t)));
    if (hit) subject = hit.theme;
  }
  return `professional news illustration, ${subject}, dark modern background, ` +
         `dramatic lighting, clean digital art, high detail, editorial style, no text, no words, no letters`;
}

function makeSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: wsTransport ? { transport: wsTransport } : undefined,
  });
}

// Vráti permanentnú Supabase URL, alebo "" ak čokoľvek zlyhá (článok sa aj tak uloží).
async function generateImage(title, category, id) {
  try {
    if (category !== "krypto") return "";   // obrázky len pre krypto sekciu
    if (!process.env.REPLICATE_API_TOKEN || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return "";
    }
    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
    const prompt = buildPrompt(title, category);

    const out = await replicate.run("black-forest-labs/flux-schnell", {
      input: { prompt, aspect_ratio: "16:9", output_format: "webp", num_outputs: 1 },
    });
    const buffer = Buffer.from(await out[0].blob().then((b) => b.arrayBuffer()));

    const supabase = makeSupabase();
    const safeId = String(id || Date.now()).replace(/[^a-z0-9_-]/gi, "");
    const path = `${category || "news"}/${safeId}.webp`;
    const { error } = await supabase.storage.from(BUCKET)
      .upload(path, buffer, { contentType: "image/webp", upsert: true });
    if (error) { console.error("Supabase upload:", error.message); return ""; }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl || "";
  } catch (e) {
    console.error("generateImage zlyhalo:", e.message);
    return "";
  }
}

module.exports = { generateImage, buildPrompt };
