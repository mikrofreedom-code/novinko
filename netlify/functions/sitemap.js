// Sitemap pre Google. Generuje sa pri požiadavke, nie pri builde — články
// pribúdajú priebežne cez Google Sheet a build je pri kreditovom účtovaní drahý
// (15 kreditov za deploy). Takto je zoznam vždy aktuálny a stojí zlomok kreditu:
// sitemap si stiahne crawler rádovo raz za deň a CDN ju medzitým cachuje.
//
// Do zoznamu ide len hlavná stránka a články. archiv, impressum, podmienky,
// sukromie, dsa a pravo-na-opravu majú v HTML noindex — ponúkať ich Googlu
// a vzápätí mu povedať „neindexuj" je rozporuplný signál a míňa crawl budget.

const { SHEET_CSV_URL } = require("../lib/config");
const { parseCSVLine } = require("../lib/csv");
const { clanokUrl, esc, SITE } = require("../lib/clanok-render");

const XML = { "Content-Type": "application/xml; charset=utf-8" };

exports.handler = async () => {
  let riadky = [];
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    riadky = (await res.text()).trim().split("\n").slice(1).filter((l) => l.trim());
  } catch (e) {
    console.error("[sitemap] hárok sa nedá načítať:", e.message);
    // Aj tak vrátime platnú sitemap s hlavnou stránkou — prázdna odpoveď alebo
    // chyba by Googlu signalizovala, že sitemap je rozbitá.
  }

  const clanky = riadky.map((line) => {
    const [id, title, , , , date] = parseCSVLine(line);
    if (!id || !title) return null;
    return { id, title, date };
  }).filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const dnes = new Date().toISOString().slice(0, 10);
  const den = (d) => {
    const t = new Date(d);
    return isNaN(t.getTime()) ? dnes : t.toISOString().slice(0, 10);
  };

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}/</loc><lastmod>${dnes}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>
${clanky.map((c) => `  <url><loc>${esc(clanokUrl(c))}</loc><lastmod>${den(c.date)}</lastmod></url>`).join("\n")}
</urlset>
`;

  return {
    statusCode: 200,
    headers: { ...XML, "Cache-Control": "public, max-age=1800, s-maxage=3600" },
    body: xml,
  };
};
