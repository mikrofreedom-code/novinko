// EVENT BUS — implementácia (stage 03). Status machine v Supabase.
// Agenti komunikujú LEN cez toto. claim → práca → advance.
import { createClient } from '@supabase/supabase-js';
// Node < 22 nemá natívny WebSocket; supabase-js ho vyžaduje pri inicializácii
// realtime klienta. Realtime nepoužívame (všetko je REST polling), takže stačí polyfill.
import ws from 'ws';
if (!globalThis.WebSocket) globalThis.WebSocket = ws;
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function claim(status, limit = 10) {
  const { data, error } = await db.from('queue').select('*')
    .eq('status', status).order('created_at', { ascending: true }).limit(limit);
  if (error) throw error;
  return data ?? [];
}
export async function advance(id, status, patch = {}) {
  const { error } = await db.from('queue').update({ status, ...patch }).eq('id', id);
  if (error) throw error;
}
export async function insertRaw(source_id, raw_data) {
  const { error } = await db.from('queue').insert({ source_id, raw_data, status: 'raw' });
  if (error) throw error;
}
export { db };
