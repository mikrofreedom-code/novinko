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
import { categoryFor } from '../sections/index.js';
import { topPerSection } from './07-writer.js';
import { sendArticle } from '../_shared/telegram.js';

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
  const category = categoryFor(article.section ?? item.facts?.section ?? 'krypto');
  const row = articleToRow(article, category);
  if (dryRun) return { row, published: false };

  await appendArticleRow(row);
  // Auto-broadcast do Telegramu (non-fatal — ak zlyhá, článok je aj tak zverejnený).
  const tg = await sendArticle(article, row[0]);
  if (tg.error) console.warn(`[12-publisher] ${tg.error}`);
  await advance(item.id, STAGE.output);
  return { row, published: true, telegram: tg.sent ? 'sent' : (tg.skipped || tg.error) };
}

// Koľko článkov maximálne zverejniť za beh (= za hodinu pri hodinovom crone).
const MAX_PER_RUN = Number(process.env.MAX_ARTICLES_PER_RUN ?? 2);

export async function runBatch(limit = 50, { dryRun = false } = {}) {
  if (process.env.MANUAL_APPROVAL === 'true' && !dryRun && process.env.ALLOW_PUBLISH !== 'true') {
    return { skipped: 'publikovanie vypnuté (ALLOW_PUBLISH=true povolí)' };
  }
  const items = await claim(STAGE.input, limit);
  // ŠKRT: zverejni len top N najdôležitejších PER SEKCIA; zvyšok počká v 'imaged'.
  const top = topPerSection(items, MAX_PER_RUN,
    (it) => it.article?.section ?? it.facts?.section,
    (it) => it.article?.importance ?? it.facts?.importance);

  const res = { ok: 0, failed: 0, skipped: Math.max(items.length - top.length, 0) };
  for (const item of top) {
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
