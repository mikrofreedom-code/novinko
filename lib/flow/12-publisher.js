// ============================================================
// 12. Publisher
// ------------------------------------------------------------
// ROLA:          Zverejní hotový článok — zapíše ho do Google Sheetu existujúceho
//                Novinko (živá stránka), kategória "krypto". Stránka ho zobrazí.
// VSTUP status:  imaged    (po 11-image; 08-10 sú stuby, preskakujú sa)
// VÝSTUP status: published
// STAV:          🟢 MVP — napojené na živú stránku (novinko-clean)
// AI vrstva:     0 žiadna
// ------------------------------------------------------------
// BEZPEČNOSŤ: pri MANUAL_APPROVAL=true Publisher NEbeží automaticky v cron —
// spúšťa sa len ručne/cielene (ALLOW_PUBLISH=true). Zápis ide do PRODUKČNÉHO hárku.
// ============================================================

import { claim, advance } from '../_shared/queue.js';
import { articleToRow, appendArticleRow } from '../_shared/sheets.js';

export const STAGE = {
  index: 12,
  name: "Publisher",
  input: "imaged",
  output: "published",
};

const AGENT = '12-publisher';

export async function run(item, { dryRun = false } = {}) {
  const article = item.article;
  if (!article || !article.headline || !article.body) {
    throw new Error('item.article chýba headline/body');
  }
  const row = articleToRow(article);
  if (dryRun) return { row, published: false };

  await appendArticleRow(row);
  await advance(item.id, STAGE.output);
  return { row, published: true };
}

export async function runBatch(limit = 10, { dryRun = false } = {}) {
  if (process.env.MANUAL_APPROVAL === 'true' && !dryRun && process.env.ALLOW_PUBLISH !== 'true') {
    return { skipped: 'MANUAL_APPROVAL=true — publikovanie vypnuté (ALLOW_PUBLISH=true povolí)' };
  }
  const items = await claim(STAGE.input, limit);
  const res = { ok: 0, failed: 0 };
  for (const item of items) {
    try {
      await run(item, { dryRun });
      res.ok++;
    } catch (err) {
      res.failed++;
      if (!dryRun) await advance(item.id, 'error', { error: `${AGENT}: ${err.message}` });
    }
  }
  return res;
}
