// ZDROJE PRE SÚKROMNÝ PREHĽAD SPRÁV — NIE produkčná pipeline.
// ------------------------------------------------------------
// Samostatný zoznam pre scripts/digest.mjs. Zámerne oddelený od
// lib/_shared/feeds.js (tie kŕmia 01-scout a produkčnú frontu — sem sa
// NEMIEŠA, aby zmena jedného nikdy neovplyvnila druhé, viď CLAUDE.md
// „dve cesty k tomu istému“). Každý riadok tu je RSS/Atom feed overený
// naživo 15. 9. 2026: adresa odpovedá, robots.txt ju nezakazuje, feed
// má dátumované položky. Sitemap-only a .md changelog zdroje (Anthropic
// news, Claude blog, xAI, ElevenLabs, Cohere, Scale AI, Runway,
// darioamodei.com, OpenAI/Anthropic changelog.md) tu ZÁMERNE chýbajú —
// vyžadujú iný parser než RSS, doplniť neskôr ako samostatný krok.
//
// tier: priorita z watchlist zošitov (rovnaká škála naprieč sekciami)
//   P1 primárny (regulátor/protokol/inštitúcia) · P2 overenie (agentúra/
//   kvalitné médium) · P3 stopa (digest/agregátor, len na zachytenie témy)
//
// Zdroje bez fungujúceho RSS (blokované, 403/429, alebo robots.txt
// zakazuje) sa sem nedostali — zoznam nájdených/zamietnutých je v
// konverzácii z 15. 9. 2026, nie je duplikovaný v kóde.
//
// POZOR (nájdené pri prvom ostrom behu 15. 9.): overovací skript pri jednom
// z kôl fail-open-ol, keď sa mu nepodarilo stiahnuť robots.txt (prázdne
// pravidlá = potichu "povolené"). Euractiv sa tak na chvíľu dostal do
// zoznamu, hoci jeho robots.txt má explicitný `Disallow: /feed/` — chytené
// pri kontrolnom behu skriptu (403 na feed), nie automatom. Doplnená druhá,
// nezávislá kontrola s fail-closed politikou (3 pokusy, inak radšej vyradiť
// než hádať) vyradila aj CourtListener, Replit changelog a WSJ
// (feeds.a.dj.com) — ich robots.txt sám vracia 403/525, teda sa nedá overiť.
// Skús ich pridať späť, až keď sa dá ich robots.txt naozaj prečítať.

