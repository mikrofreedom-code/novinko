// Cron (každých 30 min): preskenuje vybrané zdroje na mimoriadne správy
// a uloží ich do Blobs (kľúč "breaking"), odkiaľ ich vie načítať frontend.
const { fetchUrl } = require("../lib/net");
const { parseRSS } = require("../lib/rss");
const { saveNews } = require("../lib/store");
const { BREAKING_FEEDS } = require("../lib/feeds");
const { BREAKING_KEY } = require("../lib/config");

const BREAKING_KEYWORDS = [
  "breaking", "urgent", "alert", "zomrel", "zomrela", "zosnul",
  "výbuch", "explózia", "útok", "atentát", "zemetrasenie", "cunami",
  "havária", "katastrofa", "kríza", "mimoriadny", "núdzový stav",
  "vojna", "invázia", "prekvapenie", "šok", "okamžite", "práve teraz",
];

function isBreaking(title) {
  const lower = title.toLowerCase();
  return BREAKING_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

exports.handler = async () => {
  const breaking = [];
  const seen = new Set();

  for (const feed of BREAKING_FEEDS) {
    try {
      const xml = await fetchUrl(feed.url, { timeout: 8000 });
      const items = parseRSS(xml, { source: feed.source, limit: 5 });
      for (const item of items) {
        if (isBreaking(item.title) && !seen.has(item.link)) {
          seen.add(item.link);
          breaking.push({ title: item.title, link: item.link, pubDate: item.pubDate, source: feed.source });
        }
      }
    } catch {
      // pokračuj ďalším zdrojom
    }
  }

  const payload = { items: breaking, count: breaking.length, fetched: new Date().toISOString() };
  try { await saveNews(BREAKING_KEY, payload); } catch { /* Blobs nedostupné – nevadí */ }

  return { statusCode: 200, body: JSON.stringify({ success: true, breaking: breaking.length }) };
};
