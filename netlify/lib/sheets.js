// Google Sheets vrstva. Zápis a DEDUPLIKÁCIA idú cez autentifikované API
// (vždy čerstvé dáta), nie cez publikovaný CSV (ten má oneskorenie a spôsoboval duplicity).
const jwt = require("jsonwebtoken");
const { httpsPost, httpsGet, fetchUrl } = require("./net");
const { parseCSVLine } = require("./csv");
const { SHEET_CSV_URL, MAX_AGE_HOURS } = require("./config");
async function getAccessToken(serviceAccountKey) {
  const auth = JSON.parse(serviceAccountKey);
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
  const res = await httpsPost("oauth2.googleapis.com", "/token", body, {
    "Content-Type": "application/x-www-form-urlencoded",
  });
  if (!res.access_token) throw new Error("Nepodarilo sa získať access token");
  return res.access_token;
}
// Pridá jeden riadok do hárku "articles" (stĺpce A:G).
async function appendRow(sheetsId, row, serviceAccountKey) {
  const token = await getAccessToken(serviceAccountKey);
  const path =
    `/v4/spreadsheets/${sheetsId}/values/articles!A:G:append` +
    `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  return httpsPost("sheets.googleapis.com", path, { values: [row] }, {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });
}
// Načíta existujúce titulky a zdrojové linky -> Set-y pre spoľahlivý dedup.
// Stĺpec B = titulok, stĺpec E = "Zdroj | originálny link".
function normalizeLink(link) {
  if (!link) return "";
  let s = String(link).trim();
  try {
    const u = new URL(s);
    u.search = "";
    u.hash = "";
    return u.toString().replace(/\/+$/, "").toLowerCase();
  } catch (e) {
    return s.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
  }
}

async function readArticlesIndex(sheetsId, serviceAccountKey) {
  const token = await getAccessToken(serviceAccountKey);
  const path =
    `/v4/spreadsheets/${sheetsId}/values:batchGet` +
    `?ranges=${encodeURIComponent("articles!B:B")}` +
    `&ranges=${encodeURIComponent("articles!E:E")}`;
  const res = await httpsGet("sheets.googleapis.com", path, { Authorization: `Bearer ${token}` });
  const ranges = res.valueRanges || [];
  const titleRows = ranges[0]?.values || [];
  const sourceRows = ranges[1]?.values || [];
  const titles = new Set(titleRows.map((r) => (r[0] || "").toLowerCase().trim()).filter(Boolean));
  const links = new Set(
    sourceRows
      .map((r) => (r[0] || "").split("|")[1]) // časť za "|"
      .map((l) => normalizeLink(l))
      .filter(Boolean)
  );
  return { titles, links };
}
// Načíta vlastné SK články pre ZOBRAZENIE (publikovaný CSV stačí, robí to cron).
// Stĺpce podľa pozície: id, title, perex, content, source, date, category
// opts.all = true  -> vráti všetky (pre archív), inak len mladšie ako MAX_AGE_HOURS
async function fetchSheetItems(opts = {}) {
  const csv = await fetchUrl(SHEET_CSV_URL, { timeout: 8000 });
  const lines = csv.trim().split("\n").slice(1).filter((l) => l.trim()); // bez hlavičky
  const maxAgeMs = MAX_AGE_HOURS * 60 * 60 * 1000;
  const now = Date.now();
  const seen = new Set();
  const items = lines
    .map((line) => {
      const c = parseCSVLine(line);
      const [id, title, perex, , , date, category] = c;
      if (!id || !title) return null;
      return {
        title,
        link: `/clanok.html?id=${encodeURIComponent(id)}`,
        description: perex || "",
        pubDate: date || new Date().toISOString(),
        image: "",
        source: "Novinko SK",
        category: category || "krypto",
      };
    })
    .filter(Boolean)
    .filter((it) => {
      // dedup podľa titulku (poistka pri zobrazení)
      const key = it.title.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter((it) => {
      if (opts.all) return true; // archív chce všetko
      const age = now - new Date(it.pubDate).getTime();
      return age <= maxAgeMs; // len mladšie ako 24h
    })
    .reverse(); // najnovšie prvé
  return items;
}
module.exports = { getAccessToken, appendRow, readArticlesIndex, fetchSheetItems, normalizeLink };
