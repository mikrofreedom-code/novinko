// Prístup k fronte projektu novinko-redakcia.
//
// HISTÓRIA: do 28. 8. 2026 to bol SAMOSTATNÝ Supabase projekt, iný než
// SUPABASE_URL/SUPABASE_SERVICE_KEY — tie patrili staršiemu projektu, ktorý
// držal len úložisko obrázkov. Ten projekt bol zrušený a bucket presunutý sem,
// takže obe dvojice premenných dnes ukazujú na to isté miesto.
//
// .env (Netlify, site-level — zdieľané s novinko-redakcia):
//   REDAKCIA_SUPABASE_URL=<URL Supabase projektu redakcie>
//   REDAKCIA_SUPABASE_SERVICE_KEY=<service role kľúč>
// Konkrétne hodnoty ZÁMERNE nie sú v kóde: tento súbor sa balí do funkcie
// telegram-webhook a Netlify skener tajomstiev zhodu s hodnotou premennej
// vyhodnotí ako únik a zhodí build.
const { createClient } = require("@supabase/supabase-js");
// Node < 22 nemá natívny WebSocket; supabase-js ho vyžaduje pri inicializácii
// realtime klienta (aj keď realtime nepoužívame — je to len import-time check).
const ws = require("ws");
if (!globalThis.WebSocket) globalThis.WebSocket = ws;

// Od 28. 8. 2026 je to ten istý projekt ako úložisko obrázkov — config preto
// uprednostní REDAKCIA_*, a keď chýba, prepadne na SUPABASE_*.
const { REDAKCIA_URL, REDAKCIA_KEY } = require("./config");

let _client = null;
function db() {
  if (_client) return _client;
  if (!REDAKCIA_URL || !REDAKCIA_KEY) {
    throw new Error("chýba REDAKCIA_SUPABASE_URL/REDAKCIA_SUPABASE_SERVICE_KEY ani SUPABASE_URL/SUPABASE_SERVICE_KEY");
  }
  _client = createClient(REDAKCIA_URL, REDAKCIA_KEY);
  return _client;
}

async function getQueueItem(id) {
  const { data, error } = await db().from("queue").select("*").eq("id", id).single();
  if (error) throw new Error(error.message);
  return data;
}

async function advanceQueueItem(id, status, patch = {}) {
  const { error } = await db().from("queue").update({ status, ...patch }).eq("id", id);
  if (error) throw new Error(error.message);
}

// Zápis prejde, len ak sa riadok od prečítania nezmenil (porovnanie updated_at).
// Z dvoch súbežných zápisov nad tým istým prečítaním teda uspeje najviac jeden.
async function updateIfUnchanged(item, patch) {
  const { data, error } = await db().from("queue")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", item.id).eq("updated_at", item.updated_at)
    .select("id");
  if (error) throw new Error(error.message);
  return data.length === 1;
}

module.exports = { getQueueItem, advanceQueueItem, updateIfUnchanged };
