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

function obal({ title, description, canonical, image, date, telo, jsonLd }) {
  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <!-- Bez max-image-preview:large ukáže Google vo výsledkoch len malý štvorcový
       náhľad a hlavne NEZARADÍ stránku do Discoveru — toho kanála, ktorý sype
       články ľuďom do telefónu. Je to podmienka, nie odporúčanie. -->
  <meta name="robots" content="max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${esc(canonical)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:site_name" content="Novinko" />
${image ? `  <meta property="og:image" content="${esc(image)}" />\n` : ""}${date ? `  <meta property="article:published_time" content="${esc(date)}" />\n` : ""}  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/clanok.css" />
${jsonLd ? `  <script type="application/ld+json">${jsonLd}</script>\n` : ""}</head>
<body>
${hlavicka()}
${telo}
<footer>novinko &mdash; všetky aktuálne správy na jednom mieste<span style="display:flex;gap:16px;align-items:center;justify-content:center;margin-top:10px"><a href="https://www.tiktok.com/@novinko.sk" target="_blank" rel="noopener me" aria-label="Novinko na TikToku" title="Novinko na TikToku" style="color:var(--text2);display:inline-flex;align-items:center"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></a><a href="https://x.com/novinkosk" target="_blank" rel="noopener me" aria-label="Novinko na X" title="Novinko na X" style="color:var(--text2);display:inline-flex;align-items:center"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a></span></footer>
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
    jsonLd: newsArticleJsonLd(article, popis),
  });
}

// Štruktúrované dáta NewsArticle — podmienka pre zaradenie do Top stories.
// Google potrebuje vedieť, že ide o spravodajský článok, kedy vyšiel a kto zaň
// ručí. Novinko má na to dobré podklady: reálna firma, evidenčné číslo
// EV 176/26/SWP a impressum s uvedeným šéfredaktorom.
//
// POZOR NA CSP: je to <script type="application/ld+json">, teda dátový blok,
// nie spustiteľný kód — prehliadač ho nevykonáva a script-src sa naň nevzťahuje.
// gen-csp.mjs ho ani nevidí (prehľadáva len koreň _site/, nie výstup funkcie).
// Overené v prehliadači: žiadne CSP hlásenie.
function newsArticleJsonLd(article, popis) {
  const { title, date, imageUrl } = article;
  const data = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    // Google pri Top stories odporúča titulok do 110 znakov. Skracuje sa LEN
    // tu, <h1> a <title> zostávajú celé.
    headline: String(title).slice(0, 110),
    description: popis,
    datePublished: date,
    dateModified: date,
    mainEntityOfPage: { "@type": "WebPage", "@id": clanokUrl(article) },
    author: { "@type": "Organization", name: "Novinko", url: SITE },
    publisher: { "@type": "Organization", name: "Novinko", url: SITE },
    inLanguage: "sk-SK",
  };
  if (imageUrl) data.image = [imageUrl];
  // </script> vnútri JSON by predčasne ukončilo blok — jediný reálny únikový
  // vektor pri vkladaní JSON do HTML.
  return JSON.stringify(data).replace(/</g, "\\u003c");
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
