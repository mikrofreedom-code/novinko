// Jednorazové vyčistenie duplicít v Google Sheets.
// Spustenie:  node cleanup-sheet.js
require("dotenv").config();
const https = require("https");
const jwt = require("jsonwebtoken");

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SA_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

function request(method, hostname, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body == null ? "" : (typeof body === "string" ? body : JSON.stringify(body));
    const opts = { hostname, path, method, headers: { ...headers } };
    if (data) opts.headers["Content-Length"] = Buffer.byteLength(data);
    const req = https.request(opts, (res) => {
      let out = "";
      res.on("data", (c) => (out += c));
      res.on("end", () => { try { resolve(JSON.parse(out)); } catch { resolve(out); } });
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error("Timeout")); });
    if (data) req.write(data);
    req.end();
  });
}

async function getToken() {
  const auth = JSON.parse(SA_KEY);
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { iss: auth.client_email, scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token", exp: now + 3600, iat: now },
    auth.private_key, { algorithm: "RS256" }
  );
  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${token}`;
  const res = await request("POST", "oauth2.googleapis.com", "/token", body,
    { "Content-Type": "application/x-www-form-urlencoded" });
  if (!res.access_token) throw new Error("Nepodarilo sa získať token: " + JSON.stringify(res));
  return res.access_token;
}

function dedup(rows) {
  const seenIds = new Set();
  const seenLinks = new Set();
  const kept = [];
  let removed = 0;
  for (const row of rows) {
    const id = String(row[0] || "").trim();
    const link = String(row[4] || "").split("|")[1];
    const linkKey = (link || "").trim();
    const dup = (id && seenIds.has(id)) || (linkKey && seenLinks.has(linkKey));
    if (dup) { removed++; continue; }
    kept.push(row);
    if (id) seenIds.add(id);
    if (linkKey) seenLinks.add(linkKey);
  }
  return { kept, removed };
}

async function main() {
  if (!SHEET_ID || !SA_KEY) {
    console.error("Chýba GOOGLE_SHEETS_ID alebo GOOGLE_SERVICE_ACCOUNT_KEY v .env");
    process.exit(1);
  }
  const token = await getToken();
  const auth = { Authorization: `Bearer ${token}` };

  const got = await request("GET", "sheets.googleapis.com",
    `/v4/spreadsheets/${SHEET_ID}/values/articles!A:G`, null, auth);
  const values = got.values || [];
  if (values.length <= 1) { console.log("Hárok je prázdny, niet čo čistiť."); return; }

  const data = values.slice(1);
  console.log("Riadkov dát pred čistením:", data.length);

  const { kept, removed } = dedup(data);
  console.log("Duplicít na zmazanie:", removed);
  console.log("Riadkov po vyčistení:", kept.length);

  if (removed === 0) { console.log("Žiadne duplicity, hárok netreba meniť."); return; }

  await request("POST", "sheets.googleapis.com",
    `/v4/spreadsheets/${SHEET_ID}/values/articles!A2:G:clear`, {}, auth);
  await request("PUT", "sheets.googleapis.com",
    `/v4/spreadsheets/${SHEET_ID}/values/articles!A2?valueInputOption=RAW`,
    { values: kept }, { ...auth, "Content-Type": "application/json" });

  console.log(`Hotovo. Zmazaných ${removed} duplicít, ponechaných ${kept.length} článkov (+ hlavička).`);
}

main().catch((e) => { console.error("Chyba:", e.message); process.exit(1); });
