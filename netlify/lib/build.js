// Poskladá pripravené spravodajstvo. Jedna logika pre cron (refresh-feeds)
// aj pre núdzové živé načítanie (fetch-rss fallback).
const { fetchUrl } = require("./net");
const { parseRSS } = require("./rss");
const { FEEDS } = require("./feeds");
const { fetchSheetItems } = require("./sheets");
const { CATS, MAX_ITEMS } = require("./config");

// Stiahne všetky (alebo kategóriou filtrované) RSS zdroje paralelne.
// Pomalý/mŕtvy feed neblokuje ostatné (Promise.allSettled + timeout).
async function gatherRss(categoryFilter = "all") {
  const feeds = categoryFilter === "all" ? FEEDS : FEEDS.filter((f) => f.category === categoryFilter);
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const xml = await fetchUrl(feed.url, { timeout: 6000 });
      return parseRSS(xml, { source: feed.source, category: feed.category, limit: 20 });
    })
  );

  // zoskup podľa zdroja a zoraď podľa dátumu
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

  // striedaj zdroje (interleave), aby nedominoval jeden web
  const sources = Object.values(bySource);
  const out = [];
  let i = 0;
  while (out.length < MAX_ITEMS && sources.some((s) => s.length > 0)) {
    const src = sources[i % sources.length];
    if (src.length > 0) out.push(src.shift());
    i++;
  }
  return out;
}

async function gatherSheet() {
  try { return await fetchSheetItems(); } catch { return []; }
}

// Postaví payload pre jednu kategóriu (núdzový režim pre fetch-rss).
async function buildPayload(category = "all") {
  const [rss, ownAll] = await Promise.all([gatherRss(category), gatherSheet()]);
  const own = category === "all" ? ownAll : ownAll.filter((i) => i.category === category);
  const items = [...own, ...rss].slice(0, MAX_ITEMS);
  return { items, count: items.length, fetched: new Date().toISOString() };
}

// Postaví payloady pre VŠETKY kategórie naraz (RSS aj Sheet stiahne len raz).
async function buildAll() {
  const [rssAll, ownAll] = await Promise.all([gatherRss("all"), gatherSheet()]);
  const now = new Date().toISOString();
  const out = {};
  for (const cat of CATS) {
    const rss = cat === "all" ? rssAll : rssAll.filter((i) => i.category === cat);
    const own = cat === "all" ? ownAll : ownAll.filter((i) => i.category === cat);
    const items = [...own, ...rss].slice(0, MAX_ITEMS);
    out[cat] = { items, count: items.length, fetched: now };
  }
  return out;
}

module.exports = { buildPayload, buildAll, gatherRss };
