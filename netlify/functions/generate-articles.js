const https = require("https");
const http = require("http");

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtPtTXs5LQzJ1eULRyirCm_yec1EYGKokkihH2FfgHmh8p7gG9kGpstAPkxJHKtlm2VQcJ_uNh5-Oo/pub?gid=0&single=true&output=csv";
const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

const CRYPTO_FEEDS = [
  { url: "https://cointelegraph.com/rss", source: "CoinTelegraph" },
  { url: "https://coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk" },
  { url: "https://decrypt.co/feed", source: "Decrypt" },
];

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Novinko/1.0)", ...options.headers }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, options).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let result = "";
      res.on("data", (chunk) => (result += chunk));
      res.on("end", () => resolve(JSON.parse(result)));
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Timeout")); });
    req.write(data);
    req.end();
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
    if (title && link) {
      items.push({
        title: title.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim(),
        link: link.trim(),
        description: description.replace(/<[^>]+]/g, "").replace(/&amp;/g, "&").substring(0, 500).trim(),
        source,
      });
    }
  }
  return items.slice(0, 2);
}

async function generateSKArticle(item) {
  const data = await postJson(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Si slovenský novinár píšuci o kryptomenách. Na základe týchto faktov napíš ÚPLNE NOVÝ článok v slovenčine vlastnými vetami. Neprekladaj doslovne.

Titulok: ${item.title}
Obsah: ${item.description}
Zdroj: ${item.source}

Odpoveď MUSÍ byť v tomto JSON formáte (bez markdown):
{"title":"slovenský titulok","perex":"2-3 vety zhrnutie","content":"telo článku v 3-4 odsekoch oddelených \\n\\n"}`
      }]
    },
    {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    }
  );

  const text = data.content?.[0]?.text || "{}";
  try {
    return JSON.parse(text.trim());
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

async function getAccessToken() {
  const auth = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
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

  const tokenData = await postJson(
    "https://oauth2.googleapis.com/token",
    `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${token}`,
    { "Content-Type": "application/x-www-form-urlencoded" }
  );
  return tokenData.access_token;
}

async function appendToSheet(row) {
  const accessToken = await getAccessToken();
  await postJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_ID}/values/articles!A:G:append?valueInputOption=RAW`,
    { values: [row] },
    { Authorization: `Bearer ${accessToken}` }
  );
}

exports.handler = async (event) => {
  try {
    const missing = [];
    if (!ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
    if (!GOOGLE_SHEETS_ID) missing.push("GOOGLE_SHEETS_ID");
    if (!GOOGLE_SERVICE_ACCOUNT_KEY) missing.push("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (missing.length > 0) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing: " + missing.join(", ") }) };
    }

    let lastId = await getLastId();
    let generated = 0;

    for (const feed of CRYPTO_FEEDS) {
      const xml = await fetchUrl(feed.url);
      const items = parseRSS(xml, feed.source);

      for (const item of items.slice(0, 1)) {
        const article = await generateSKArticle(item);
        if (!article || !article.title) continue;

        lastId++;
        const row = [
          lastId,
          article.title,
          article.perex || "",
          article.content || "",
          `${feed.source} | ${item.link}`,
          new Date().toISOString(),
          "krypto",
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
