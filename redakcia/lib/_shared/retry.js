// RETRY ENGINE — dočasné chyby (preťaženie AI, sieť) nestrácaj.
// Položky v stave 'error' s DOČASNE vyzerajúcou chybou vráti späť do ich
// vstupného stavu, nech ich ďalší beh skúsi znova. Permanentné chyby
// (validácia, zlý formát) necháva tak. Počet pokusov je obmedzený.

import { db } from './queue.js';
import { todaySpendUsd, allowanceUsd } from './cost.js';

const MAX_RETRIES = Number(process.env.MAX_RETRIES ?? 3);

// Agent → jeho vstupný stav (kam vrátiť na re-spracovanie).
const INPUT_STATUS = {
  '02-event-gateway': 'raw',
  '04-collector': 'filtered',
  '05-verification': 'collected',
  '06-chief-editor': 'facts_ready',
  '07-writer': 'clustered',
  '08-proofreader': 'written',
  '09-legal': 'proofed',
  '11-image': 'legal_ok',
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

    if (!input) { res.skipped++; continue; }

    // BUDGET GUARD — vlastná kategória, ani dočasná ani trvalá.
    //
    // Dovtedy platil za TRVALÝ, takže položka zostala v 'error' NAVŽDY — aj po
    // polnoci, keď je rozpočet zase voľný. Deň, v ktorom sa strop dosiahol, tak
    // nenávratne zožral všetko, čo ešte čakalo v rade. Pri nízkom strope (a ten
    // je zmyslom poistky) by sa to dialo pravidelne.
    //
    // Vraciame ju späť, len čo je dnešný náklad zase pod stropom. Kým je nad
    // ním, necháme ju čakať — opakovať teraz by znamenalo znova naraziť.
    // NErátame to ako pokus: položka za minutý rozpočet nemôže a nesmie kvôli
    // nemu spáliť svoje tri pokusy na skutočné chyby.
    //
    // POROVNÁVAME S PRIEBEŽNÝM STROPOM, nie s denným — presne tým istým, aký
    // použil ai-gateway pri odmietnutí. S denným by tu platilo „$0.30 < $0.80,
    // vráť do hry", položka by v tom istom behu zase narazila na priebežný strop
    // a takto by lietala tam a späť každú hodinu.
    if (/budget/i.test(err)) {
      if (await todaySpendUsd() >= allowanceUsd()) { res.skipped++; continue; }
      await db.from('queue').update({ status: input, error: null }).eq('id', item.id);
      res.reset++;
      continue;
    }

    if (!TRANSIENT.test(err)) { res.skipped++; continue; }

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
