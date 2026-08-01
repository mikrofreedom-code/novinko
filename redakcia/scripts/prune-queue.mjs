// ČISTENIE FRONTY — maže staré položky v TERMINÁLNYCH stavoch.
//
//   node --env-file=.env scripts/prune-queue.mjs           # len ukáž, čo by zmazal
//   node --env-file=.env scripts/prune-queue.mjs --apply   # naozaj zmaž
//
// PREČO: 01-scout vkladá pri každom behu ~200 riadkov (CoinGecko 100 + DefiLlama
// 100), z ktorých 02-gateway drvivú väčšinu hneď zamietne. Za mesiac to narástlo
// na 166 000 riadkov v stave 'rejected'. Nič ich nikdy nemazalo.
//
// ČO SA NEMAŽE NIKDY:
//   - 'published'  — záznam o tom, čo reálne šlo von (audit stopa)
//   - všetko neterminálne (raw, filtered, collected, facts_ready, clustered,
//     written, proofed, legal_ok, imaged) — to je rozpracovaná práca
//
// ⚠️ VÄZBA NA DEDUPLIKÁCIU (nezmazať si nohy pod sebou):
// 01-scout.insertFeedRows() kontroluje `dedup_key` proti CELEJ tabuľke, bez
// ohľadu na stav — teda aj proti zamietnutým riadkom. Keby sme zmazali riadok
// položky, ktorú feed stále ponúka, scout ju vloží znova.
// Poistkou je 02-gateway: položky staršie než FEED_MAX_AGE_DAYS zamietne ako
// staré. Retencia preto MUSÍ byť dlhšia než FEED_MAX_AGE_DAYS — odvodzuje sa
// od nej automaticky, nech sa väzba nerozíde, keď niekto zmení jednu z hodnôt.

import { db } from '../lib/_shared/queue.js';

const FEED_MAX_AGE_DAYS = Number(process.env.FEED_MAX_AGE_DAYS ?? 14);
// +7 dní rezerva nad prahom brány; minimum 21 dní. Dá sa prebiť explicitne.
const RETENTION_DAYS = Number(
  process.env.QUEUE_RETENTION_DAYS ?? Math.max(FEED_MAX_AGE_DAYS + 7, 21),
);
const PRUNE_STATUSES = ['rejected', 'merged', 'error'];
// 200, nie viac: id-čka idú do URL ako ?id=in.(...) a PostgREST má strop na
// dĺžku URL. Pri 1000 UUID (~37 kB) vracia "Bad Request"; 200 (~7 kB) prejde.
const BATCH = 200;

export async function pruneQueue({ apply = false } = {}) {
  if (RETENTION_DAYS <= FEED_MAX_AGE_DAYS) {
    throw new Error(
      `QUEUE_RETENTION_DAYS (${RETENTION_DAYS}) musí byť väčšie než FEED_MAX_AGE_DAYS `
      + `(${FEED_MAX_AGE_DAYS}) — inak by scout začal znova vkladať staré položky z feedov`,
    );
  }

  const hranica = new Date(Date.now() - RETENTION_DAYS * 864e5).toISOString();
  const res = { retentionDays: RETENTION_DAYS, hranica: hranica.slice(0, 10), zmazane: {}, spolu: 0 };

  for (const status of PRUNE_STATUSES) {
    const { count } = await db.from('queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', status).lt('created_at', hranica);
    res.zmazane[status] = count ?? 0;
    res.spolu += count ?? 0;

    if (!apply || !count) continue;

    // Po dávkach — jeden veľký DELETE by narazil na timeout.
    let zostava = count;
    while (zostava > 0) {
      const { data: davka } = await db.from('queue')
        .select('id').eq('status', status).lt('created_at', hranica).limit(BATCH);
      if (!davka?.length) break;
      const ids = davka.map((r) => r.id);

      // ai_cost_log a audit_log ukazujú na queue.id cudzím kľúčom, takže bez
      // tohto kroku by DELETE zlyhal. Tie riadky ale NEMAŽEME — záznam o tom,
      // koľko nás čo stálo, je finančná história a prežije svoju položku vo
      // fronte. Stačí odkaz odpojiť (queue_id → NULL).
      for (const tabulka of ['ai_cost_log', 'audit_log']) {
        const { error: e } = await db.from(tabulka).update({ queue_id: null }).in('queue_id', ids);
        if (e) throw new Error(`odpojenie ${tabulka}: ${e.message}`);
      }

      const { error } = await db.from('queue').delete().in('id', ids);
      if (error) throw new Error(`mazanie ${status}: ${error.message}`);
      zostava -= davka.length;
      // Priebeh len v termináli. Pod cronom ide výstup do logu, kde by
      // 430 riadkov „zostáva…" prekrylo všetko ostatné.
      if (process.stdout.isTTY) process.stdout.write(`\r   ${status}: zostáva ${Math.max(zostava, 0)}   `);
    }
    if (process.stdout.isTTY) process.stdout.write('\r');
  }
  return res;
}

