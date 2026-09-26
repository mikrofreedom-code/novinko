// Google Sheets vrstva. Zápis a DEDUPLIKÁCIA idú cez autentifikované API
// (vždy čerstvé dáta), nie cez publikovaný CSV (ten má oneskorenie a spôsoboval duplicity).
const jwt = require("jsonwebtoken");
const { httpsPost, httpsGet, fetchUrl } = require("./net");
const { parseCSVLine } = require("./csv");
const { SHEET_CSV_URL, MAX_AGE_HOURS } = require("./config");
const { slugify } = require("./clanok-render");
const { parseMeta, sameTopic } = require("./zahady");
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
// Pridá jeden riadok do hárku "articles" (stĺpce A:J — H je voliteľný obrázok,
// I zdroj obrázka, J metadáta Záhad; kratšie riadky fungujú ďalej, chýbajúce stĺpce
// zostanú prázdne).
async function appendRow(sheetsId, row, serviceAccountKey) {
  const token = await getAccessToken(serviceAccountKey);
  const path =
    `/v4/spreadsheets/${sheetsId}/values/articles!A:J:append` +
    `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
  const res = await httpsPost("sheets.googleapis.com", path, { values: [row] }, {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });
  // httpsPost neodmieta HTTP chyby — bez kontroly by sa neúspešný zápis tváril ako zverejnený článok.
  if (!res || !res.updates) {
    throw new Error(`zápis do hárku zlyhal: ${JSON.stringify(res?.error ?? res).slice(0, 200)}`);
  }
  return res;
}

// ID všetkých riadkov (stĺpec A) cez API — publikovaný CSV zaostáva o minúty.
async function sheetRowIds(sheetsId, serviceAccountKey) {
  const token = await getAccessToken(serviceAccountKey);
  const path = `/v4/spreadsheets/${sheetsId}/values/${encodeURIComponent("articles!A:A")}`;
  const res = await httpsGet("sheets.googleapis.com", path, { Authorization: `Bearer ${token}` });
  if (!res || typeof res !== "object" || res.error) {
    throw new Error(`čítanie hárku zlyhalo: ${JSON.stringify(res?.error ?? res).slice(0, 200)}`);
  }
  return new Set((res.values || []).map((r) => String(r[0] ?? "").trim()).filter(Boolean));
}

// Kontrola témy ide cez autentifikované API, pretože verejný CSV zaostáva.
// Zhodu podľa alternatívneho názvu berieme rovnako vážne ako zhodu hlavného názvu.
async function findMysteryTopic(sheetsId, serviceAccountKey, names, ignoreArticleId = null) {
  const token = await getAccessToken(serviceAccountKey);
  const path = `/v4/spreadsheets/${sheetsId}/values/${encodeURIComponent("articles!A:J")}`;
  const res = await httpsGet("sheets.googleapis.com", path, { Authorization: `Bearer ${token}` });
  if (!res || res.error) throw new Error('kontrola duplicitných tém zlyhala');
  for (const row of (res.values || []).slice(1)) {
    if (row[6] !== 'zahady') continue;
    if (ignoreArticleId && String(row[0]) === String(ignoreArticleId)) continue;
    const meta = parseMeta(row[9]);
    const known = [meta.canonicalTopic, row[1], ...(meta.aliases || [])];
    if (known.some((name) => names.some((wanted) => sameTopic(name, wanted)))) {
      return { id: row[0], title: row[1] };
    }
  }
  return null;
}

async function findSheetArticle(sheetsId, serviceAccountKey, articleId) {
  const token = await getAccessToken(serviceAccountKey);
  const path = `/v4/spreadsheets/${sheetsId}/values/${encodeURIComponent('articles!A:J')}`;
  const res = await httpsGet('sheets.googleapis.com', path, { Authorization: `Bearer ${token}` });
  if (!res || res.error) throw new Error('Čítanie článku z hárku zlyhalo');
  const index = (res.values || []).findIndex((row) => String(row[0]) === String(articleId));
  if (index < 1) return null;
  return { row: res.values[index], rowNumber: index + 1 };
}

async function updateSheetArticle(sheetsId, serviceAccountKey, rowNumber, row) {
  const token = await getAccessToken(serviceAccountKey);
  const range = encodeURIComponent(`articles!A${rowNumber}:J${rowNumber}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetsId}/values/${range}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ range: `articles!A${rowNumber}:J${rowNumber}`, majorDimension: 'ROWS', values: [row] }),
  });
  if (!res.ok) throw new Error(`aktualizácia článku zlyhala: HTTP ${res.status}`);
  return res.json();
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
  const rows = lines
    .map((line) => {
      const c = parseCSVLine(line);
      const [id, title, perex, , , date, category, imageUrl, imageCredit, metaCell] = c;
      if (!id || !title) return null;
      const mystery = category === 'zahady' ? parseMeta(metaCell) : {};
      return {
        title,
        // Indexovateľná adresa obsluhovaná funkciou clanok.js. Predtým sa
        // odkazovalo na /clanok.html?id=…, čo je verzia skladaná JavaScriptom
        // s noindex — Google z hlavnej nemal kam ísť. Funkcia je dostupná vždy,
        // takže tu nehrozí 404 ako pri statických súboroch generovaných buildom.
        link: `/clanok/${mystery.slug || slugify(title)}-${encodeURIComponent(id)}`,
        description: perex || "",
        pubDate: date || new Date().toISOString(),
        image: imageUrl || "",
        imageCredit: imageCredit || "",
        source: "tím Novinko",
        category: category || "krypto",
        id,
        mystery,
      };
    })
    .filter(Boolean);
  // Hárok bez jediného platného riadku je výpadok, nie prázdny web.
  if (!rows.length) throw new Error("hárok nevrátil žiadny platný článok");
  const items = rows
    .filter((it) => {
      // dedup podľa titulku V RÁMCI kategórie (ten istý evergreen smie byť aj na
      // hlavnej 'krypto' aj v sekcii 'krypto-skola' — rôzne kategórie, nevyhadzuj).
      const key = it.category === 'zahady'
        ? `zahady::${it.id}`
        : (it.category || "krypto") + "::" + it.title.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter((it) => {
      if (opts.all) return true; // archív chce všetko
      if (it.category === "krypto-skola") return true; // evergreen (Krypto škola) nevyprší
      const age = now - new Date(it.pubDate).getTime();
      return age <= maxAgeMs; // len mladšie ako 24h
    })
    .reverse(); // najnovšie prvé
  return items;
}
module.exports = { getAccessToken, appendRow, sheetRowIds, findMysteryTopic, findSheetArticle, updateSheetArticle, fetchSheetItems };
