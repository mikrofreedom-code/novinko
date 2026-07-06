// Zostavenie riadku pre hárok "articles" (stĺpce A:H). Zdieľané medzi
// telegram-webhook.js (schválené články z novinko-redakcia) a
// manual-publish.js (ručne pridané články cez formulár).
// Rovnaký formát ako novinko-redakcia/lib/_shared/sheets.js articleToRow
// (A:id, B:titulok, C:perex, D:telo, E:zdroj|link, F:dátum, G:kategória, H:obrázok).
const PARAGRAPH_DELIM = "¶¶";

function paragraphsToCell(body) {
  return String(body || "")
    .split(/\n{2,}/).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean)
    .join(` ${PARAGRAPH_DELIM} `);
}

let _counter = 0;
function uniqueId() { _counter += 1; return `${Date.now()}${String(_counter).padStart(2, "0")}`; }

function articleToRow(article, category) {
  const first = (article.sources || [])[0] || {};
  return [
    uniqueId(),
    article.headline,
    article.perex || "",
    paragraphsToCell(article.body),
    `${first.name || "—"} | ${first.url || ""}`,
    new Date().toISOString(),
    article.category || category || "krypto",
    article.image_url || "",
  ];
}

module.exports = { paragraphsToCell, uniqueId, articleToRow };
