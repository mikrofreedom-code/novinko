// Ručné publikovanie článku cez formulár (publikovat.html) — bez terminálu,
// bez editovania Google Sheetu ručne (to je krehké, ľahko sa pokazí formát).
// Chránené jednoduchým zdieľaným heslom (MANUAL_PUBLISH_SECRET).

const { articleToRow } = require("../lib/article-row");
const { appendRow } = require("../lib/sheets");
const { sendArticle } = require("../lib/telegram");

const SECRET = process.env.MANUAL_PUBLISH_SECRET;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "len POST" }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "zlý formát požiadavky" }) }; }

  if (!SECRET || body.password !== SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: "nesprávne heslo" }) };
  }

  const { headline, perex, text, source, sourceUrl, category } = body;
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

  try {
    const row = articleToRow(article, article.category);
    await appendRow(process.env.GOOGLE_SHEETS_ID, row, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const tg = await sendArticle({ title: article.headline, perex: article.perex, sheetId: row[0] });
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, id: row[0], telegram: tg.sent ? "poslané" : (tg.skipped || tg.error) }),
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
