// Spoločné jadro pre generovanie SK článkov. Nahrádza 4× skopírovaný kód.
const { fetchUrl } = require("./net");
const { parseRSS } = require("./rss");
const { appendRow, readArticlesIndex } = require("./sheets");
const { generateArticle } = require("./ai");
const { PARAGRAPH_DELIM } = require("./config");

// Unikátne ID založené na čase + počítadlo v rámci behu => žiadne kolízie
// pri súbehu viacerých cron jobov.
let counter = 0;
function uniqueId() {
  counter += 1;
  return `${Date.now()}${String(counter).padStart(2, "0")}`;
}

// Odseky na uloženie do jednej bunky: skutočné \n by rozbili CSV,
// preto ich nahradíme oddeľovačom, ktorý vie clanok.html rozdeliť späť.
function paragraphsToCell(content) {
  return String(content || "")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .join(` ${PARAGRAPH_DELIM} `);
}

function requireEnv() {
  const env = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GOOGLE_SHEETS_ID: process.env.GOOGLE_SHEETS_ID,
    GOOGLE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  };
  const missing = Object.entries(env).filter(([, v]) => !v).map(([k]) => k);
  return { env, missing };
}

// category: "krypto" | "svet" | "sport"
// feeds: [{ url, source }]
// perFeed: koľko nových článkov max. z jedného feedu
async function runGenerator({ category, feeds, perFeed = 1 }) {
  const { env, missing } = requireEnv();
  if (missing.length) return { error: "Chýbajú premenné: " + missing.join(", "), generated: 0, errors: [] };

  // jeden autentifikovaný (čerstvý) sken existujúcich článkov pre dedup
  let index;
  try {
    index = await readArticlesIndex(env.GOOGLE_SHEETS_ID, env.GOOGLE_SERVICE_ACCOUNT_KEY);
  } catch (e) {
    return { error: "Dedup index zlyhal: " + e.message, generated: 0, errors: [] };
  }

  let generated = 0;
  const errors = [];

  for (const feed of feeds) {
    try {
      const xml = await fetchUrl(feed.url, { timeout: 8000 });
      // vezmi pár navyše, keby boli prvé už spracované
      const items = parseRSS(xml, { source: feed.source, category, limit: perFeed + 4 });

      let made = 0;
      for (const item of items) {
        if (made >= perFeed) break;

        const titleKey = item.title.toLowerCase().trim();
        if (index.links.has(item.link) || index.titles.has(titleKey)) continue; // už existuje

        const article = await generateArticle(item, env.ANTHROPIC_API_KEY);
        if (!article || !article.title) continue;

        const row = [
          uniqueId(),
          article.title,
          article.perex || "",
          paragraphsToCell(article.content),
          `${feed.source} | ${item.link}`,
          new Date().toISOString(),
          category,
        ];

        await appendRow(env.GOOGLE_SHEETS_ID, row, env.GOOGLE_SERVICE_ACCOUNT_KEY);

        // hneď zapíš do indexu, nech v tom istom behu nevznikne duplicita
        index.links.add(item.link);
        index.titles.add(titleKey);
        generated += 1;
        made += 1;
      }
    } catch (e) {
      errors.push(`${feed.source}: ${e.message}`);
    }
  }

  return { generated, errors };
}

module.exports = { runGenerator, paragraphsToCell, uniqueId };
