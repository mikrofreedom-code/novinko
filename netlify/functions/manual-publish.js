// Ručné publikovanie článku cez formulár (publikovat.html) — bez terminálu,
// bez editovania Google Sheetu ručne (to je krehké, ľahko sa pokazí formát).
// Chránené jednoduchým zdieľaným heslom (MANUAL_PUBLISH_SECRET).

const { articleToRow } = require("../lib/article-row");
const { appendRow } = require("../lib/sheets");
const { sendArticle } = require("../lib/telegram");
const { generateImage, uploadUserImage } = require("../lib/images");

// Netlify má strop na telo požiadavky ~6 MB a base64 nafúkne dáta o ~37 %.
// Kontroluje sa aj na strane formulára, ale tam sa to dá obísť — tu je to isté.
const MAX_FOTO_MB = 4;
const POVOLENE_TYPY = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const { safeEqual } = require("../lib/guard");
const { connect, recentFailures, recordFailure, clearFailures, RL_MAX_FAILURES } = require("../lib/store");

const SECRET = process.env.MANUAL_PUBLISH_SECRET;

// Verejný endpoint chránený jediným zdieľaným heslom => bez obmedzenia počtu
// pokusov sa dá hádať donekonečna a uhádnutie znamená zápis článkov na živý web.
function clientIp(event) {
  const h = event.headers || {};
  return h["x-nf-client-connection-ip"]
      || h["client-ip"]
      || String(h["x-forwarded-for"] || "").split(",")[0].trim()
      || "unknown";
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "len POST" }) };
  }
  connect(event);

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "zlý formát požiadavky" }) }; }

  const ip = clientIp(event);
  if (await recentFailures(ip) >= RL_MAX_FAILURES) {
    return { statusCode: 429, body: JSON.stringify({ error: "priveľa neúspešných pokusov, skús o 15 minút" }) };
  }

  // Zlyháva zatvorene (bez nastaveného hesla neprejde nikto) a porovnáva
  // konštantne v čase (`safeEqual`), nie `!==`.
  if (!SECRET || !safeEqual(body.password, SECRET)) {
    await recordFailure(ip);
    return { statusCode: 401, body: JSON.stringify({ error: "nesprávne heslo" }) };
  }
  await clearFailures(ip);

  const { headline, perex, text, source, sourceUrl, category, imageUrl, generateAiImage, imagePrompt,
          imageBase64, imageType, imageCredit } = body;
  if (!headline || !text) {
    return { statusCode: 400, body: JSON.stringify({ error: "chýba titulok alebo text článku" }) };
  }

  const article = {
    headline: String(headline).trim(),
    perex: perex ? String(perex).trim() : "",
    body: String(text),
    category: category === "ai" ? "ai" : "krypto",
    sources: [{ name: source ? String(source).trim() : "Novinko", url: sourceUrl ? String(sourceUrl).trim() : "" }],
  };

  // Poradie: nahratá fotka → odkaz → AI ilustrácia.
  if (imageBase64) {
    if (!POVOLENE_TYPY.includes(imageType)) {
      return { statusCode: 400, body: JSON.stringify({ error: `nepodporovaný typ obrázka: ${imageType || "neznámy"}` }) };
    }
    const buffer = Buffer.from(String(imageBase64), "base64");
    if (!buffer.length) {
      return { statusCode: 400, body: JSON.stringify({ error: "fotku sa nepodarilo prečítať" }) };
    }
    if (buffer.length > MAX_FOTO_MB * 1024 * 1024) {
      return { statusCode: 413, body: JSON.stringify({ error: `fotka má ${(buffer.length / 1024 / 1024).toFixed(1)} MB, maximum je ${MAX_FOTO_MB} MB` }) };
    }
    try {
      article.image_url = await uploadUserImage(buffer, imageType);
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  } else if (imageUrl && String(imageUrl).trim().startsWith("http")) {
    // CSP webu povoľuje img-src len 'self', data: a https://*.supabase.co. Odkaz
    // inam by sa zverejnil, ale prehliadač by ho zablokoval a článok by vyšiel bez
    // obrázka — ticho. Radšej to odmietnuť hneď a povedať prečo.
    const u = String(imageUrl).trim();
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\//i.test(u)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Odkaz na obrázok z cudzieho webu by CSP zablokovala a článok by vyšiel bez obrázka. Použi pole na nahratie fotky." }),
      };
    }
    article.image_url = u;
  } else if (generateAiImage || (imagePrompt && imagePrompt.trim())) {
    article.image_url = await generateImage(article.headline, article.category, Date.now(), imagePrompt);
  }

  // Zdroj obrázka sa uvádza len pri vlastnej fotke. Pri AI ilustrácii by bol
  // mätúci — tam pôvod hovorí popisok "vytvorené umelou inteligenciou".
  if (article.image_url && imageCredit && String(imageCredit).trim()) {
    article.image_credit = String(imageCredit).trim().slice(0, 200);
  }

  try {
    const row = articleToRow(article, article.category);
    await appendRow(process.env.GOOGLE_SHEETS_ID, row, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const tg = await sendArticle({ title: article.headline, perex: article.perex, imageUrl: article.image_url, sheetId: row[0] });
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, id: row[0], telegram: tg.sent ? "poslané" : (tg.skipped || tg.error) }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
