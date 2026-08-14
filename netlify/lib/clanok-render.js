// Skladá HTML stránky článku NA SERVERI — pre vyhľadávače a pre návštevníkov,
// ktorí prídu z Googlu.
//
// PREČO (2026-08-14): clanok.html sa skladá až v prehliadači, takže crawler
// videl pri všetkých ~50 článkoch ten istý prázdny dokument s titulkom
// „Novinko — Článok". Na hlavnej stránke nebol ani jeden odkaz na článok.
// Google teda nemal čo indexovať a návštevnosť chodila výhradne z X.
//
// PREČO FUNKCIA A NIE GENEROVANIE PRI BUILDE:
// Netlify účtuje 15 kreditov za produkčný deploy a Personal plán má 1 000
// kreditov mesačne — teda ~66 deployov. Build po každom zverejnení (5–15
// článkov denne) by stál 2 250–6 750 kreditov, čiže niekoľkonásobok plánu.
// Funkcia stojí compute: ~4 500 volaní mesačne vyjde na jednotky kreditov
// a navyše je vždy čerstvá, takže článok je indexovateľný hneď po zverejnení.
//
// Štýly sa načítavajú z /clanok.css, ktorý zdieľa aj clanok.html — aby sa obe
// verzie nemohli vzhľadovo rozísť.

const { PARAGRAPH_DELIM } = require("./config");

const SITE = "https://novinko.sk";

const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Slug z titulku — bez diakritiky, aby bola adresa čitateľná a stabilná.
function slugify(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "clanok";
}

function clanokUrl({ title, id }) {
  return `${SITE}/clanok/${slugify(title)}-${id}`;
}

function odseky(content) {
  return String(content ?? "")
    .split(new RegExp(`\\s*${PARAGRAPH_DELIM}\\s*|\\n\\n`))
    .map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`).join("\n        ");
}

// Rovnaká logika ako v clanok.html: priečinok v ceste nesie pôvod obrázka.
// manual/ = fotka od človeka, krypto|ai|evergreen = AI. Popisok o AI sa preto
// zobrazí len pri ilustrácii; pod skutočnou fotkou by bol nepravdivý. Zadaný
// zdroj má prednosť — atribúcia je právna povinnosť, popisok o AI informatívny.
function popisObrazka(imageUrl, imageCredit) {
  if (imageCredit) return `<figcaption class="img-credit">Foto: ${esc(imageCredit)}</figcaption>`;
  if (/\/manual\//.test(imageUrl)) return "";
  return `<figcaption class="img-credit">Ilustračný obrázok vytvorený umelou inteligenciou</figcaption>`;
}

function datumSk(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("sk-SK", {
    timeZone: "Europe/Bratislava",
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function hlavicka() {
  return `<header>
  <div class="header-inner">
    <a href="/" class="back-btn">← Späť</a>
    <a href="/" class="logo">novinko<span>.</span></a>
    <span class="logo-tagline">Píše AI. Človek kontroluje.</span>
  </div>
</header>`;
}

function obal({ title, description, canonical, image, date, telo }) {
  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:site_name" content="Novinko" />
${image ? `  <meta property="og:image" content="${esc(image)}" />\n` : ""}${date ? `  <meta property="article:published_time" content="${esc(date)}" />\n` : ""}  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/clanok.css" />
</head>
<body>
${hlavicka()}
${telo}
<footer>novinko &mdash; všetky aktuálne správy na jednom mieste</footer>
</body>
</html>
`;
}

// article: { id, title, perex, content, source, date, category, imageUrl, imageCredit }
// dalsie:  pole { title, url } na vnútorné prelinkovanie (crawl cesta pre Google)
function renderClanok(article, dalsie = []) {
  const { title, perex, content, source, date, category, imageUrl, imageCredit } = article;
  const sourceParts = String(source || "").split("|");
  const sourceName = (sourceParts[0] || "").trim();
  const sourceLink = (sourceParts[1] || "").trim();
  const popis = (perex || String(content || "").slice(0, 200)).replace(/\s+/g, " ").trim().slice(0, 300);

  const telo = `<div class="article-wrap">
  <div class="article-meta">
    <span class="cat-badge">${esc(category || "správy")}</span>
    <span class="article-source">tím Novinko</span>
    <span class="article-date"><time datetime="${esc(date)}">${esc(datumSk(date))}</time></span>
  </div>
  <h1 class="article-title">${esc(title)}</h1>
  ${imageUrl ? `<figure class="article-figure"><img src="${esc(imageUrl)}" alt="" class="article-img" loading="lazy">${popisObrazka(imageUrl, imageCredit)}</figure>` : ""}
  ${perex ? `<div class="article-perex">${esc(perex)}</div>` : ""}
  <div class="article-content">
        ${odseky(content)}
  </div>
  <div class="article-footer">
    <div class="source-link">${
      sourceLink
        ? `Zdroj: <a href="${esc(sourceLink)}" target="_blank" rel="noopener nofollow">${esc(sourceName)}</a>`
        : `Zdroj: ${esc(sourceName || "Novinko")}`
    }</div>
    <a href="/" class="back-link">← Všetky správy</a>
  </div>
${dalsie.length ? `  <nav class="dalsie-clanky">
    <h2>Ďalšie správy</h2>
    <ul>
      ${dalsie.map((d) => `<li><a href="${esc(d.url)}">${esc(d.title)}</a></li>`).join("\n      ")}
    </ul>
  </nav>` : ""}
</div>`;

  return obal({
    title: `${title} — Novinko`,
    description: popis,
    canonical: clanokUrl(article),
    image: imageUrl,
    date,
    telo,
  });
}

function renderNenajdene() {
  return obal({
    title: "Článok nenájdený — Novinko",
    description: "Požadovaný článok neexistuje alebo bol odstránený.",
    canonical: `${SITE}/`,
    telo: `<div class="article-wrap">
  <h1 class="article-title">Článok nenájdený</h1>
  <div class="article-perex">Odkaz je neplatný alebo bol článok odstránený.</div>
  <div class="article-footer"><a href="/" class="back-link">← Všetky správy</a></div>
</div>`,
  });
}

module.exports = { renderClanok, renderNenajdene, clanokUrl, slugify, esc, SITE };
