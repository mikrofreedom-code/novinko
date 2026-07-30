// RETRY ENGINE — dočasné chyby (preťaženie AI, sieť) nestrácaj.
// Položky v stave 'error' s DOČASNE vyzerajúcou chybou vráti späť do ich
// vstupného stavu, nech ich ďalší beh skúsi znova. Permanentné chyby
// (validácia, zlý formát) necháva tak. Počet pokusov je obmedzený.

import { db } from './queue.js';

const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 3);

// Agent → jeho vstupný stav (kam vrátiť na re-spracovanie).
const INPUT_STATUS = {
  '02-event-gateway': 'raw',
  '04-collector': 'filtered',
  '05-verification': 'collected',
  '06-chief-editor': 'facts_ready',
  '07-writer': 'clustered',
};

// Dočasné chyby (oplatí sa skúsiť znova). Budget guard ZÁMERNE nie je dočasný.
const TRANSIENT = /(overloaded|rate.?limit|429|529|503|502|500|timeout|etimedout|econnreset|fetch failed|network|socket|reset by peer)/i;

export async function retryTransientErrors(limit = 200) {
  const { data, error } = await db.from('queue')
    .select('id, error, raw_data').eq('status', 'error').limit(limit);
  if (error) throw error;

  const res = { reset: 0, gaveUp: 0, skipped: 0 };
  for (const item of data ?? []) {
    const err = item.error ?? '';
    const agent = err.split(':')[0]?.trim();
    const input = INPUT_STATUS[agent];

    // Preskoč: neznámy agent, permanentná chyba, alebo budget guard.
    if (!input || /budget/i.test(err) || !TRANSIENT.test(err)) { res.skipped++; continue; }

    const retries = (item.raw_data?._retry ?? 0) + 1;
    if (retries > MAX_RETRIES) { res.gaveUp++; continue; } // vzdaj sa (ostáva error)

    await db.from('queue').update({
      status: input, error: null,
      raw_data: { ...item.raw_data, _retry: retries },
    }).eq('id', item.id);
    res.reset++;
  }
  return res;
}
