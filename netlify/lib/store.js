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

// --- Obmedzenie pokusov (brute force na heslo) ---
// Počítadlo NEÚSPEŠNÝCH pokusov pre kľúč (u nás IP volajúceho) v posuvnom okne.
// Beží cez Blobs, nie cez pamäť procesu — funkcia je bezstavová a Netlify jej
// púšťa viac inštancií naraz, takže lokálne počítadlo by útočník obišiel tým,
// že ho jednoducho trafí inú inštanciu.
//
// Keď Blobs nie sú dostupné (lokálny beh), pokusy NEobmedzujeme — radšej
// funkčný web než zamknutý. Na produkcii Blobs sú.
const RL_WINDOW_MS = 15 * 60 * 1000;
const RL_MAX_FAILURES = 8;

function rlKey(key) {
  return `rl-${String(key || "unknown").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80)}`;
}

async function recentFailures(key) {
  const s = store();
  if (!s) return 0;
  try {
    const rec = await s.get(rlKey(key), { type: "json" });
    if (!rec || !Array.isArray(rec.hits)) return 0;
    return rec.hits.filter((t) => Date.now() - t < RL_WINDOW_MS).length;
  } catch { return 0; }
}

async function recordFailure(key) {
  const s = store();
  if (!s) return;
  try {
    let hits = [];
    try {
      const rec = await s.get(rlKey(key), { type: "json" });
      if (rec && Array.isArray(rec.hits)) hits = rec.hits;
    } catch { /* prvý pokus */ }
    hits = hits.filter((t) => Date.now() - t < RL_WINDOW_MS);
    hits.push(Date.now());
    await s.setJSON(rlKey(key), { hits });
  } catch { /* ignoruj */ }
}

async function clearFailures(key) {
  const s = store();
  if (!s) return;
  try { await s.delete(rlKey(key)); } catch { /* ignoruj */ }
}

// --- Fronta naplánovaných článkov (publikovat.html "Naplánovať zverejnenie") ---
// Hárok nemá koncept budúceho dátumu — čokoľvek doň zapíšeš, je na webe
// okamžite (žiadne zo 7 miest, ktoré hárok čítajú, nefiltruje podľa dátumu).
// Naplánovaný článok preto NEJDE do hárku hneď — čaká tu ako hotový riadok
// (manual-publish.js ho zostaví celý vrátane obrázka) a publish-scheduled.js
// ho každých 5 minút vyzdvihne, keď príde jeho čas. Jeden kľúč, celý zoznam —
// objem je rádovo jednotky/desiatky položiek, netreba per-položkové kľúče.
const SCHEDULED_KEY = "scheduled-articles";

// Chyba čítania MUSÍ vyhodiť — prázdny zoznam by volajúci uložil späť a zmazal celú frontu.
async function loadScheduled() {
  const s = store();
  if (!s) throw new Error("Netlify Blobs nie sú dostupné");
  return (await s.get(SCHEDULED_KEY, { type: "json" })) || [];
}

async function saveScheduled(list) {
  const s = store();
  if (!s) throw new Error("Netlify Blobs nie sú dostupné");
  await s.setJSON(SCHEDULED_KEY, list);
}

module.exports = {
  connect, saveNews, loadNews,
  recentFailures, recordFailure, clearFailures, RL_MAX_FAILURES,
  loadScheduled, saveScheduled,
};
