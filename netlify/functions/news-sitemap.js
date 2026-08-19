// Google News sitemap — LEN články za posledných 48 hodín.
//
// Google ju číta podstatne častejšie než bežnú sitemap, takže nový článok sa
// dostane do indexu v desiatkach minút namiesto dní. Pri spravodajstve je to
// rozdiel medzi „aktuálne" a „už to nikoho nezaujíma".
//
// Okno 48 h je daná špecifikácia, nie naše rozhodnutie: Google do news sitemapy
// staršie články nechce a ich prítomnosť hlási ako chybu. Bežná sitemap
// (sitemap.js) obsahuje všetko a beží ďalej nezávisle — táto ju dopĺňa,
// nenahrádza.
//
// Pozor: <news:publication><news:name> musí sedieť s názvom publikácie
// zaregistrovaným v Google Publisher Center, inak to Google ignoruje.

const { SHEET_CSV_URL } = require("../lib/config");
const { parseCSVLine } = require("../lib/csv");
const { clanokUrl, esc, SITE } = require("../lib/clanok-render");

const XML = { "Content-Type": "application/xml; charset=utf-8" };
const OKNO_H = 48;
const NAZOV_PUBLIKACIE = "Novinko";

exports.handler = async () => {
  let riadky = [];
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    riadky = (await res.text()).trim().split("\n").slice(1).filter((l) => l.trim());
  } catch (e) {
    console.error("[news-sitemap] hárok sa nedá načítať:", e.message);
  }

  const hranica = Date.now() - OKNO_H * 60 * 60 * 1000;
  const clanky = riadky.map((line) => {
    const [id, title, , , , date] = parseCSVLine(line);
    if (!id || !title || !date) return null;
    const t = new Date(date).getTime();
    if (isNaN(t) || t < hranica) return null;
    return { id, title, date };
  }).filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${clanky.map((c) => `  <url>
    <loc>${esc(clanokUrl(c))}</loc>
    <news:news>
      <news:publication>
        <news:name>${esc(NAZOV_PUBLIKACIE)}</news:name>
        <news:language>sk</news:language>
      </news:publication>
      <news:publication_date>${esc(new Date(c.date).toISOString())}</news:publication_date>
      <news:title>${esc(c.title)}</news:title>
    </news:news>
  </url>`).join("\n")}
</urlset>
`;

  return {
    statusCode: 200,
    // Kratšia cache než pri bežnej sitemape — obsah okna sa mení každú hodinu,
    // ako pribúdajú a vypadávajú články.
    headers: { ...XML, "Cache-Control": "public, max-age=300, s-maxage=900" },
    body: xml,
  };
};