export const DIGEST_FEEDS = [
  // ── AI (48) ────────────────────────────────────────────────
  { section: 'ai', tier: 'P1', name: 'AWS ML blog', url: 'https://aws.amazon.com/blogs/machine-learning/feed/' },
  { section: 'ai', tier: 'P1', name: 'AWS What\'s New', url: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/' },
  { section: 'ai', tier: 'P1', name: 'Anthropic docs release notes', url: 'https://platform.claude.com/docs/en/release-notes/feed.xml' },
  { section: 'ai', tier: 'P1', name: 'Apple Newsroom', url: 'https://www.apple.com/newsroom/rss-feed.rss' },
  { section: 'ai', tier: 'P1', name: 'Azure blog', url: 'https://azure.microsoft.com/en-us/blog/feed/' },
  { section: 'ai', tier: 'P1', name: 'Bedrock docs history', url: 'https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-ug.rss' },
  { section: 'ai', tier: 'P1', name: 'Cursor', url: 'https://cursor.com/changelog/rss.xml' },
  { section: 'ai', tier: 'P1', name: 'Databricks', url: 'https://www.databricks.com/feed' },
  { section: 'ai', tier: 'P1', name: 'DeepMind blog', url: 'https://deepmind.google/blog/rss.xml' },
  { section: 'ai', tier: 'P1', name: 'EK — AI Office / digitálna stratégia', url: 'https://digital-strategy.ec.europa.eu/en/rss.xml' },
  { section: 'ai', tier: 'P1', name: 'Google blog (AI)', url: 'https://blog.google/rss/' },
  { section: 'ai', tier: 'P1', name: 'Hugging Face blog', url: 'https://huggingface.co/blog/feed.xml' },
  { section: 'ai', tier: 'P1', name: 'Meta newsroom (AI)', url: 'https://about.fb.com/news/tag/ai/feed/' },
  { section: 'ai', tier: 'P1', name: 'Microsoft blogs (AI)', url: 'https://blogs.microsoft.com/feed/' },
  { section: 'ai', tier: 'P1', name: 'Midjourney', url: 'https://updates.midjourney.com/rss/' },
  { section: 'ai', tier: 'P1', name: 'Mistral AI', url: 'https://mistral.ai/rss.xml' },
  { section: 'ai', tier: 'P1', name: 'NVIDIA blog', url: 'https://blogs.nvidia.com/feed/' },
  { section: 'ai', tier: 'P1', name: 'NVIDIA newsroom', url: 'https://nvidianews.nvidia.com/releases.xml' },
  { section: 'ai', tier: 'P1', name: 'OpenAI API changelog', url: 'https://developers.openai.com/rss.xml' },
  { section: 'ai', tier: 'P1', name: 'OpenAI News', url: 'https://openai.com/news/rss.xml' },
  { section: 'ai', tier: 'P1', name: 'Stability AI', url: 'https://stability.ai/news-updates?format=rss' },
  { section: 'ai', tier: 'P1', name: 'White House', url: 'https://www.whitehouse.gov/news/feed/' },
  // arXiv cs.AI ZÁMERNE chýba — 634 nových prác/deň, zaplavilo by to celú
  // sekciu (v prvom ostrom behu 15. 9. tvorilo 71 % všetkých AI položiek).
  // Iný typ zdroja než spravodajstvo, patrí sem najviac ako výberová vzorka.
  { section: 'ai', tier: 'P2', name: '9to5Google', url: 'https://9to5google.com/feed/' },
  { section: 'ai', tier: 'P2', name: '9to5Mac', url: 'https://9to5mac.com/feed/' },
  { section: 'ai', tier: 'P2', name: 'Ars Technica (AI)', url: 'https://arstechnica.com/ai/feed/' },
  { section: 'ai', tier: 'P2', name: 'Bloomberg', url: 'https://feeds.bloomberg.com/technology/news.rss' },
  { section: 'ai', tier: 'P2', name: 'CNBC (tech)', url: 'https://www.cnbc.com/id/19854910/device/rss/rss.html' },
  { section: 'ai', tier: 'P2', name: 'Engadget', url: 'https://www.engadget.com/rss.xml' },
  { section: 'ai', tier: 'P2', name: 'Financial Times', url: 'https://www.ft.com/artificial-intelligence?format=rss' },
  { section: 'ai', tier: 'P2', name: 'Guardian (AI)', url: 'https://www.theguardian.com/technology/artificialintelligenceai/rss' },
  { section: 'ai', tier: 'P2', name: 'MIT Technology Review (AI)', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
  { section: 'ai', tier: 'P2', name: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml' },
  { section: 'ai', tier: 'P2', name: 'Semafor', url: 'https://www.semafor.com/rss.xml' },
  { section: 'ai', tier: 'P2', name: 'South China Morning Post', url: 'https://www.scmp.com/rss/36/feed' },
  { section: 'ai', tier: 'P2', name: 'TechCrunch (AI)', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { section: 'ai', tier: 'P2', name: 'The Information', url: 'https://www.theinformation.com/feed' },
  { section: 'ai', tier: 'P2', name: 'The Verge (AI)', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { section: 'ai', tier: 'P2', name: 'Washington Post', url: 'https://feeds.washingtonpost.com/rss/business/technology' },
  { section: 'ai', tier: 'P2', name: 'Wired (AI)', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
  { section: 'ai', tier: 'P3', name: 'AI Weekly', url: 'https://aiweekly.co/issues.rss' },
  { section: 'ai', tier: 'P3', name: 'Biometric Update', url: 'https://www.biometricupdate.com/feed' },
  { section: 'ai', tier: 'P3', name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/feed/' },
  { section: 'ai', tier: 'P3', name: 'SemiAnalysis', url: 'https://newsletter.semianalysis.com/feed' },
  { section: 'ai', tier: 'P3', name: 'The Neuron', url: 'https://rss.beehiiv.com/feeds/N4eCstxvgX.xml' },
  // ── Krypto (18) ────────────────────────────────────────────
  { section: 'krypto', tier: 'P1', name: 'Bitcoin Core — GitHub + bitcoincore.org', url: 'https://bitcoincore.org/en/feed.xml' },
  { section: 'krypto', tier: 'P1', name: 'CFTC — Newsroom', url: 'https://www.cftc.gov/rss.xml' },
  { section: 'krypto', tier: 'P1', name: 'DOJ / FBI IC3 — Tlačové správy', url: 'https://www.justice.gov/rss.xml' },
  { section: 'krypto', tier: 'P1', name: 'EBA — Stablecoiny / EMT ART', url: 'https://www.eba.europa.eu/rss.xml' },
  { section: 'krypto', tier: 'P1', name: 'ESMA — Úvod + MiCA', url: 'https://www.esma.europa.eu/rss.xml' },
  { section: 'krypto', tier: 'P1', name: 'Ethereum Foundation — Blog', url: 'https://blog.ethereum.org/en/feed.xml' },
  { section: 'krypto', tier: 'P1', name: 'Solana Status — Status + GitHub', url: 'https://status.solana.com/history.atom' },
  { section: 'krypto', tier: 'P1', name: 'Trezor — Blog', url: 'https://blog.trezor.io/feed/' },
  { section: 'krypto', tier: 'P2', name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/feed' },
  { section: 'krypto', tier: 'P2', name: 'Bleeping Computer', url: 'https://www.bleepingcomputer.com/feed/' },
  { section: 'krypto', tier: 'P2', name: 'Blockworks', url: 'https://blockworks.co/feed/' },
  { section: 'krypto', tier: 'P2', name: 'Decrypt', url: 'https://decrypt.co/feed/' },
  { section: 'krypto', tier: 'P2', name: 'Financial Times', url: 'https://www.ft.com/rss/home/international' },
  { section: 'krypto', tier: 'P2', name: 'SCMP', url: 'https://www.scmp.com/rss/feed' },
  { section: 'krypto', tier: 'P2', name: 'The Block', url: 'https://www.theblock.co/rss.xml' },
  { section: 'krypto', tier: 'P2', name: 'The Defiant', url: 'https://thedefiant.io/feed' },
  { section: 'krypto', tier: 'P3', name: 'Chainalysis blog', url: 'https://www.chainalysis.com/blog/feed/' },
  { section: 'krypto', tier: 'P3', name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
  // ── Svet (24) ──────────────────────────────────────────────
  { section: 'svet', tier: 'P1', name: 'Biela snemovňa', url: 'https://www.whitehouse.gov/news/feed/' },
  { section: 'svet', tier: 'P1', name: 'EK Press corner', url: 'https://ec.europa.eu/commission/presscorner/api/rss' },
  { section: 'svet', tier: 'P1', name: 'IAEA', url: 'https://www.iaea.org/feeds/topnews' },
  { section: 'svet', tier: 'P1', name: 'WHO', url: 'https://www.who.int/rss-feeds/news-english.xml' },
  { section: 'svet', tier: 'P1', name: 'Úrad vlády SR', url: 'https://www.vlada.gov.sk/rss/' },
  { section: 'svet', tier: 'P2', name: 'AFP — World', url: 'https://www.afp.com/rss.xml' },
  { section: 'svet', tier: 'P2', name: 'Al Jazeera — World', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { section: 'svet', tier: 'P2', name: 'BBC News — World', url: 'https://www.bbc.com/news/rss.xml' },
  { section: 'svet', tier: 'P2', name: 'EUobserver — EU', url: 'https://euobserver.com/feed/' },
  { section: 'svet', tier: 'P2', name: 'Financial Times', url: 'https://www.ft.com/rss/home/international' },
  { section: 'svet', tier: 'P2', name: 'France 24 — World', url: 'https://www.france24.com/en/rss' },
  { section: 'svet', tier: 'P2', name: 'Kyiv Independent / Meduza — Regionálne', url: 'https://kyivindependent.com/news-archive/rss/' },
  { section: 'svet', tier: 'P2', name: 'Maďarsko — 444 / 24.hu', url: 'https://444.hu/feed/' },
  { section: 'svet', tier: 'P2', name: 'New York Times — World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { section: 'svet', tier: 'P2', name: 'Poľsko — Gazeta Wyborcza', url: 'https://wyborcza.pl/pub/rss/najnowsze_wyborcza.xml' },
  { section: 'svet', tier: 'P2', name: 'Poľsko — OKO.press / Onet', url: 'https://oko.press/feed/' },
  { section: 'svet', tier: 'P2', name: 'Poľsko — Rzeczpospolita', url: 'https://www.rp.pl/rss_main' },
  { section: 'svet', tier: 'P2', name: 'SCMP', url: 'https://www.scmp.com/rss/feed' },
  { section: 'svet', tier: 'P2', name: 'Česko — Deník N / Seznam Zprávy / Respekt', url: 'https://denikn.cz/feed/' },
  { section: 'svet', tier: 'P2', name: 'Česko — iROZHLAS', url: 'https://www.irozhlas.cz/rss/irozhlas' },
  { section: 'svet', tier: 'P2', name: 'Česko — ČT24', url: 'https://ct24.ceskatelevize.cz/rss' },
  { section: 'svet', tier: 'P3', name: 'Maďarsko — Hungary Today', url: 'https://hungarytoday.hu/feed/' },
  { section: 'svet', tier: 'P3', name: 'Politico Europe — Brussels', url: 'https://www.politico.eu/feed/' },
  // ── Ekonomika (12) ─────────────────────────────────────────
  { section: 'ekonomika', tier: 'P1', name: 'BEA', url: 'https://www.bea.gov/news/blog/feed' },
  { section: 'ekonomika', tier: 'P1', name: 'BIS — Speeches + reports', url: 'https://www.bis.org/rss.xml' },
  { section: 'ekonomika', tier: 'P1', name: 'BLS — CPI / payrolls', url: 'https://www.bls.gov/feed/bls_latest.rss' },
  { section: 'ekonomika', tier: 'P1', name: 'BoE', url: 'https://www.bankofengland.co.uk/rss/news' },
  { section: 'ekonomika', tier: 'P1', name: 'BoJ', url: 'https://www.boj.or.jp/en/rss/whatsnew.xml' },
  { section: 'ekonomika', tier: 'P1', name: 'ECB press', url: 'https://www.ecb.europa.eu/rss/press.html' },
  { section: 'ekonomika', tier: 'P1', name: 'ECFIN', url: 'https://economy-finance.ec.europa.eu/node/2/rss_en' },
  { section: 'ekonomika', tier: 'P1', name: 'EK Press corner', url: 'https://ec.europa.eu/commission/presscorner/api/rss' },
  { section: 'ekonomika', tier: 'P1', name: 'Fed — FOMC', url: 'https://www.federalreserve.gov/feeds/press_monetary.xml' },
  { section: 'ekonomika', tier: 'P1', name: 'MF SR', url: 'https://www.mfsr.sk/sk/rss.html' },
  { section: 'ekonomika', tier: 'P1', name: 'SK — NBS', url: 'https://nbs.sk/feed/' },
  { section: 'ekonomika', tier: 'P2', name: 'Financial Times', url: 'https://www.ft.com/rss/home/international' },
];

// ── SITEMAP ZDROJE — weby bez RSS z pôvodných AI/Krypto zošitov ──────────
// Doplnené 16. 9. 2026 na žiadosť používateľa („aj stránky, čo som ti poslal
// predtým"). Namiesto <item> z feedu sa sledujú ADRESY zo sitemapy — nová
// (dosiaľ nevidená) adresa = nová položka. Titulok sa dotiahne LEN pre to,
// čo prejde SECTION_CAP výberom (viď fetchPageTitle() v digest.mjs).
// robots.txt pre všetky nižšie overený naživo (fail-closed, 3 pokusy) —
// viď rozhovor zo 16. 9. Vynechané: Binance (sitemap fragmentovaný po
// jazykoch, announcement sekcia vedie na FAQ, nie reálne oznámenia),
// Coinbase/Circle/BlackRock (sitemap dominuje iný obsah, nie blog/newsroom),
// Kraken (403), Tether (sitemap prázdny), SEC (sitemap je len stránkovanie,
// nie zoznam adries), Runway/Perplexity (sitemap má len statické stránky,
// žiadne jednotlivé články).
export const DIGEST_SITEMAP_SOURCES = [
  // ── AI (7) ─────────────────────────────────────────────────
  { section: 'ai', tier: 'P1', name: 'Anthropic News', origin: 'https://www.anthropic.com', hint: '/news/' },
  { section: 'ai', tier: 'P1', name: 'Claude Blog', origin: 'https://claude.com', hint: '/blog/' },
  { section: 'ai', tier: 'P1', name: 'xAI News', origin: 'https://x.ai', hint: '/news/' },
  { section: 'ai', tier: 'P1', name: 'ElevenLabs Blog', origin: 'https://elevenlabs.io', hint: '/blog/' },
  { section: 'ai', tier: 'P1', name: 'Cohere Blog', origin: 'https://cohere.com', hint: '/blog/' },
  { section: 'ai', tier: 'P1', name: 'Scale AI Blog', origin: 'https://scale.com', hint: '/blog/' },
  { section: 'ai', tier: 'P1', name: 'Dario Amodei — osobný web', origin: 'https://www.darioamodei.com', hint: '/post/' },
  // ── Krypto (4) ─────────────────────────────────────────────
  { section: 'krypto', tier: 'P1', name: 'Ledger — Blog / Donjon', origin: 'https://www.ledger.com', hint: '/blog' },
  { section: 'krypto', tier: 'P1', name: 'OFAC — Recent Actions', origin: 'https://ofac.treasury.gov', hint: '/recent-actions' },
  { section: 'krypto', tier: 'P2', name: 'Fortune Crypto', origin: 'https://fortune.com', hint: '/crypto' },
  { section: 'krypto', tier: 'P2', name: 'DL News', origin: 'https://www.dlnews.com', hint: '/articles' },
];

