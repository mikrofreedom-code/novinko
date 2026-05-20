const https = require("https");
const http = require("http");

const BREAKING_KEYWORDS = [
  "breaking", "urgent", "alert", "zomrel", "zomrela", "zosnul",
  "výbuch", "explózia", "útok", "atentát", "zemetrasenie", "cunami",
  "havária", "katastrofa", "kríza", "mimoriadny", "núdzový stav",
  "vojna", "invázia", "prekvapenie", "šok", "okamžite", "práve teraz"
];

const SCAN_FEEDS = [
  { url: "https://www.sme.sk/rss", source: "SME" },
  { url: "https://www.aktuality.sk/rss/", source: "Aktuality" },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World" },
  { url: "https://cointelegraph.com/rss", source: "CoinTelegraph" },
];

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZoj1iM9WKbX_S-0Zsu-3ZU3vZGro3UFcWyGuuBY4e8sR474C9X0xf33N1Cok0YSqoLDVPn_dCVFXW/pub?output=csv";

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Novinko/1.0)" }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location;
        const nextUrl = loc.startsWith("http") ? loc : new URL(loc, url).href;
        return fetchUrl(nextUrl).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function parseRSSTitles(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/) || [])[1] || "";
    const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || "";
    const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
    if (title) items.push({ title: title.trim(), link: link.trim(), pubDate });
  }
  return items.slice(0, 5);
}

function isBreaking(title) {
  const lower = title.toLowerCase();
  return BREAKING_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
}

exports.handler = async (event) => {
  const breaking = [];

  for (const feed of SCAN_FEEDS) {
    try {
      const xml = await fetchUrl(feed.url);
      const items = parseRSSTitles(xml);
      for (const item of items) {
        if (isBreaking(item.title)) {
          breaking.push({ ...item, source: feed.source });
        }
      }
    } catch (e) {
      // pokračuj
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      success: true, 
      breaking: breaking.length,
      items: breaking 
    }),
  };
};
