const https = require("https");
const http = require("http");

const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZoj1iM9WKbX_S-0Zsu-3ZU3vZGro3UFcWyGuuBY4e8sR474C9X0xf33N1Cok0YSqoLDVPn_dCVFXW/pub?output=csv";

const WORLD_FEEDS = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC World' },
  { url: 'https://feeds.feedburner.com/euractiv/MXP', source: 'Euractiv' },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
];

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
      let data = "";      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function httpsPost(hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = typeof body === "string" ? body : JSON.stringify(body);
    const options = {
      hostname,
      path,
      method: "POST",
      headers: {
        "Content-Length": Buffer.byteLength(data),
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
      let result = "";
      res.on("data", (chunk) => (result += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(result)); }
        catch (e) { resolve(result); }
      });
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
        description: description.replace(/<[^>]+>/g, "").substring(0, 500).trim(),
        source,
      });
    }
  }
  return items.slice(0, 2);
}

async function generateSKArticle(item, apiKey) {
  const data = await httpsPost(
    "api.anthropic.com",
    "/v1/messages",
    {
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `Si skúsený slovenský novinár. Napíš NOVÝ článok v prirodzenej slovenčine. Neprekladaj doslovne, použi vlastné vety. Titulok MUSÍ byť originálny slovenský. Zdôrazni súvislosť so Slovenskom alebo strednou Európou ak je relevantná.\nPravidlá: Používaj správnu slovenskú gramatiku a prirodzené slovenské výrazy. Anglické slová prekladaj správne (views=zhliadnutí, followers=sledovateľov, trending=trending).\nTitulok: ${item.title}\nObsah: ${item.description}\nZdroj: ${item.source}\nOdpoveď MUSÍ byť v tomto JSON formáte bez markdown:\n{"title":"slovenský titulok","perex":"2-3 vety zhrnutie","content":"3-4 odseky oddelené \\n\\n"}`
      }]
    },
    {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }
  );
  const text = data.content?.[0]?.text || "{}";
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    return null;
  }
}


async function titleExists(sheetsId, title, serviceAccountKey) {
  try {
    const csv = await fetchUrl(SHEET_CSV_URL);
    return csv.toLowerCase().includes(title.toLowerCase().substring(0, 30));
  } catch(e) { return false; }
}

async function titleExists(sheetsId, title, serviceAccountKey) {
  try {
    const csv = await fetchUrl(SHEET_CSV_URL);
    return csv.toLowerCase().includes(title.toLowerCase().substring(0, 30));
  } catch(e) { return false; }
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

async function getAccessToken(serviceAccountKey) {
  let auth;
  try {
    auth = JSON.parse(serviceAccountKey);
  } catch(e) {
    throw e;
  }
  const jwt = require("jsonwebtoken");

  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    {
      iss: auth.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    },
    auth.private_key,
    { algorithm: "RS256" }
  );

  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${token}`;
  const tokenData = await httpsPost(
    "oauth2.googleapis.com",
    "/token",
    body,
    { "Content-Type": "application/x-www-form-urlencoded" }
  );
  return tokenData.access_token;
}

async function appendToSheet(sheetsId, row, serviceAccountKey) {
  const accessToken = await getAccessToken(serviceAccountKey);
  const path = `/v4/spreadsheets/${sheetsId}/values/articles!A:G:append?valueInputOption=RAW`;
  const result = await httpsPost(
    "sheets.googleapis.com",
    path,
    { values: [row] },
    {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    }
  );
  return result;
}

exports.handler = async (event) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const GOOGLE_SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
  const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  const missing = [];
  if (!ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY");
  if (!GOOGLE_SHEETS_ID) missing.push("GOOGLE_SHEETS_ID");
  if (!GOOGLE_SERVICE_ACCOUNT_KEY) missing.push("GOOGLE_SERVICE_ACCOUNT_KEY");
  if (missing.length > 0) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing: " + missing.join(", ") }) };
  }

  try {
    let lastId = await getLastId();
    let generated = 0;
    const errors = [];

    for (const feed of WORLD_FEEDS) {
      try {
        const xml = await fetchUrl(feed.url);
        const items = parseRSS(xml, feed.source);

        for (const item of items.slice(0, 1)) {
          console.log("Checking:", item.title.substring(0,30));
          const exists = await titleExists(GOOGLE_SHEETS_ID, item.title, GOOGLE_SERVICE_ACCOUNT_KEY);
          if (exists) continue;
          if (exists) continue;
          const article = await generateSKArticle(item, ANTHROPIC_API_KEY);
	  if (!article || !article.title) continue;

          lastId++;
          const row = [
            lastId,
            article.title,
            article.perex || "",
            (article.content || "").replace(/\n/g, " ").replace(/\r/g, ""),
            `${feed.source} | ${item.link}`,
            new Date().toISOString(),
            "svet",
          ];

          const sheetResult = await appendToSheet(GOOGLE_SHEETS_ID, row, GOOGLE_SERVICE_ACCOUNT_KEY);
          generated++;
        }
      } catch (e) {
        errors.push(`${feed.source}: ${e.message}`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, generated, errors }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
