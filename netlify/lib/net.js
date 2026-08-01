// Sieťové pomocníky – jediná implementácia pre celý projekt.
const https = require("https");
const http = require("http");

const UA = "Mozilla/5.0 (compatible; Novinko/1.0; +https://novinko.netlify.app)";

// Zloží telo odpovede z BUFFEROV a dekóduje ho až na konci, naraz.
//
// PREČO TAKTO (2026-08-01): predtým tu bolo `result += chunk`, kde chunk je
// Buffer. Reťazcová konkatenácia zavolá chunk.toString() na KAŽDOM chunku
// zvlášť — a keď viacbajtový znak (č, š, ž, á…) padne na hranicu dvoch
// chunkov, rozpadne sa na dva neplatné kusy a vzniknú „�". V hárku sa takto
// pokazilo 61 z 1036 článkov („FIFA za��ala…", „Ruské ��toky…"), pretože týmto
// kódom chodí aj odpoveď z Anthropic API s hotovým slovenským textom.
// Buffer.concat() + jedno dekódovanie hranice chunkov rieši.
//
// charset: RSS feedy nie sú vždy v UTF-8 (staršie SK weby posielajú
// windows-1250 / iso-8859-2). Preto ho čítame z hlavičky Content-Type.
function decodeBody(chunks, contentType = "") {
  const buf = Buffer.concat(chunks);
  const m = /charset=["']?([\w-]+)/i.exec(contentType);
  const charset = (m ? m[1] : "utf-8").toLowerCase();
  if (charset === "utf-8" || charset === "utf8") return buf.toString("utf8");
  try {
    return new TextDecoder(charset).decode(buf);   // Node 20 vie aj windows-1250
  } catch {
    return buf.toString("utf8");                    // neznáme kódovanie → skús UTF-8
  }
}

// Adresy, na ktoré sťahovanie nikdy nesmie ísť: vnútro siete a cloudové
// metadáta. Feedy sú síce z pevného zoznamu, ale presmerovanie určuje CUDZÍ
// server — stačí, aby jeden zdroj odpovedal `302 → http://169.254.169.254/…`
// a naša funkcia mu poslušne stiahne metadáta prostredia. Preto kontrolujeme
// KAŽDÝ krok presmerovania, nielen pôvodnú adresu.
const BLOKOVANE_HOSTY = [
  /^localhost$/i,
  /^127\./, /^0\./, /^10\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,                 // link-local + metadáta AWS/GCP
  /^\[?::1\]?$/, /^\[?f[cd]/i,   // IPv6 loopback a unique-local
  /\.internal$/i, /\.local$/i,
];

function adresaJeBezpecna(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  return !BLOKOVANE_HOSTY.some((re) => re.test(host));
}

// GET ľubovoľného URL s podporou presmerovaní a timeoutom.
function fetchUrl(url, { timeout = 6000, redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("Príliš veľa presmerovaní"));
    if (!adresaJeBezpecna(url)) return reject(new Error("Zablokovaná adresa (vnútorná sieť)"));
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { headers: { "User-Agent": UA } }, (res) => {
      // presmerovanie
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); // uvoľni socket
        const loc = res.headers.location;
        const next = loc.startsWith("http") ? loc : new URL(loc, url).href;
        return fetchUrl(next, { timeout, redirects: redirects + 1 }).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(decodeBody(chunks, res.headers["content-type"])));
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

// POST s JSON alebo form telom; vráti parsovaný JSON ak sa dá.
function httpsPost(hostname, path, body, headers = {}, { timeout = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    const data = typeof body === "string" ? body : JSON.stringify(body);
    const options = {
      hostname, path, method: "POST",
      headers: { "Content-Length": Buffer.byteLength(data), ...headers },
    };
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const result = decodeBody(chunks, res.headers["content-type"]);
        try { resolve(JSON.parse(result)); } catch { resolve(result); }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("Timeout")); });
    req.write(data);
    req.end();
  });
}

// GET na JSON API (Google Sheets).
function httpsGet(hostname, path, headers = {}, { timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: "GET", headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const result = decodeBody(chunks, res.headers["content-type"]);
        try { resolve(JSON.parse(result)); } catch { resolve(result); }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

module.exports = { fetchUrl, httpsPost, httpsGet, adresaJeBezpecna };
