const https = require("https");
const http = require("http");

// Google Sheets CSV URL (na čítanie)
const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtPtTXs5LQzJ1eULRyirCm_yec1EYGKokkihH2FfgHmh8p7gG9kGpstAPkxJHKtlm2VQcJ_uNh5-Oo/pub?gid=0&single=true&output=csv";

// Google Sheets API (na zápis) - nastav cez Netlify environment variables
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Krypto RSS feedy na spracovanie
const CRYPTO_FEEDS = [
  { url: "https://cointelegraph.com/rss", source: "CoinTelegraph" },
  { url: "https://coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk" },
  { url: "https://decrypt.co/feed", source: "Decrypt" },
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Novinko/1.0)" }
    }, (res) => {
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

function parseRSS(xml, source) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/) || [])[1] || "";
    const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || "";
    const description = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || item.match(/<description>(.*?)<\/description>/) || [])[1] || "";
    const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || "";
    if (title && link) {
      items.push({
        title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim(),
        link: link.trim(),
        description: description.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").substring(0, 500).trim(),
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        source,
      });
    }
  }
  return items.slice(0, 3); // top 3 z každého zdroja
}

async function generateSKArticle(item) {
  const prompt = `Si slovenský novinár píšuci o kryptomenách. Na základe nasledujúcich faktov z anglického článku napíš ÚPLNE NOVÝ a ORIGINÁLNY článok v slovenčine. 

PRAVIDLÁ:
- Neprekladaj doslovne, píš vlastnými vetami
- Použi len fakty a čísla z originálu
- Vysvetli pojmy jednoducho pre slovenského čitateľa
- Tón: profesionálny ale zrozumiteľný

VSTUP:
Titulok: ${item.title}
Obsah: ${item.description}
Zdroj: ${item.source}

Odpoveď MUSÍ byť v tomto JSON formáte (bez markdown, len čistý JSON):
{
  "title": "slovenský titulok",
  "perex": "2-3 vety zhrnutie po slovensky",
  "content": "telo článku v 3-4 odsekoch po slovensky oddelených \\n\\n"
}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  const text = data.content?.[0]?.text || "{}";
  
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch (e) {
    return null;
  }
}

async function getLastId() {
  try {
    const csv = await fetchUrl(SHEET_CSV_URL);
    const rows = csv.trim().split("\n");
    if (rows.length <= 1) return 0;
    const lastRow = rows[rows.length - 1].split(",");
    return parseInt(lastRow[0]) || 0;
  } catch (e) {
    return 0;
  }
}

async function appendToSheet(row) {
  // Použijeme Google Sheets API cez service account
  // Toto vyžaduje GOOGLE_SERVICE_ACCOUNT_KEY a GOOGLE_SHEETS_ID v Netlify env vars
  const auth = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
  
  // JWT token pre Google API
  const jwt = require("jsonwebtoken");
  const token = jwt.sign(
    {
      iss: auth.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    },
    auth.private_key,
    { algorithm: "RS256" }
  );

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`,
  });

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/articles!A:G:append?valueInputOption=RAW`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );
}

exports.handler = async (event) => {
  try {
    let lastId = await getLastId();
    let generated = 0;

    for (const feed of CRYPTO_FEEDS) {
      const xml = await fetchUrl(feed.url);
      const items = parseRSS(xml, feed.source);

      for (const item of items.slice(0, 1)) { // 1 článok z každého zdroja
        const article = await generateSKArticle(item);
        if (!article || !article.title) continue;

        lastId++;
        const row = [
          lastId,
          article.title,
          article.perex,
          article.content,
          `${feed.source} | ${item.link}`,
          new Date().toISOString(),
          "krypto-sk",
        ];

        await appendToSheet(row);
        generated++;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, generated }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
