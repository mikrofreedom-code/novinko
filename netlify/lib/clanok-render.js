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

// Rozbor tela receptu na intro/meta/suroviny/postup — presne ten istý formát,
// aký kódom skladá formatRecept() v redakcia/lib/flow/17-recepty.js (¶¶ medzi
// každým riadkom, nie voľný text od modelu — viď hlavička toho súboru pre
// dôvod). recepty.html na klientovi parsuje identickú štruktúru rovnakým
// spôsobom, zámerne — jeden formát, dva miesta čítania.
function parseRecept(content) {
  const odseky = String(content ?? "")
    .split(new RegExp(`\\s*${PARAGRAPH_DELIM}\\s*|\\n\\n`))
    .map((p) => p.trim()).filter(Boolean);
  const r = { intro: "", kategoria: "", prep: null, cook: null, servings: null, ingredients: [], steps: [] };
  let mode = "intro";
  const metaRe = /^Príprava:\s*(\d+)\s*min(?:\s*·\s*Varenie:\s*(\d+)\s*min)?\s*·\s*Porcie:\s*(\d+)/;
  for (const p of odseky) {
    const m = metaRe.exec(p);
    if (m) { r.prep = Number(m[1]); r.cook = m[2] ? Number(m[2]) : 0; r.servings = Number(m[3]); continue; }
    if (/^Kategória:/.test(p)) { r.kategoria = p.replace(/^Kategória:\s*/, ""); continue; }
    if (p === "Suroviny:") { mode = "ingredients"; continue; }
    if (p === "Postup:") { mode = "steps"; continue; }
    if (mode === "intro") { r.intro = r.intro ? `${r.intro} ${p}` : p; continue; }
    if (mode === "ingredients") { r.ingredients.push(p); continue; }
    if (mode === "steps") { r.steps.push(p.replace(/^\d+\.\s*/, "")); continue; }
  }
  return r;
}

function receptTelo(r) {
  const badge = [];
  if (r.prep != null) badge.push(`<span class="recept-meta-item">⏱ Príprava ${r.prep} min</span>`);
  if (r.cook) badge.push(`<span class="recept-meta-item">🔥 Varenie ${r.cook} min</span>`);
  if (r.servings != null) badge.push(`<span class="recept-meta-item">🍽 ${r.servings} porcie</span>`);
  return `${r.intro ? `<p class="recept-intro">${esc(r.intro)}</p>\n  ` : ""}${badge.length ? `<div class="recept-meta">${badge.join("")}</div>\n  ` : ""}<h2 class="recept-h2">Suroviny</h2>
  <ul class="recept-ingredients">
    ${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join("\n    ")}
  </ul>
  <h2 class="recept-h2">Postup</h2>
  <ol class="recept-steps">
    ${r.steps.map((s) => `<li>${esc(s)}</li>`).join("\n    ")}
  </ol>`;
}

// Tlačidlá na zdieľanie pod článkom. Facebook/X/WhatsApp/Telegram sú čisté
// odkazy na share-URL danej siete (žiadny SDK, žiadny inline JS) — CSP sa
// ich netýka, sú to len <a href>. Jediné, čo potrebuje JavaScript, je
// "kopírovať odkaz" — to rieši /share.js (externý súbor, viď build-site.sh
// prečo nie inline). title/url ide do query stringu cez encodeURIComponent,
// ktoré zároveň escapuje aj znaky nebezpečné pre HTML atribút (`"`, `<`…),
// takže netreba samostatné esc() pre tie polia.
function shareBar(title, url) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return `<div class="share-bar">
    <span class="share-label">Zdieľať</span>
    <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener" aria-label="Zdieľať na Facebooku"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-2.19c0-4.845 2.191-7.107 6.941-7.107.9 0 2.457.177 3.093.353v3.325c-.335-.036-.926-.055-1.669-.055-2.372 0-3.288.895-3.288 3.244v2.23h4.62l-.793 3.667h-3.827v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg></a>
    <a class="share-btn" href="https://twitter.com/intent/tweet?url=${u}&text=${t}" target="_blank" rel="noopener" aria-label="Zdieľať na X"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>
    <a class="share-btn" href="https://api.whatsapp.com/send?text=${t}%20${u}" target="_blank" rel="noopener" aria-label="Zdieľať cez WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413"/></svg></a>
    <a class="share-btn" href="https://t.me/share/url?url=${u}&text=${t}" target="_blank" rel="noopener" aria-label="Zdieľať cez Telegram"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></a>
    <button type="button" class="share-btn share-copy" data-share-url="${esc(url)}" aria-label="Kopírovať odkaz"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>
  </div>`;
}

