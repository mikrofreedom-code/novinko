// Sieťové pomocníky – jediná implementácia pre celý projekt.
const https = require("https");
const http = require("http");

const UA = "Mozilla/5.0 (compatible; Novinko/1.0; +https://novinko.netlify.app)";

// GET ľubovoľného URL s podporou presmerovaní a timeoutom.
function fetchUrl(url, { timeout = 6000, redirects = 0 } = {}) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error("Príliš veľa presmerovaní"));
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
      let data = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
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
      let result = "";
      res.on("data", (chunk) => (result += chunk));
      res.on("end", () => { try { resolve(JSON.parse(result)); } catch { resolve(result); } });
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
      let result = "";
      res.on("data", (chunk) => (result += chunk));
      res.on("end", () => { try { resolve(JSON.parse(result)); } catch { resolve(result); } });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error("Timeout")); });
    req.end();
  });
}

module.exports = { fetchUrl, httpsPost, httpsGet };
