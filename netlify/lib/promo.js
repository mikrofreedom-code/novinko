// JEDINÝ ZOZNAM REKLAMNÝCH BANNEROV pre celý web.
// ============================================================
// PRIDÁVAŠ ALEBO MENÍŠ BANNER? Stačí tento súbor a obrázky v assets/reklama/.
// Nič iné sa nikde neupravuje — stránky si zoznam berú odtiaľto.
//
// Ku každému banneru patria TRI súbory v assets/reklama/ (vyrob ich z originálu
// rovnako ako doteraz, pomery sú dôležité):
//   <subor>-1000.webp   širokouhlý 3:1, pre bežné obrazovky
//   <subor>-2000.webp   ten istý obrázok v dvojnásobku, pre retina displeje
//   <subor>-mobil.webp  orezaný na 8:5, len text a tlačidlo — na telefóne je
//                       3:1 taký nízky, že podnadpis v ňom nikto neprečíta
//                       (overené vykreslením v šírke 382 px)
//
// PREČO JEDEN SÚBOR PRE PREHLIADAČ AJ SERVER: stránky sa skladajú dvoma
// rôznymi cestami — index/zahrada/horoskop v prehliadači, stránka článku na
// serveri vo funkcii (netlify/lib/clanok-render.js). Kým bol zoznam na oboch
// stranách zvlášť, výmena banneru znamenala štyri zásahy a hrozilo, že sa
// cesty rozídu — presne pred tým varuje CLAUDE.md v časti „dve cesty k tomu
// istému". Preto je súbor napísaný tak, aby ho vedel načítať `require`
// v Node aj <script src> v prehliadači.
//
// CSP: skript sa načítava z vlastnej domény ('self'), takže netreba hash ani
// žiadne povolenie navyše. Obrázky musia byť lokálne — img-src pustí len
// 'self' a Supabase, banner z cudzej domény by prehliadač ticho zahodil.
//
// POZOR: súbor musí byť v zozname VOLITELNE v scripts/build-site.sh, inak sa
// na produkciu nedostane.
(function (global) {
  "use strict";

  // ── ZOZNAM BANNEROV ────────────────────────────────────────
  // subor  = základ názvu súborov v assets/reklama/
  // kampan = hodnota utm_campaign, teda čo uvidíš v štatistikách eshopu
  // alt    = popis pre čítačky pre nevidiacich a pre prípad, že sa obrázok nenačíta
  var BANNERY = [
    {
      subor: "senvoria-knihy-hned",
      kampan: "knihy-hned",
      alt: "Senvoria.sk — slovenské e-knihy, ktoré máte hneď",
    },
    {
      subor: "senvoria-pribeh-na-klik",
      kampan: "pribeh-na-klik",
      alt: "Senvoria.sk — príbeh na jeden klik, e-knihy pre chvíle, ktoré patria vám",
    },
    {
      subor: "senvoria-bez-cakania",
      kampan: "bez-cakania",
      alt: "Senvoria.sk — e-kniha bez čakania, po zaplatení ju máte v e-maile",
    },
  ];

  var CIEL = "https://senvoria.sk/";

  // Štítok "Reklama" je viditeľný zámerne: komerčné oznámenie musí byť pre
  // čitateľa odlíšiteľné od redakčného obsahu (DSA čl. 26). rel="sponsored"
  // hovorí Googlu, že nejde o redakčné odporúčanie.
  //
  // `sirka` je hodnota atribútu sizes — koľko miesta má banner na širokej
  // obrazovke. Stránka článku má užší stĺpec (780 px) než rubriky (1000 px),
  // takže si telefón nestiahne zbytočne veľký súbor.
  function markup(b, miesto, sirka) {
    var utm = "utm_source=novinko.sk&amp;utm_medium=banner&amp;utm_campaign=" + b.kampan + "&amp;utm_content=" + miesto;
    var cesta = "/assets/reklama/" + b.subor;
    return '<span class="promo-label">Reklama</span>'
      + '<a class="promo-banner" href="' + CIEL + "?" + utm + '" target="_blank" rel="sponsored noopener">'
      + "<picture>"
      + '<source media="(max-width: 600px)" srcset="' + cesta + '-mobil.webp">'
      + '<img src="' + cesta + '-1000.webp"'
      + ' srcset="' + cesta + "-1000.webp 1000w, " + cesta + '-2000.webp 2000w"'
      + ' sizes="(max-width: ' + (sirka + 80) + "px) 100vw, " + sirka + 'px" width="2000" height="667"'
      + ' alt="' + b.alt + '" loading="lazy" decoding="async">'
      + "</picture></a>";
  }

  // Bez zadaného banneru sa vyberie náhodný — stály čitateľ tak nevidí stále
  // ten istý. Rubriky s vlastným dizajnom si banner určujú samy, aby ladil
  // s ich paletou (béžové knihy do svetlej Záhrady, večerný do Horoskopu).
  function vyber(subor) {
    if (subor) {
      for (var i = 0; i < BANNERY.length; i++) {
        if (BANNERY[i].subor === subor) return BANNERY[i];
      }
    }
    return BANNERY[Math.floor(Math.random() * BANNERY.length)];
  }

  // ── Node (netlify/lib/clanok-render.js) ────────────────────
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { BANNERY: BANNERY, markup: markup, vyber: vyber };
    return;
  }

  // ── Prehliadač: vyplň každý <div class="promo-slot"> na stránke ──
  // Značka na stránke je jednoriadková:
  //   <aside class="promo-slot" data-promo="hlavna"></aside>
  //   <aside class="promo-slot" data-promo="zahrada" data-banner="senvoria-knihy-hned"></aside>
  // data-promo  = utm_content, teda ktoré miesto na webe to je
  // data-banner = nepovinné, konkrétny banner namiesto náhodného
  // data-sirka  = nepovinné, šírka stĺpca v px (predvolene 1000)
  var CSS = ".promo-slot{margin:34px 0 8px}"
    + ".promo-label{display:block;font-size:.64rem;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:var(--muted);margin-bottom:8px}"
    + ".promo-banner{display:block;border:1px solid var(--border);transition:border-color .15s}"
    + ".promo-banner:hover{border-color:var(--accent)}"
    + ".promo-banner img{display:block;width:100%;height:auto}"
    // Mobilný výrez má iný pomer strán než širokouhlá verzia. Bez tohto by po
    // jeho načítaní poskočil obsah pod bannerom.
    + "@media (max-width:600px){.promo-banner img{aspect-ratio:1158/724}}";

  function vykresli() {
    var sloty = document.querySelectorAll(".promo-slot");
    if (!sloty.length) return;
    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    for (var i = 0; i < sloty.length; i++) {
      var slot = sloty[i];
      var b = vyber(slot.getAttribute("data-banner"));
      slot.setAttribute("aria-label", "Reklama");
      slot.innerHTML = markup(b, slot.getAttribute("data-promo") || "web", Number(slot.getAttribute("data-sirka")) || 1000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", vykresli);
  } else {
    vykresli();
  }

  global.NovinkoPromo = { BANNERY: BANNERY, markup: markup, vyber: vyber };
})(typeof globalThis !== "undefined" ? globalThis : this);
