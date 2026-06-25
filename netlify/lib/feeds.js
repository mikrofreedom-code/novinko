// Zoznamy zdrojov – jedno miesto pravdy.

// Zdroje, ktoré sa zobrazujú na webe (agregátor).
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
  // POZN.: Reuters RSS (feeds.reuters.com) bol zrušený – odstránené, len zdržoval načítanie.

  // 💰 EKONOMIKA
  { url: "https://www.teraz.sk/rss/ekonomika.rss", category: "ekonomika", source: "Teraz / Ekonomika" },
  { url: "https://hnonline.sk/rss", category: "ekonomika", source: "HNonline" },
  { url: "https://trend.sk/rss.xml", category: "ekonomika", source: "Trend" },
  { url: "https://sita.sk/ekonomika/feed/", category: "ekonomika", source: "SITA / Ekonomika" },
  { url: "https://www.pravda.sk/rss/ekonomika/", category: "ekonomika", source: "Pravda / Ekonomika" },
  { url: "https://zive.sk/rss/aktuality", category: "ekonomika", source: "Živé.sk" },

  // ⚽ ŠPORT
  { url: "https://www.teraz.sk/rss/sport.rss", category: "sport", source: "Teraz / Šport" },
  { url: "https://sport.pravda.sk/rss/xml", category: "sport", source: "Pravda / Šport" },
  { url: "https://www.sme.sk/rss/sport", category: "sport", source: "SME / Šport" },
  { url: "https://www.cas.sk/rss/sport/", category: "sport", source: "Čas / Šport" },

  // ₿ KRYPTO
  { url: "https://cointelegraph.com/rss", category: "krypto", source: "CoinTelegraph" },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "krypto", source: "CoinDesk" },
  { url: "https://cryptonews.com/news/feed/", category: "krypto", source: "CryptoNews" },
  { url: "https://decrypt.co/feed", category: "krypto", source: "Decrypt" },
  { url: "https://beincrypto.com/feed/", category: "krypto", source: "BeInCrypto" },
  { url: "https://ambcrypto.com/feed/", category: "krypto", source: "AMBCrypto" },
  { url: "https://bitcoinmagazine.com/.rss/full/", category: "krypto", source: "Bitcoin Magazine" },
  { url: "https://www.theblock.co/rss.xml", category: "krypto", source: "The Block" },
];

// Zdroje pre generovanie vlastných SK článkov (AI prepis).
const GEN_FEEDS = {
  krypto: [
    { url: "https://cointelegraph.com/rss", source: "CoinTelegraph" },
    { url: "https://decrypt.co/feed", source: "Decrypt" },
  ],
  svet: [
    { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World" },
    { url: "https://www.euronews.com/rss?format=mrss&level=theme&name=news", source: "Euronews" },
  ],
  sport: [
    { url: "https://www.euronews.com/rss?format=mrss&level=theme&name=sport", source: "Euronews Sport" },
  ],
};

// Zdroje pre skener mimoriadnych správ.
const BREAKING_FEEDS = [
  { url: "https://www.sme.sk/rss", source: "SME" },
  { url: "https://www.aktuality.sk/rss/", source: "Aktuality" },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World" },
  { url: "https://cointelegraph.com/rss", source: "CoinTelegraph" },
];

module.exports = { FEEDS, GEN_FEEDS, BREAKING_FEEDS };
