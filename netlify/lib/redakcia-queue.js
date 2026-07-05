// Prístup k fronte projektu novinko-redakcia (SAMOSTATNÝ Supabase projekt,
// iný než SUPABASE_URL/SUPABASE_SERVICE_KEY vyššie — tie patria tomuto,
// staršiemu projektu a používajú sa len na úložisko obrázkov).
//
// .env (Netlify, site-level — zdieľané s novinko-redakcia):
//   REDAKCIA_SUPABASE_URL=https://kypwhjpedbtodehrviub.supabase.co
//   REDAKCIA_SUPABASE_SERVICE_KEY=...
const { createClient } = require("@supabase/supabase-js");
// Node < 22 nemá natívny WebSocket; supabase-js ho vyžaduje pri inicializácii
// realtime klienta (aj keď realtime nepoužívame — je to len import-time check).
const ws = require("ws");
if (!globalThis.WebSocket) globalThis.WebSocket = ws;

let _client = null;
function db() {
  if (_client) return _client;
  const url = process.env.REDAKCIA_SUPABASE_URL;
  const key = process.env.REDAKCIA_SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("chýba REDAKCIA_SUPABASE_URL/REDAKCIA_SUPABASE_SERVICE_KEY");
  _client = createClient(url, key);
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

module.exports = { getQueueItem, advanceQueueItem };
