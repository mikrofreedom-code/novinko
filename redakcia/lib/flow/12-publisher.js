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
// BEZPEČNOSŤ: pri MANUAL_APPROVAL=true (a ALLOW_PUBLISH != true) Publisher
// NEpublikuje rovno — pošle náhľad do súkromného Telegram chatu (tlačidlá
// ✅/❌) a čaká na ľudské rozhodnutie. Skutočné publikovanie/zamietnutie
// spúšťa netlify/functions/telegram-webhook.js po kliknutí (volá run()
// nižšie, resp. advance(...,'rejected')). Položka zostáva v statuse 'imaged'
// (žiadna zmena DB schémy) — značka raw_data.approval_requested bráni
// opätovnému odoslaniu tej istej žiadosti pri ďalšom cron behu.
// ============================================================

import { claim, advance } from '../_shared/queue.js';
import { articleToRow, appendArticleRow } from '../_shared/sheets.js';
import { categoryFor } from '../sections/index.js';
import { topPerSection } from './07-writer.js';
import { sendArticle, sendApprovalRequest } from '../_shared/telegram.js';

export const STAGE = {
  index: 12,
  name: "Publisher",
  input: "imaged",
  output: "published",
};

const AGENT = '12-publisher';

// Skutočné publikovanie jednej položky. Volá to buď runBatch (auto režim),
// alebo telegram-webhook.js priamo (po ručnom schválení tlačidlom).
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

// Pošli náhľad na ručné schválenie namiesto publikovania. Necháva item v
// 'imaged', len si poznačí, že už čaká (nech ho ďalší beh znova nenavrhne).
async function requestApproval(item) {
  const article = item.article;
  if (!article || !article.headline || !article.body) {
    throw new Error('item.article chýba headline/body');
  }
  const sent = await sendApprovalRequest(item.id, article);
  if (sent.skipped || sent.error || !sent.message_id) throw new Error(sent.skipped || sent.error || 'telegram schválenie: neznáma chyba');
  await advance(item.id, STAGE.input, {
    raw_data: {
      ...item.raw_data,
      approval_requested: true,
      approval_message_id: sent.message_id,
      approval_chat_id: sent.chat_id,
      approval_requested_at: new Date().toISOString(),
    },
  });
}

// Koľko článkov maximálne zverejniť/navrhnúť za beh (= za hodinu pri hodinovom crone).
const MAX_PER_RUN = Number(process.env.MAX_ARTICLES_PER_RUN ?? 2);

// ---- EXPIRÁCIA ČAKAJÚCICH ČLÁNKOV ----
// Spravodajstvo sa kazí: článok, ktorý týždeň visí bez rozhodnutia, sa nesmie
// dať zverejniť — vyzeral by ako dnešná správa. Reálny prípad (31.7.2026): vo
// fronte stále čakal recap z 24.7. s titulkom „Krypto trh DNES oslaboval".
// Denný prehľad je snímka jedného dňa (krátka trvanlivosť), bežná správa
// (oznámenie, regulácia) starne pomalšie.
const RECAP_MAX_AGE_H = Number(process.env.RECAP_MAX_AGE_H ?? 14);
const PENDING_MAX_AGE_H = Number(process.env.PENDING_MAX_AGE_H ?? 72);

function jeExpirovany(item, now) {
  const zaklad = item.raw_data?.approval_requested_at ?? item.updated_at ?? item.created_at;
  if (!zaklad) return false;
  const isRecap = item.article?.kind === 'market_recap' || item.raw_data?._src === 'market_recap';
  const limit = isRecap ? RECAP_MAX_AGE_H : PENDING_MAX_AGE_H;
  const vekH = (now - new Date(zaklad).getTime()) / 3600000;
  return vekH > limit ? { vekH: Math.round(vekH), limit } : false;
}

export async function runBatch(limit = 50, { dryRun = false } = {}) {
  const manualApproval = process.env.MANUAL_APPROVAL === 'true';
  const allowPublish = process.env.ALLOW_PUBLISH === 'true';

  const claimed = await claim(STAGE.input, limit);

  // Najprv vyhoď to, čo sa už skazilo — nech to neblokuje ani nezvádza ku kliku.
  // Týka sa aj položiek s odoslanou žiadosťou: starý klik na ✅ potom neurobí nic,
  // lebo telegram-webhook.js koná len nad stavom 'imaged'.
  const now = Date.now();
  const zive = [];
  let expired = 0;
  for (const item of claimed) {
    const exp = jeExpirovany(item, now);
    if (!exp) { zive.push(item); continue; }
    if (!dryRun) {
      await advance(item.id, 'rejected', {
        error: `${AGENT}: expirované — čakalo ${exp.vekH} h bez rozhodnutia (limit ${exp.limit} h), obsah je už neaktuálny`,
      });
    }
    expired++;
  }

  // Položky, čo už čakajú na ľudské rozhodnutie v Telegrame — nechaj tak, neponúkaj znova.
  const items = zive.filter((it) => !it.raw_data?.approval_requested);

  // ŠKRT: zverejni/navrhni len top N najdôležitejších PER SEKCIA; zvyšok počká v 'imaged'.
  const top = topPerSection(items, MAX_PER_RUN,
    (it) => it.article?.section ?? it.facts?.section,
    (it) => it.article?.importance ?? it.facts?.importance);

  const res = { ok: 0, failed: 0, expirovane: expired, skipped: Math.max(items.length - top.length, 0) };
  for (const item of top) {
    try {
      if (manualApproval && !allowPublish && !dryRun) {
        await requestApproval(item);
      } else {
        await run(item, { dryRun });
      }
      res.ok++;
    } catch (err) {
      res.failed++;
      if (!dryRun) await advance(item.id, 'error', { error: `${AGENT}: ${err.message}` });
    }
  }
  return res;
}
