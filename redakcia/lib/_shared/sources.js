// SOURCE DATABASE — profily zdrojov (trust score, vrstva, je_primárny).
import { db } from './queue.js';
export async function activeSources(layer) {
  let q = db.from('sources').select('*').eq('is_active', true);
  if (layer) q = q.eq('layer', layer);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
