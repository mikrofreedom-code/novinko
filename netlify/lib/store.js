// Tenká vrstva nad Netlify Blobs. Ak Blobs nie sú dostupné (napr. lokálne mimo
// netlify dev), funkcie sa nezrútia – vrátia null / ticho zlyhajú.
const { STORE_NAME } = require("./config");

let getStore = null;
try { ({ getStore } = require("@netlify/blobs")); } catch { /* blobs nie sú k dispozícii */ }

function store() {
  if (!getStore) return null;
  try { return getStore(STORE_NAME); } catch { return null; }
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

module.exports = { saveNews, loadNews };
