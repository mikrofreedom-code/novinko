const https = require("https");
const http = require("http");

const FEEDS = [
  // 🇸🇰 SLOVENSKO
  { url: "https://www.sme.sk/rss", category: "slovensko", source: "SME" },
  { url: "https://www.aktuality.sk/rss/", category: "slovensko", source: "Aktuality" },
  { url: "https://www.topky.sk/cl/rss/", category: "slovensko", source: "Topky" },
  { url: "https://www.teraz.sk/rss/slovensko.rss", category: "slovensko", source: "Teraz.sk" },
  { url: "https://www.hlavnespravy.sk/feed/", category: "slovensko", source: "Hlavné správy" },
  { url: "https://dennikn.sk/feed/", category: "slovensko", source: "Denník N" },
  { url: "https://refresher.sk/rss", category: "slovensko", source: "Refresher" },
  { url: "https://www.startitup.sk/feed/", category: "slovensko", source: "Startitup" },
  { url: "https://www.cas.sk/rss/", category: "slovensko", source: "Čas.sk" },
  { url: "https://www.pluska.sk/rss.xml", category: "slovensko", source: "Pluska" },

  // 🌍 SVET
  { url: "https://www.teraz.sk/rss/zahranicie.rss", category: "svet", source: "Teraz / Svet" },
  { url: "https://www.pravda.sk/rss/zahranicne-spravy/", category: "svet", source: "Pravda / Svet" },
  { url: "https://sita.sk/zahranicne/feed/", category: "svet", source: "SITA / Svet" },
  { url: "https://www.tvnoviny.sk/rss", category: "svet", source: "TV Noviny" },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "svet", source: "BBC World" },
  { url: "https://feeds.reuters.com/reuters/worldNews", category: "svet", source: "Reuters" },

  // 💰 EKONOMIKA
  { url: "https://www.teraz.sk/rss/ekonomika.rss", category: "ekonomika", source: "Teraz / Ekonomika" },
  { url: "https://hnonline.sk/rss", category: "ekonomika", source: "HNonline" },
  { url: "https://trend.sk/rss.xml", category: "ekonomika", source: "Trend" },
  { url: "https://sita.sk/ekonomika/feed/", category: "ekonomika", source: "SITA / Ekonomika" },
  { url: "https://www.pravda.sk/rss/ekonomika/", category: "ekonomika", source: "Pravda / Ekonomika" },
  { url: "https://zive.sk/rss/aktuality", category: "ekonomika", source: "Živé.sk" },

  // ⚽ ŠPORT
  { url: "https://www.teraz.sk/rss/sport.rss", category: "sport", source: "Teraz / Šport" },
  { url: "https://sita.sk/sport/feed/", category: "sport", source: "SITA / Šport" },
  { url: "https://sport.pravda.sk/rss/xml", category: "sport", source: "Pravda / Šport" },
  { url: "https://www.sme.sk/rss/sport", category: "sport", source: "SME / Šport" },
  { url: "https://www.cas.sk/rss/sport/", category: "sport", source: "Čas / Šport" },

  // ₿ KRYPTO
  { url: "https://cointelegraph.com/rss", category: "krypto", source: "CoinTelegraph" },
  { url: "https://coindesk.com/arc/outboundfeeds/rss/", category: "krypto", source: "CoinDesk" },
  { url: "https://cryptonews.com/news/feed/", category: "krypto", source: "CryptoNews" },
  { url: "https://decrypt.co/feed", category: "krypto", source: "Decrypt" },
  { url: "https://beincrypto.com/feed/", category: "krypto", source: "BeInCrypto" },
  { url: "https://ambcrypto.com/feed/", category: "krypto", source: "AMBCrypto" },
  { url: "https://bitcoinmagazine.com/.rss/full/", category: "krypto", source: "Bitcoin Magazine" },
  { url: "https://www.theblock.co/rss.xml", category: "krypto", source: "The Block" },
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsAggregator/1.0)" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function parseRSS(xml, source, category) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/) || [])[1] || "";
    const link = (item.match(/<link>(.*?)<\/link>/) || item.match(/<link[^>]*href="([^"]+)"/) || [])[1] || "";
    const description = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/) || [])[1] || "";
    const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
    const imageMatch = item.match(/<media:content[^>]+url="([^"]+)"/) || item.match(/<enclosure[^>]+url="([^"]+)"/) || item.match(/<media:thumbnail[^>]+url="([^"]+)"/);
    const image = imageMatch ? imageMatch[1] : "";

    if (title && link) {
      items.push({
        title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, "").trim(),
        link: link.trim(),
        description: description.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").substring(0, 200).trim(),
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        image,
        source,
        category,
      });
    }
  }
  return items;
}

exports.handler = async (event) => {
  const category = event.queryStringParameters?.category || "all";
  const feeds = category === "all" ? FEEDS : FEEDS.filter((f) => f.category === category);

  const results = await Promise.allSettled(
    feeds.map(async (feed) => {
      const xml = await fetchUrl(feed.url);
      return parseRSS(xml, feed.source, feed.category);
    })
  );

  const allItems = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, 100);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ items: allItems, count: allItems.length, fetched: new Date().toISOString() }),
  };
};
