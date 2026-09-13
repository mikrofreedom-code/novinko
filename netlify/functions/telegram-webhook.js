// Webhook pre Telegram schvaľovacie tlačidlá (✅ Publikovať / ❌ Zamietnuť).
// Patrí k novinko-redakcia pipeline (lib/flow/12-publisher.js posiela žiadosť
// o schválenie cez sendApprovalRequest), ALE beží TU — v novinko-clean —
// lebo toto je repo, čo sa reálne nasadzuje cez git push. novinko-redakcia
// má vlastný (nefunkčný) Netlify setup, viac v PLAN.txt / CLAUDE.md tamtoho repa.
//
// Registrácia (jednorazovo, po deployi): pozri scripts/telegram-set-webhook
// v novinko-redakcia. Bezpečnosť: Telegram posiela secret_token v hlavičke,
// porovnávame s TELEGRAM_WEBHOOK_SECRET (site-level env, zdieľané oboma repo).

const { getQueueItem, advanceQueueItem, updateIfUnchanged } = require("../lib/redakcia-queue");
const { callBotApi, sendArticle, esc } = require("../lib/telegram");
const { appendRow, sheetRowIds } = require("../lib/sheets");
const { articleToRow } = require("../lib/article-row");
const { safeEqual } = require("../lib/guard");

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
// Prevzatie staršie než toto sa berie ako prerušené a smie sa zopakovať.
const CLAIM_STALE_MS = 2 * 60 * 1000;

async function markDecided(item, chatId, messageId, label) {
  const hasImg = typeof item.article?.image_url === "string" && item.article.image_url.startsWith("http");
  const headline = esc(item.article?.headline || "");
  const clearButtons = { inline_keyboard: [] };
  const text = `${label}\n\n${headline}`;
  if (hasImg) {
    await callBotApi("editMessageCaption", { chat_id: chatId, message_id: messageId, caption: text, parse_mode: "HTML", reply_markup: clearButtons });
  } else {
    await callBotApi("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", reply_markup: clearButtons });
  }
}

function answer(cq, text, show_alert = true) {
  return callBotApi("answerCallbackQuery", { callback_query_id: cq.id, text, show_alert });
}

