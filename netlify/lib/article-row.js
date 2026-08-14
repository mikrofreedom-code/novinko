// Zostavenie riadku pre hárok "articles" (stĺpce A:I). Zdieľané medzi
// telegram-webhook.js (schválené články z novinko-redakcia) a
// manual-publish.js (ručne pridané články cez formulár).
// Rovnaký formát ako novinko-redakcia/lib/_shared/sheets.js articleToRow
// (A:id, B:titulok, C:perex, D:telo, E:zdroj|link, F:dátum, G:kategória,
//  H:obrázok, I:zdroj obrázka).
const PARAGRAPH_DELIM = "¶¶";

// Text sa v hárku ukladá s ¶¶ medzi odsekmi — skutočný nový riadok by rozbil
// CSV riadok, z ktorého web číta.
//
// Prečo je tu tá vetva s jednoduchým riadkom (2026-08-14): pôvodne sa delilo
// LEN na `\n{2,}`, teda na prázdny riadok. Writer tak píše, ale človek vo
// formulári stlačí Enter raz — a riadok nižšie mu jednoduchý `\n` premenil na
// medzeru, takže celý článok skončil ako jeden blok textu. Stalo sa to štyrom
// ručne publikovaným článkom (4 000 znakov v jednom odseku).
//
// Poradie je zámerné: keď text obsahuje prázdne riadky, delíme podľa nich
// a jednoduché zalomenia vnútri odseku sa správne zlepia. Až keď žiadny
// prázdny riadok nie je, berieme jednoduché zalomenie ako koniec odseku.
function paragraphsToCell(body) {
  const text = String(body || "");
  const oddelovac = /\n{2,}/.test(text) ? /\n{2,}/ : /\n+/;
  return text
    .split(oddelovac).map((p) => p.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean)
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
    article.image_credit || "",   // I: zdroj obrázka (len pri vlastnej fotke)
  ];
}

module.exports = { paragraphsToCell, uniqueId, articleToRow };
