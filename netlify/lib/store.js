// Tenká vrstva nad Netlify Blobs. Pri klasickom handleri (event) treba najprv
// zavolať connect(event) – inak SDK nevie načítať kontext a getStore zlyhá.
const { STORE_NAME } = require("./config");

let blobs = null;
try { blobs = require("@netlify/blobs"); } catch { /* nedostupné */ }

function connect(event) {
  if (blobs && typeof blobs.connectLambda === "function" && event) {
    try { blobs.connectLambda(event); } catch { /* ignoruj */ }
  }
}

function store() {
  if (!blobs || typeof blobs.getStore !== "function") return null;
  try { return blobs.getStore(STORE_NAME); } catch { return null; }
}

async function saveNews(key, data) {
  const s = store();
  if (!s) throw new Error("Netlify Blobs nie sú dostupné");
  await s.setJSON(key, data);
}

async function loadNews(key) {
  const s = store();
  if (!s) return null;
  try { return await s.get(key, { type: "json" }); } catch { return null; }
}

module.exports = { connect, saveNews, loadNews };
