// Poskladá pripravené spravodajstvo. Jedna logika pre cron (refresh-feeds)
// aj pre núdzové živé načítanie (fetch-rss fallback).
const { fetchUrl } = require("./net");
const { parseRSS } = require("./rss");
const { FEEDS } = require("./feeds");
const { fetchSheetItems } = require("./sheets");
const { CATS, MAX_ITEMS, MAX_AGE_HOURS, MIN_SECTION_ITEMS } = require("./config");

const CAT_ORDER = ["slovensko", "svet", "ekonomika", "sport", "krypto", "ai"];

async function gatherRss(categoryFilter = "all") {
  // Blokuj surové anglické RSS (lang: "en" vo feeds.js) — zobrazovali by sa
  // nepreložené priamo na webe. Zrušiť blokovanie = vymazať tento .filter riadok.
  const bySection = categoryFilter === "all" ? FEEDS : FEEDS.filter((f) => f.category === categoryFilter);
  const feeds = bySection.filter((f) => f.lang !== "en");
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const xml = await fetchUrl(feed.url, { timeout: 6000 });
      const parsed = parseRSS(xml, { source: feed.source, category: feed.category, limit: 20 });
      return parsed.map((it) => ({ ...it, image: "" })); // RSS obrázky nezobrazujeme (autorské práva)
    })
  );

  const bySource = {};
  results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .forEach((item) => {
      (bySource[item.source] = bySource[item.source] || []).push(item);
    });
  Object.values(bySource).forEach((arr) =>
    arr.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
  );

  const sources = Object.values(bySource);
  const out = [];
  let i = 0;
  while (out.length < MAX_ITEMS * 2 && sources.some((s) => s.length > 0)) {
    const src = sources[i % sources.length];
    if (src.length > 0) out.push(src.shift());
    i++;
  }
  return out;
}

// Ťaháme VŠETKY vlastné články (aj staršie než MAX_AGE_HOURS) a vek riešime až
// pri skladaní kategórie — inak by sa staré zahodili tu a freshFirst by nemal
// čím doplniť prázdnu sekciu.
async function gatherSheet() {
  try { return await fetchSheetItems({ all: true }); } catch { return []; }
}

// Rozdelí vlastné články na čerstvé (do MAX_AGE_HOURS) a staršie. Zoznam chodí
// zo sheets.js zoradený od najnovšieho, takže obe časti si poradie zachovajú.
function splitByAge(own) {
  const cutoff = Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000;
  const fresh = [];
  const stale = [];
  for (const it of own) {
    (new Date(it.pubDate).getTime() >= cutoff ? fresh : stale).push(it);
  }
  return { fresh, stale };
}

function roundRobin(lists) {
  const out = [];
  let added = true;
  while (out.length < MAX_ITEMS && added) {
    added = false;
    for (const list of lists) {
      if (list.length) { out.push(list.shift()); added = true; }
      if (out.length >= MAX_ITEMS) break;
    }
  }
  return out;
}

// Poradie: čerstvé vlastné → RSS → (len ak by sekcia bola tenká) staršie vlastné.
//
// Staršie vlastné idú AŽ NA KONIEC a len keď ich treba. Keby sa dopĺňali vždy a
// navrch, tak v športe/svete/ekonomike by nad dnešným RSS visel vlastný článok
// starý aj 100+ h — overené pri teste 2026-08-10. Sekcie so slovenskými feedmi
// sa naplnia samy, takže sa ich poistka vôbec nedotkne; zachraňuje krypto a ai.
//
// Súčasní volajúci sem "all" neposielajú (buildPayload aj buildAll idú po
// kategóriách cez CAT_ORDER), takže hranica vychádza vždy per sekcia.
function combineCategory(rss, own, category) {
  const o = category === "all" ? own : own.filter((i) => i.category === category);
  const r = category === "all" ? rss : rss.filter((i) => i.category === category);
  const { fresh, stale } = splitByAge(o);
  const base = [...fresh, ...r];
  if (base.length >= MIN_SECTION_ITEMS) return base;
  return [...base, ...stale.slice(0, MIN_SECTION_ITEMS - base.length)];
}

async function buildPayload(category = "all") {
  const [rss, own] = await Promise.all([gatherRss(category), gatherSheet()]);
  let items;
  if (category === "all") {
    const perCat = CAT_ORDER.map((cat) => combineCategory(rss, own, cat));
    items = roundRobin(perCat);
  } else {
    items = combineCategory(rss, own, category).slice(0, MAX_ITEMS);
  }
  return { items, count: items.length, fetched: new Date().toISOString() };
}

async function buildAll() {
  const [rssAll, ownAll] = await Promise.all([gatherRss("all"), gatherSheet()]);
  const now = new Date().toISOString();
  const out = {};

  const perCat = {};
  for (const cat of CAT_ORDER) {
    const list = combineCategory(rssAll, ownAll, cat);
    perCat[cat] = list;
    out[cat] = { items: list.slice(0, MAX_ITEMS), count: Math.min(list.length, MAX_ITEMS), fetched: now };
  }

  const allItems = roundRobin(CAT_ORDER.map((cat) => [...perCat[cat]]));
  out.all = { items: allItems, count: allItems.length, fetched: now };

  // Evergreen sekcia "Krypto škola" — nadčasové vysvetlivky, nevypršia.
  // Vlastná záložka; zámerne NIE je v round-robin pre "all" (nezahlcuje homepage).
  const skola = ownAll.filter((i) => i.category === "krypto-skola");
  out["krypto-skola"] = { items: skola.slice(0, MAX_ITEMS), count: Math.min(skola.length, MAX_ITEMS), fetched: now };

  return out;
}

module.exports = { buildPayload, buildAll, gatherRss };
