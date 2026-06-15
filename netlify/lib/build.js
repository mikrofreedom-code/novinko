// Poskladá pripravené spravodajstvo. Jedna logika pre cron (refresh-feeds)
// aj pre núdzové živé načítanie (fetch-rss fallback).
const { fetchUrl } = require("./net");
const { parseRSS } = require("./rss");
const { FEEDS } = require("./feeds");
const { fetchSheetItems } = require("./sheets");
const { CATS, MAX_ITEMS } = require("./config");

const CAT_ORDER = ["slovensko", "svet", "ekonomika", "sport", "krypto"];

async function gatherRss(categoryFilter = "all") {
  const feeds = categoryFilter === "all" ? FEEDS : FEEDS.filter((f) => f.category === categoryFilter);
  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const xml = await fetchUrl(feed.url, { timeout: 6000 });
      return parseRSS(xml, { source: feed.source, category: feed.category, limit: 20 });
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

async function gatherSheet() {
  try { return await fetchSheetItems(); } catch { return []; }
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

function combineCategory(rss, own, category) {
  const o = category === "all" ? own : own.filter((i) => i.category === category);
  const r = category === "all" ? rss : rss.filter((i) => i.category === category);
  return [...o, ...r];
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

  return out;
}

module.exports = { buildPayload, buildAll, gatherRss };
