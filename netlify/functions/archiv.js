// Servíruje INDEXOVATEĽNÝ archív na /archiv — všetky články ako obyčajné
// odkazy, zoskupené po kategóriách. Prepis adresy nastavuje netlify.toml.
//
// PREČO (2026-08-29): Search Console hlásila 32 indexovaných a 141 nie,
// z toho 130 v stave „Objavené – momentálne nie je v indexe". Všetkých 31
// zaindexovaných článkov malo dátum prehľadania 17. 8. — Google prišiel raz,
// zobral dávku a už sa po zvyšok nevrátil. Na 18 dní starej doméne je to
// crawl budget, nie posúdenie obsahu (zaindexoval aj bežné agregované správy).
//
// Crawl budget sa neprideľuje podľa sitemapy, ale podľa odkazov. Odkaz na
// archív na hlavnej stránke bol (index.html), ale mieril na archiv.html —
// stránku s `noindex`, skladanú JavaScriptom, ktorá v surovom HTML nemá ani
// jeden odkaz na článok. Crawler teda prišiel a skončil v slepej uličke.
//
// PREČO FUNKCIA A NIE STATICKÝ SÚBOR: rovnaký dôvod ako pri clanok.js —
// Netlify účtuje 15 kreditov za produkčný deploy, takže build po každom
// zverejnení je neúnosný. Funkcia je navyše vždy čerstvá, takže nový článok
// je v archíve hneď a Google ho má odkiaľ objaviť.
//
// archiv.html ostáva nedotknutý (má `noindex`, takže duplicitu nerobí) —
// slúži už rozposlaným odkazom a ponúka filtrovanie v prehliadači.

const { SHEET_CSV_URL, CATS } = require("../lib/config");
const { parseCSVLine } = require("../lib/csv");
const { renderArchiv, renderNenajdene } = require("../lib/clanok-render");

const HTML = { "Content-Type": "text/html; charset=utf-8" };
// Rovnaké hodnoty ako clanok.js. Kratší čas na CDN by nič nepriniesol, dlhší
// by oddialil objavenie nových článkov — a práve kvôli tomu tá stránka je.
const CACHE = "public, max-age=300, s-maxage=600, stale-while-revalidate=3600";

exports.handler = async () => {
  let riadky;
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    riadky = (await res.text()).trim().split("\n").slice(1).filter((l) => l.trim());
  } catch (e) {
    console.error("[archiv] hárok sa nedá načítať:", e.message);
    // 503 a nie 404 — pri 404 Google adresu z indexu vyhodí, pri 503 sa vráti.
    return { statusCode: 503, headers: { ...HTML, "Retry-After": "300" }, body: renderNenajdene() };
  }

  const clanky = riadky.map((line) => {
    const [id, title, perex, content, source, date, category] = parseCSVLine(line);
    if (!id || !title) return null;
    return { id, title, perex, content, source, date, category };
  }).filter(Boolean);

  if (!clanky.length) {
    return { statusCode: 503, headers: { ...HTML, "Retry-After": "300" }, body: renderNenajdene() };
  }

  return {
    statusCode: 200,
    headers: { ...HTML, "Cache-Control": CACHE },
    body: renderArchiv(clanky, CATS),
  };
};