// ── NÁHROBKY: zahoď OBSAH zamietnutých položiek, riadok nechaj ──
//
// Zamietnutá položka si drží celý text zdroja, hoci ho už nikto nikdy
// nepoužije — a to je ~99 % jej objemu. Mažeme teda obsah hneď, nie až po
// 21 dňoch retencie.
//
// NEMAŽEME CELÝ RIADOK a nemažeme ani `dedup_key`: insertFeedRows() ho
// kontroluje proti celej tabuľke bez ohľadu na stav (viď varovanie hore).
// Keby kľúč zmizol, scout tú istú správu vloží znova, kým je vo feede — a
// extrakcia by sa zaplatila druhýkrát. Náhrobok teda musí kľúč prežiť.
const TOMBSTONE_STATUSES = ['rejected', 'merged'];
const TOMBSTONE_BATCH = Number(process.env.TOMBSTONE_BATCH ?? 500);

export async function stripRejectedPayload({ apply = false } = {}) {
  const res = { najdene: 0, ocistene: 0 };

  for (const status of TOMBSTONE_STATUSES) {
    // Len tie, čo ešte obsah majú (title je spoľahlivý indikátor — náhrobok ho nemá).
    const { data: davka, error } = await db.from('queue')
      .select('id, raw_data')
      .eq('status', status)
      .not('raw_data->>title', 'is', null)
      .limit(TOMBSTONE_BATCH);
    if (error) throw new Error(`náhrobky ${status}: ${error.message}`);
    if (!davka?.length) continue;

    res.najdene += davka.length;
    if (!apply) continue;

    for (const row of davka) {
      const rd = row.raw_data ?? {};
      const nahrobok = { _tombstone: true };
      // Zachovaj VÝHRADNE to, na čom stojí dedup a dohľadateľnosť.
      if (rd.dedup_key) nahrobok.dedup_key = rd.dedup_key;
      if (rd._src) nahrobok._src = rd._src;
      if (rd.source_url) nahrobok.source_url = rd.source_url;

      const { error: e } = await db.from('queue')
        .update({ raw_data: nahrobok }).eq('id', row.id);
      if (e) throw new Error(`náhrobok ${row.id}: ${e.message}`);
      res.ocistene++;
    }
  }
  return res;
}

// Spustené priamo z terminálu (nie importom z pipeline).
if (import.meta.url === `file://${process.argv[1]}`) {
  const apply = process.argv.includes('--apply');
  const { count: pred } = await db.from('queue').select('*', { count: 'exact', head: true });
  const r = await pruneQueue({ apply });
  console.log(`\nretencia: ${r.retentionDays} dní (mazané staršie než ${r.hranica})`);
  for (const [s, n] of Object.entries(r.zmazane)) console.log(`  ${s.padEnd(10)} ${String(n).padStart(7)}`);
  console.log(`  ${'SPOLU'.padEnd(10)} ${String(r.spolu).padStart(7)}`);
  if (apply) {
    const { count: po } = await db.from('queue').select('*', { count: 'exact', head: true });
    console.log(`\ntabuľka queue: ${pred} → ${po} riadkov`);
  } else {
    console.log('\n(len náhľad — spusti s --apply, ak to má naozaj zmazať)');
  }
  process.exit(0);
}
