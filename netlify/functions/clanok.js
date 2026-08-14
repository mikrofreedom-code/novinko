// Servíruje INDEXOVATEĽNÚ stránku článku na /clanok/<slug>-<id>.
// Prepis adresy nastavuje netlify.toml ([[redirects]] so status 200).
//
// Odpoveď sa cachuje na CDN (s-maxage), takže opakované návštevy funkciu ani
// nespustia — pri 15 kreditoch za deploy je toto rádovo lacnejšia cesta ako
// generovanie stránok pri builde. Podrobnosti v netlify/lib/clanok-render.js.

const { SHEET_CSV_URL } = require("../lib/config");
const { parseCSVLine } = require("../lib/csv");
const { renderClanok, renderNenajdene, clanokUrl } = require("../lib/clanok-render");

const HTML = { "Content-Type": "text/html; charset=utf-8" };
// 5 min v prehliadači, 10 min na CDN, hodinu smie servírovať starú kópiu počas
// obnovy. Článok sa po zverejnení mení len výnimočne (oprava preklepu v hárku).
const CACHE = "public, max-age=300, s-maxage=600, stale-while-revalidate=3600";

// Z /clanok/nejaky-slug-178663738626001 vytiahni koncové číselné id.
function idZCesty(path) {
  const posledny = String(path || "").split("/").filter(Boolean).pop() || "";
  const bezPripony = posledny.replace(/\.html$/, "");
  const m = bezPripony.match(/(\d{6,})$/);
  return m ? m[1] : null;
}

exports.handler = async (event) => {
  const id = idZCesty(event.path)
    || (event.queryStringParameters && event.queryStringParameters.id);

  if (!id) {
    return { statusCode: 404, headers: HTML, body: renderNenajdene() };
  }

  let riadky;
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    riadky = (await res.text()).trim().split("\n").slice(1).filter((l) => l.trim());
  } catch (e) {
    console.error("[clanok] hárok sa nedá načítať:", e.message);
    // 503 a nie 404 — Google pri 404 adresu z indexu vyhodí, pri 503 sa vráti.
    return { statusCode: 503, headers: { ...HTML, "Retry-After": "300" }, body: renderNenajdene() };
  }

  const clanky = riadky.map((line) => {
    const [cid, title, perex, content, source, date, category, imageUrl, imageCredit] = parseCSVLine(line);
    if (!cid || !title) return null;
    return { id: cid, title, perex, content, source, date, category, imageUrl, imageCredit };
  }).filter(Boolean);

  const clanok = clanky.find((c) => c.id === id);
  if (!clanok) {
    return { statusCode: 404, headers: HTML, body: renderNenajdene() };
  }

  // Vnútorné prelinkovanie — bez neho by ku článkom viedla len sitemap
  // a crawler by nemal po webe ako prejsť ďalej.
  const dalsie = clanky
    .filter((c) => c.id !== id)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6)
    .map((c) => ({ title: c.title, url: clanokUrl(c) }));

  return {
    statusCode: 200,
    headers: { ...HTML, "Cache-Control": CACHE },
    body: renderClanok(clanok, dalsie),
  };
};