// `theme: 'zahrada'`/`'recepty'` posiela čitateľa naspäť na vlastnú stránku
// rubriky, nie na hlavnú — súčasť "web vo webe" zámeru (2026-09-06/10): kto
// prišiel zo Záhrady/Receptov, nemá sa pri návrate ocitnúť na bežnej hlavnej.
const THEME_HOME = { zahrada: "/zahrada.html", recepty: "/recepty.html" };
function hlavicka(theme) {
  const domov = THEME_HOME[theme] ?? "/";
  return `<header>
  <div class="header-inner">
    <a href="${domov}" class="back-btn">← Späť</a>
    <a href="${domov}" class="logo">novinko<span>.</span></a>
    <span class="logo-tagline">Píše AI. Človek kontroluje.</span>
  </div>
</header>`;
}

// Prestyluje stránku článku na svetlý dizajn Záhrady (rovnaké tokeny ako
// zahrada.html) — bez tohto by čitateľ jedným klikom z vlastnej "webstránky"
// spadol späť do tmavého masthead-u zvyšku Novinka. Prepisuje len farby a
// písmo cez CSS premenné z clanok.css, nie štruktúru — JSON-LD/meta tagy pre
// SEO ostávajú rovnaké pre všetky kategórie.
const ZAHRADA_THEME_CSS = `<style>
  :root {
    --bg: #ffffff; --surface: #ffffff; --border: #e3e0d8;
    --accent: #4a6b1f; --gold: #4a6b1f; --text: #111111; --text2: #333333; --muted: #7a7468; --header-bg: #ffffff;
  }
  body { font-family: 'Source Sans 3', sans-serif; }
  header { border-bottom: 1px solid var(--border); }
  .logo, .article-title { font-family: 'Libre Baskerville', serif; }
  .logo { color: var(--text); }
  .back-btn { color: var(--muted); }
  .logo-tagline { color: var(--muted); }
  .article-date { background: #eef1e3; }
  .back-link:hover { color: #fff; }
</style>`;

// Rovnaký princíp ako ZAHRADA_THEME_CSS — svetlý dizajn namiesto tmavého
// masthead-u — plus vlastné triedy pre štruktúrovaný recept (suroviny/postup),
// ktoré generický .article-content odsekový render (odseky()) nevie ukázať
// prehľadne. Teplá terakotová farba namiesto zelenej Záhrady, nech sú rubriky
// vizuálne odlíšiteľné na prvý pohľad.
const RECEPTY_THEME_CSS = `<style>
  :root {
    --bg: #ffffff; --surface: #ffffff; --border: #e8ddd3;
    --accent: #b5502e; --gold: #b5502e; --text: #111111; --text2: #333333; --muted: #7a6e64; --header-bg: #ffffff;
  }
  body { font-family: 'Source Sans 3', sans-serif; }
  header { border-bottom: 1px solid var(--border); }
  .logo, .article-title { font-family: 'Libre Baskerville', serif; }
  .logo { color: var(--text); }
  .back-btn { color: var(--muted); }
  .logo-tagline { color: var(--muted); }
  .article-date { background: #f7ede4; }
  .back-link:hover { color: #fff; }
  .recept-intro { font-size: 1.05rem; color: var(--text2); line-height: 1.6; margin-bottom: 16px; }
  .recept-meta { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px; }
  .recept-meta-item { font-size: .85rem; font-weight: 600; background: #f7ede4; color: var(--accent); padding: 6px 12px; border-radius: 20px; }
  .recept-h2 { font-family: 'Libre Baskerville', serif; font-size: 1.25rem; margin: 28px 0 12px; }
  .recept-ingredients { padding-left: 20px; line-height: 1.9; }
  .recept-steps { padding-left: 22px; line-height: 1.7; }
  .recept-steps li { margin-bottom: 12px; }
</style>`;

const THEME_CSS = { zahrada: ZAHRADA_THEME_CSS, recepty: RECEPTY_THEME_CSS };

