// Zoznamy zdrojov – jedno miesto pravdy.

// Zdroje, ktoré sa zobrazujú na webe (agregátor).
const FEEDS = [
  // 🇸🇰 SLOVENSKO
  { url: "https://www.sme.sk/rss", category: "slovensko", source: "SME" },
  { url: "https://www.aktuality.sk/rss/", category: "slovensko", source: "Aktuality" },
  { url: "https://www.teraz.sk/rss/slovensko.rss", category: "slovensko", source: "Teraz.sk" },
  { url: "https://www.hlavnespravy.sk/feed/", category: "slovensko", source: "Hlavné správy" },
  { url: "https://dennikn.sk/feed/", category: "slovensko", source: "Denník N" },
  { url: "https://refresher.sk/rss", category: "slovensko", source: "Refresher" },
  { url: "https://www.startitup.sk/feed/", category: "slovensko", source: "Startitup" },
  { url: "https://www.pluska.sk/rss.xml", category: "slovensko", source: "Pluska" },

  // 🌍 SVET
  { url: "https://www.teraz.sk/rss/zahranicie.rss", category: "svet", source: "Teraz / Svet" },
  { url: "https://sita.sk/zahranicne/feed/", category: "svet", source: "SITA / Svet" },
  // POZN.: Reuters RSS (feeds.reuters.com) bol zrušený – odstránené, len zdržoval načítanie.

  // 💰 EKONOMIKA
  { url: "https://www.teraz.sk/rss/ekonomika.rss", category: "ekonomika", source: "Teraz / Ekonomika" },
  { url: "https://hnonline.sk/rss", category: "ekonomika", source: "HNonline" },
  { url: "https://trend.sk/rss.xml", category: "ekonomika", source: "Trend" },
  { url: "https://sita.sk/ekonomika/feed/", category: "ekonomika", source: "SITA / Ekonomika" },

  // ⚽ ŠPORT
  { url: "https://www.teraz.sk/rss/sport.rss", category: "sport", source: "Teraz / Šport" },
  { url: "https://sport.pravda.sk/rss/xml", category: "sport", source: "Pravda / Šport" },

  // ₿ KRYPTO
  // lang: "en" → gatherRss() v build.js tieto BLOKUJE (surové anglické titulky
  // sa nezobrazujú na webe). Zámerne NEmazané — GEN_FEEDS.krypto nižšie je
  // nezávislé pole a naďalej ich používa na AI generovanie vlastných SK článkov.
  // Zrušiť blokovanie = vymazať `lang: "en"` z týchto riadkov.
  { url: "https://cointelegraph.com/rss", category: "krypto", source: "CoinTelegraph", lang: "en" },
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", category: "krypto", source: "CoinDesk", lang: "en" },
  { url: "https://cryptonews.com/news/feed/", category: "krypto", source: "CryptoNews", lang: "en" },
  { url: "https://decrypt.co/feed", category: "krypto", source: "Decrypt", lang: "en" },
  { url: "https://beincrypto.com/feed/", category: "krypto", source: "BeInCrypto", lang: "en" },
  { url: "https://ambcrypto.com/feed/", category: "krypto", source: "AMBCrypto", lang: "en" },
  { url: "https://bitcoinmagazine.com/.rss/full/", category: "krypto", source: "Bitcoin Magazine", lang: "en" },
  { url: "https://www.theblock.co/rss.xml", category: "krypto", source: "The Block", lang: "en" },
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


module.exports = { FEEDS, GEN_FEEDS };