async function isInSheet(rowId) {
  const ids = await sheetRowIds(process.env.GOOGLE_SHEETS_ID, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  return ids.has(rowId);
}

exports.handler = async (event) => {
  // Zlyháva ZATVORENE: bez nastaveného TELEGRAM_WEBHOOK_SECRET neprejde nikto.
  // Predtým tu bolo `if (WEBHOOK_SECRET && headerSecret !== WEBHOOK_SECRET)` —
  // teda keby premenná na Netlify chýbala alebo bola prázdna (preklep, nový
  // deploy, obnova prostredia), kontrola sa preskočila CELÁ a hocikto mohol
  // poslať callback_query a publikovať či zamietať články.
  if (!WEBHOOK_SECRET) {
    console.error("[telegram-webhook] TELEGRAM_WEBHOOK_SECRET nie je nastavený — odmietam všetko.");
    return { statusCode: 503, body: "webhook nie je nakonfigurovaný" };
  }
  const headers = event.headers || {};
  const headerSecret = headers["x-telegram-bot-api-secret-token"] || headers["X-Telegram-Bot-Api-Secret-Token"];
  if (!safeEqual(headerSecret, WEBHOOK_SECRET)) {
    return { statusCode: 403, body: "forbidden" };
  }

  let update;
  try { update = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, body: "bad request" }; }

  const cq = update.callback_query;
  if (!cq || !cq.data) return { statusCode: 200, body: "ok" }; // iný typ update — ignoruj

  const [action, itemId] = cq.data.split(":");
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  let claimed = false;

  try {
    const item = await getQueueItem(itemId);
    if (!item) {
      await answer(cq, "Položka sa nenašla (už spracovaná?)");
      return { statusCode: 200, body: "ok" };
    }

    // POISTKA: konať smieme LEN nad položkou, ktorá stále čaká na rozhodnutie.
    // Klik na starú správu by inak zverejnil aj to, čo medzitým niekto zamietol
    // (napr. hromadné zrušenie cenových článkov 31.7.2026).
    if (item.status !== "imaged") {
      const popis = { published: "už je zverejnené", rejected: "medzitým zamietnuté", error: "skončilo s chybou" }[item.status] || `stav: ${item.status}`;
      await answer(cq, `Nič sa nestalo — ${popis}.`);
      await markDecided(item, chatId, messageId, `⏸️ NEAKTUÁLNE (${popis})`);
      return { statusCode: 200, body: "ok" };
    }

    // Kontrola stavu vyššie sama nestačí: dva súbežné kliky (alebo Telegram, ktorý
    // pri pomalej odpovedi doručí udalosť znova) ju prejdú oba. Rozhoduje až
    // podmienený zápis značky publish_claim — ten prejde len jednému.
    const claim = item.raw_data?.publish_claim;
    if (claim && Date.now() - Date.parse(claim.at) < CLAIM_STALE_MS) {
      await answer(cq, "Práve sa publikuje — o chvíľu skontroluj web.");
      return { statusCode: 200, body: "ok" };
    }

    if (action === "approve") {
      const article = item.article;
      if (!article || !article.headline || !article.body) throw new Error("item.article chýba headline/body");
      const category = article.section || item.facts?.section || "krypto";
      const row = articleToRow(article, category);
      // Opakovanie po prerušení nesie rovnaké ID, podľa neho sa pozná, či už je riadok v hárku.
      if (claim?.sheet_row_id) row[0] = claim.sheet_row_id;

      claimed = await updateIfUnchanged(item, {
        raw_data: { ...item.raw_data, publish_claim: { at: new Date().toISOString(), sheet_row_id: row[0] } },
      });
      if (!claimed) {
        await answer(cq, "Nič sa nestalo — položku práve spracúva iný klik.");
        return { statusCode: 200, body: "ok" };
      }

      if (!(claim && await isInSheet(row[0]))) {
        await appendRow(process.env.GOOGLE_SHEETS_ID, row, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        await sendArticle({ title: article.headline, perex: article.perex, imageUrl: article.image_url, sheetId: row[0] });
      }
      await advanceQueueItem(item.id, "published");
      await answer(cq, "✅ Publikované", false);
      await markDecided(item, chatId, messageId, "✅ PUBLIKOVANÉ");
    } else if (action === "reject") {
      // Prerušené publikovanie mohlo článok do hárku už zapísať — ten sa tu zamietnuť nedá.
      if (claim?.sheet_row_id && await isInSheet(claim.sheet_row_id)) {
        await advanceQueueItem(item.id, "published");
        await answer(cq, "Článok už je na webe (prerušené publikovanie sa stihlo zapísať), zamietnuť ho tu nejde.");
        await markDecided(item, chatId, messageId, "✅ PUBLIKOVANÉ");
        return { statusCode: 200, body: "ok" };
      }
      const ok = await updateIfUnchanged(item, { status: "rejected", error: "12-publisher: zamietnuté ručne cez Telegram" });
      if (!ok) {
        await answer(cq, "Nič sa nestalo — položka sa medzitým zmenila.");
        return { statusCode: 200, body: "ok" };
      }
      await answer(cq, "❌ Zamietnuté", false);
      await markDecided(item, chatId, messageId, "❌ ZAMIETNUTÉ");
    } else {
      await callBotApi("answerCallbackQuery", { callback_query_id: cq.id });
    }
  } catch (e) {
    const rada = claimed ? " — skús ✅ znova o 2 min" : "";
    await answer(cq, `Chyba: ${e.message}`.slice(0, 170) + rada);
  }

  return { statusCode: 200, body: "ok" };
};