function obal({ title, description, canonical, image, date, telo, jsonLd, theme }) {
  const fonts = "family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@400;600;700";
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
  <link href="https://fonts.googleapis.com/css2?${fonts}&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/clanok.css" />
  <script src="/share.js" defer></script>
${THEME_CSS[theme] ? `  ${THEME_CSS[theme]}\n` : ""}${jsonLd ? `  <script type="application/ld+json">${jsonLd}</script>\n` : ""}</head>
<body>
${hlavicka(theme)}
${telo}
<footer>novinko &mdash; všetky aktuálne správy na jednom mieste<span style="display:block;margin-top:8px"><a href="/archiv" style="color:var(--text2)">Archív článkov</a></span><span style="display:flex;gap:16px;align-items:center;justify-content:center;margin-top:10px"><a href="https://www.tiktok.com/@novinko.sk" target="_blank" rel="noopener me" aria-label="Novinko na TikToku" title="Novinko na TikToku" style="color:var(--text2);display:inline-flex;align-items:center"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg></a><a href="https://x.com/novinkosk" target="_blank" rel="noopener me" aria-label="Novinko na X" title="Novinko na X" style="color:var(--text2);display:inline-flex;align-items:center"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a></span></footer>
</body>
</html>
`;
}

// article: { id, title, perex, content, source, date, category, imageUrl, imageCredit }
// dalsie:  pole { title, url } na vnútorné prelinkovanie (crawl cesta pre Google)
const THEME_LABEL = { zahrada: { home: "/zahrada.html", back: "← Celá rubrika Záhrada", dalsie: "Ďalšie zo Záhrady" },
                       recepty: { home: "/recepty.html", back: "← Celá rubrika Recepty", dalsie: "Ďalšie recepty" } };

function renderClanok(article, dalsie = []) {
  const { title, perex, content, source, date, category, imageUrl, imageCredit } = article;
  const theme = THEME_CSS[category] ? category : null;
  const label = THEME_LABEL[theme] ?? { home: "/", back: "← Všetky správy", dalsie: "Ďalšie správy" };
  const sourceParts = String(source || "").split("|");
  const sourceName = (sourceParts[0] || "").trim();
  const sourceLink = (sourceParts[1] || "").trim();
  const popis = (perex || String(content || "").slice(0, 200)).replace(/\s+/g, " ").trim().slice(0, 300);
  // Recept má vlastnú, štruktúrovanú prezentáciu (suroviny/postup) — generický
  // odsekový render (odseky()) by ich ukázal ako plochý zoznam jednovetových
  // odsekov, čitateľné, ale zbytočne horšie než to, na čo dáta stačia.
  const recept = category === "recepty" ? parseRecept(content) : null;

  const telo = `<div class="article-wrap">
  <div class="article-meta">
    <span class="cat-badge">${esc((recept && recept.kategoria) || category || "správy")}</span>
    <span class="article-source">tím Novinko</span>
    <span class="article-date"><time datetime="${esc(date)}">${esc(datumSk(date))}</time></span>
  </div>
  <h1 class="article-title">${esc(title)}</h1>
  ${imageUrl ? `<figure class="article-figure"><img src="${esc(imageUrl)}" alt="" class="article-img" loading="lazy">${popisObrazka(imageUrl, imageCredit)}</figure>` : ""}
  ${!recept && perex ? `<div class="article-perex">${esc(perex)}</div>` : ""}
  <div class="article-content">
        ${recept ? receptTelo(recept) : odseky(content)}
  </div>
  ${shareBar(title, clanokUrl(article))}
  <div class="article-footer">
    <div class="source-link">${
      sourceLink
        ? `Zdroj: <a href="${esc(sourceLink)}" target="_blank" rel="noopener nofollow">${esc(sourceName)}</a>`
        : `Zdroj: ${esc(sourceName || "Novinko")}`
    }</div>
    <a href="${label.home}" class="back-link">${label.back}</a>
  </div>
${dalsie.length ? `  <nav class="dalsie-clanky">
    <h2>${label.dalsie}</h2>
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
    jsonLd: recept ? recipeJsonLd(article, popis, recept) : newsArticleJsonLd(article, popis),
    theme,
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

// Recipe namiesto NewsArticle — recept nie je spravodajstvo, a Google recept
// bez schema.org Recipe nezaradí do bohatých výsledkov (foto/čas/porcie
// priamo vo vyhľadávaní). `recept` prichádza z parseRecept() vyššie, nie
// znova parsuje content — jeden rozbor, dve použitia (HTML aj JSON-LD).
function recipeJsonLd(article, popis, recept) {
  const { title, date, imageUrl } = article;
  const data = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: String(title).slice(0, 110),
    description: popis,
    datePublished: date,
    author: { "@type": "Organization", name: "Novinko", url: SITE },
    inLanguage: "sk-SK",
    recipeIngredient: recept.ingredients,
    recipeInstructions: recept.steps.map((s) => ({ "@type": "HowToStep", text: s })),
  };
  if (recept.servings != null) data.recipeYield = `${recept.servings} porcie`;
  if (recept.prep != null) data.prepTime = `PT${recept.prep}M`;
  if (recept.cook) data.cookTime = `PT${recept.cook}M`;
  if (recept.prep != null || recept.cook) data.totalTime = `PT${(recept.prep || 0) + (recept.cook || 0)}M`;
  if (imageUrl) data.image = [imageUrl];
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

// ── ARCHÍV: kompletný zoznam článkov ako obyčajné odkazy ──
//
// PREČO (2026-08-29): Search Console ukazovala 130 stránok v stave
// „Objavené – momentálne nie je v indexe" — Google ich pozná zo sitemapy, ale
// neprehľadal ich. Na 18 dní starej doméne je to otázka crawl budgetu, a ten
// sa neprideľuje podľa sitemapy, ale podľa odkazov: sitemapa hovorí „toto
// existuje", odkaz hovorí „toto je dôležité, choď tam".
//
// Hlavná stránka odkaz na archív mala (index.html), lenže mieril na
// archiv.html — stránku s `noindex`, ktorá sa skladá až v prehliadači a
// v surovom HTML nemá ani jeden odkaz na článok. Crawler teda prišiel
// a skončil v slepej uličke.
//
// Táto stránka je serverová a obsahuje VŠETKY články ako <a href>, zoskupené
// po kategóriách. Z ktorejkoľvek stránky webu sa tak dá dôjsť ku každému
// článku bez spusteného JavaScriptu.
function renderArchiv(clanky, kategorie) {
  const podlaKat = new Map();
  for (const c of clanky) {
    const k = c.category || "ostatné";
    if (!podlaKat.has(k)) podlaKat.set(k, []);
    podlaKat.get(k).push(c);
  }

  // Poradie ako v hlavičke webu; čokoľvek neznáme ide na koniec, nech sa
  // článok nestratí len preto, že pribudla kategória.
  const poradie = kategorie.filter((k) => k !== "all" && podlaKat.has(k));
  for (const k of podlaKat.keys()) if (!poradie.includes(k)) poradie.push(k);

  const sekcie = poradie.map((k) => {
    const zoznam = podlaKat.get(k)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((c) => `      <li><a href="${esc(clanokUrl(c))}">${esc(c.title)}</a>`
        + `<time datetime="${esc(c.date)}">${esc(datumSk(c.date))}</time></li>`)
      .join("\n");
    return `  <section class="archiv-sekcia">
    <h2>${esc(k)} <span class="archiv-pocet">${podlaKat.get(k).length}</span></h2>
    <ul class="archiv-zoznam">
${zoznam}
    </ul>
  </section>`;
  }).join("\n");

  return obal({
    title: "Archív článkov — Novinko",
    description: `Kompletný archív ${clanky.length} článkov na Novinku — krypto, AI a slovenské spravodajstvo.`,
    canonical: `${SITE}/archiv`,
    telo: `<div class="article-wrap">
  <h1 class="article-title">Archív článkov</h1>
  <div class="article-perex">Všetkých ${clanky.length} článkov, zoradených podľa sekcií a dátumu.</div>
${sekcie}
  <div class="article-footer"><a href="/" class="back-link">← Všetky správy</a></div>
</div>
<style>
  .archiv-sekcia { margin: 32px 0 0; }
  .archiv-sekcia h2 { font-size: 1.15rem; text-transform: capitalize; border-bottom: 1px solid var(--line, #333); padding-bottom: 6px; }
  .archiv-pocet { font-weight: 400; color: var(--text2); font-size: .85rem; }
  .archiv-zoznam { list-style: none; padding: 0; margin: 12px 0 0; }
  .archiv-zoznam li { display: flex; justify-content: space-between; gap: 16px; padding: 7px 0; border-bottom: 1px solid rgba(128,128,128,.15); }
  .archiv-zoznam a { text-decoration: none; }
  .archiv-zoznam time { color: var(--text2); font-size: .8rem; white-space: nowrap; }
  @media (max-width: 620px) { .archiv-zoznam li { flex-direction: column; gap: 2px; } }
</style>`,
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

module.exports = { renderClanok, renderArchiv, renderNenajdene, clanokUrl, slugify, esc, SITE };
