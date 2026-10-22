// ZDROJE PRE SÚKROMNÝ PREHĽAD SPRÁV — NIE produkčná pipeline.
// Zoznam pre scripts/digest.mjs, oddelený od zdrojov produkčnej redakcie.
// Krypto a AI zoznam obnovený 16. 10.; Ekonomika doplnená 21. 10. 2026.
// P1 = primárny zdroj, P2 = médium, P3 = výskumný prehľad (arXiv).
// Nadpisy slúžia na výber tém s odkazom na zdroj.
// Ďalšie zdroje sa dopĺňajú sem, pôvodné RSS ani sitemapy už nie sú aktívne.
export const DIGEST_FEEDS = [
  // ── AI ─────────────────────────────────────────────────────
  { section: 'ai', tier: 'P1', name: 'OpenAI News', url: 'https://openai.com/news/rss.xml' },
  { section: 'ai', tier: 'P1', name: 'Google DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml' },
  { section: 'ai', tier: 'P1', name: 'Google AI (The Keyword)', url: 'https://blog.google/innovation-and-ai/technology/ai/rss/' },
  { section: 'ai', tier: 'P1', name: 'Google Research Blog', url: 'https://research.google/blog/rss/' },
  { section: 'ai', tier: 'P1', name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml' },
  { section: 'ai', tier: 'P1', name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/feed/' },
  { section: 'ai', tier: 'P1', name: 'AWS Machine Learning Blog', url: 'https://aws.amazon.com/blogs/machine-learning/feed/' },
  { section: 'ai', tier: 'P2', name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { section: 'ai', tier: 'P2', name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { section: 'ai', tier: 'P2', name: 'Ars Technica AI', url: 'https://arstechnica.com/ai/feed/' },
  { section: 'ai', tier: 'P2', name: 'Wired AI', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
  { section: 'ai', tier: 'P2', name: 'MIT Technology Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { section: 'ai', tier: 'P1', name: 'MIT News – Artificial Intelligence', url: 'https://news.mit.edu/rss/topic/artificial-intelligence2' },
  { section: 'ai', tier: 'P2', name: 'MarkTechPost', url: 'https://www.marktechpost.com/feed/' },
  { section: 'ai', tier: 'P2', name: 'Unite.AI', url: 'https://www.unite.ai/feed/' },
  { section: 'ai', tier: 'P2', name: 'The Decoder', url: 'https://the-decoder.com/feed/' },
  { section: 'ai', tier: 'P2', name: 'The Gradient', url: 'https://thegradient.pub/rss/' },
  { section: 'ai', tier: 'P1', name: 'BAIR Blog (Berkeley AI Research)', url: 'https://bair.berkeley.edu/blog/feed.xml' },
  // Research papers supplement news; P3 keeps arXiv below P1/P2 in selection.
  { section: 'ai', tier: 'P3', name: 'arXiv cs.AI (výskumné papers)', url: 'https://rss.arxiv.org/rss/cs.AI' },
  { section: 'ai', tier: 'P2', name: "Simon Willison's Weblog", url: 'https://simonwillison.net/atom/everything/' },
  { section: 'ai', tier: 'P2', name: 'Last Week in AI', url: 'https://lastweekin.ai/feed' },
  { section: 'ai', tier: 'P2', name: 'Import AI', url: 'https://importai.substack.com/feed' },
  { section: 'ai', tier: 'P2', name: 'Machine Learning Mastery', url: 'https://machinelearningmastery.com/feed/' },
  { section: 'ai', tier: 'P2', name: 'Towards Data Science', url: 'https://towardsdatascience.com/feed' },
  { section: 'ai', tier: 'P2', name: 'Ahead of AI (Sebastian Raschka)', url: 'https://magazine.sebastianraschka.com/feed' },
  { section: 'ai', tier: 'P2', name: 'The AI Insider', url: 'https://theaiinsider.tech/feed/' },
  { section: 'ai', tier: 'P2', name: 'Fast Company AI', url: 'https://www.fastcompany.com/section/artificial-intelligence/rss' },
  { section: 'ai', tier: 'P2', name: 'Towards AI', url: 'https://pub.towardsai.net/feed' },
  { section: 'ai', tier: 'P1', name: 'NVIDIA Developer Blog', url: 'https://developer.nvidia.com/blog/feed/' },
  { section: 'ai', tier: 'P1', name: 'NVIDIA Newsroom', url: 'https://nvidianews.nvidia.com/rss.xml' },
  { section: 'ai', tier: 'P1', name: 'Microsoft Official Blog', url: 'https://blogs.microsoft.com/feed/' },
  { section: 'ai', tier: 'P1', name: 'Apple Machine Learning', url: 'https://machinelearning.apple.com/rss.xml' },
  // Artificial Intelligence News: /feed/ redirects to the HTML homepage
  // (checked 2026-10-16); no working RSS found, so not polled as a feed.
  { section: 'ai', tier: 'P2', name: 'The Register (tech/AI)', url: 'https://www.theregister.com/headlines.atom' },
  { section: 'ai', tier: 'P2', name: 'ZDNet AI / Tech', url: 'https://www.zdnet.com/topic/artificial-intelligence/rss.xml' },
  { section: 'ai', tier: 'P2', name: 'Engadget', url: 'https://www.engadget.com/rss.xml' },
  { section: 'ai', tier: 'P2', name: 'The Next Web (TNW)', url: 'https://thenextweb.com/feed/' },
  // These feeds parse but currently contain old items; the lookback filter
  // excludes them until new articles appear (checked 2026-10-16).
  { section: 'ai', tier: 'P2', name: 'Synced (Synced Review)', url: 'https://syncedreview.com/feed/' },
  { section: 'ai', tier: 'P2', name: 'DailyAI', url: 'https://dailyai.com/feed/' },
  { section: 'ai', tier: 'P2', name: 'AI Trends', url: 'https://www.aitrends.com/feed/' },
  // Third-party RSS for Anthropic's official news; links point to Anthropic.
  { section: 'ai', tier: 'P1', name: 'Anthropic News (AI RSS Feeds)', url: 'https://raw.githubusercontent.com/alan-turing-institute/ai-rss-feeds/main/feeds/anthropic-news.xml' },

  // ── Krypto (19) ────────────────────────────────────────────
  { section: 'krypto', tier: 'P2', name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { section: 'krypto', tier: 'P2', name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  { section: 'krypto', tier: 'P2', name: 'Decrypt', url: 'https://decrypt.co/feed' },
  { section: 'krypto', tier: 'P2', name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
  { section: 'krypto', tier: 'P2', name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
  { section: 'krypto', tier: 'P2', name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/feed' },
  { section: 'krypto', tier: 'P2', name: 'Bitcoin.com News', url: 'https://news.bitcoin.com/feed/' },
  { section: 'krypto', tier: 'P2', name: 'NewsBTC', url: 'https://www.newsbtc.com/feed/' },
  { section: 'krypto', tier: 'P2', name: 'crypto.news', url: 'https://crypto.news/feed/' },
  { section: 'krypto', tier: 'P2', name: 'Bitcoinist', url: 'https://bitcoinist.com/feed/' },
  { section: 'krypto', tier: 'P2', name: 'CryptoPotato', url: 'https://cryptopotato.com/feed/' },
  { section: 'krypto', tier: 'P2', name: 'BeInCrypto', url: 'https://beincrypto.com/feed/' },
  { section: 'krypto', tier: 'P2', name: 'AMBCrypto', url: 'https://ambcrypto.com/feed/' },
  { section: 'krypto', tier: 'P2', name: 'CoinJournal', url: 'https://coinjournal.net/feed/' },
  { section: 'krypto', tier: 'P2', name: 'CoinGape', url: 'https://coingape.com/feed/' },
  // /feeds/ is an HTML page; /feed/ is the RSS endpoint.
  { section: 'krypto', tier: 'P2', name: 'Crypto Briefing', url: 'https://cryptobriefing.com/feed/' },
  { section: 'krypto', tier: 'P2', name: '99Bitcoins', url: 'https://99bitcoins.com/feed/' },
  { section: 'krypto', tier: 'P2', name: 'Inside Bitcoins', url: 'https://insidebitcoins.com/feed' },
  { section: 'krypto', tier: 'P2', name: 'CCN', url: 'https://www.ccn.com/rss-feeds/crypto/' },
  // ── Ekonomika (22) — overené 21. 10. 2026 ───────────────────
  { section: 'ekonomika', tier: 'P2', name: 'Bloomberg – Všetky správy', url: 'https://www.bloomberg.com/feeds/news.rss' },
  { section: 'ekonomika', tier: 'P2', name: 'Bloomberg – Markets', url: 'https://www.bloomberg.com/feeds/markets/news.rss' },
  { section: 'ekonomika', tier: 'P2', name: 'Bloomberg – Economics', url: 'https://www.bloomberg.com/feeds/economics/news.rss' },
  { section: 'ekonomika', tier: 'P2', name: 'Financial Times – Hlavná stránka', url: 'https://www.ft.com/?format=rss' },
  { section: 'ekonomika', tier: 'P2', name: 'Financial Times – Global Economy', url: 'https://www.ft.com/global-economy?format=rss' },
  { section: 'ekonomika', tier: 'P2', name: 'Financial Times – Markets', url: 'https://www.ft.com/markets?format=rss' },
  { section: 'ekonomika', tier: 'P2', name: 'The Economist – Finance and Economics', url: 'https://www.economist.com/finance-and-economics/rss.xml' },
  { section: 'ekonomika', tier: 'P2', name: 'The Economist – Business', url: 'https://www.economist.com/business/rss.xml' },
  { section: 'ekonomika', tier: 'P2', name: 'Wall Street Journal – Markets', url: 'https://feeds.content.dowjones.io/public/rss/RSSMarketsMain' },
  { section: 'ekonomika', tier: 'P2', name: 'Wall Street Journal – Economy', url: 'https://feeds.content.dowjones.io/public/rss/socialeconomyfeed' },
  { section: 'ekonomika', tier: 'P2', name: 'MarketWatch – Top Stories', url: 'https://feeds.marketwatch.com/marketwatch/topstories' },
  { section: 'ekonomika', tier: 'P2', name: 'CNBC – Top News', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { section: 'ekonomika', tier: 'P2', name: 'CNBC – Economy', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html' },
  { section: 'ekonomika', tier: 'P2', name: 'Seeking Alpha – All Articles', url: 'https://seekingalpha.com/feed.xml' },
  { section: 'ekonomika', tier: 'P2', name: 'Seeking Alpha – Breaking News', url: 'https://seekingalpha.com/market_currents.xml' },
  { section: 'ekonomika', tier: 'P2', name: 'BBC News – Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
  { section: 'ekonomika', tier: 'P1', name: 'Federal Reserve – Press Releases', url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
  { section: 'ekonomika', tier: 'P1', name: 'ECB – Press Releases', url: 'https://www.ecb.europa.eu/rss/press.html' },
  { section: 'ekonomika', tier: 'P2', name: 'Investing.com – News', url: 'https://www.investing.com/rss/news.rss' },
  { section: 'ekonomika', tier: 'P2', name: 'Fortune', url: 'https://fortune.com/feed/' },
  { section: 'ekonomika', tier: 'P2', name: 'Harvard Business Review', url: 'http://feeds.hbr.org/harvardbusiness' },
  { section: 'ekonomika', tier: 'P2', name: 'Business Insider', url: 'https://feeds.businessinsider.com/custom/all' },
];

export const DIGEST_SITEMAP_SOURCES = [];
