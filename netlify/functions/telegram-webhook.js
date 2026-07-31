// Webhook pre Telegram schvaľovacie tlačidlá (✅ Publikovať / ❌ Zamietnuť).
// Patrí k novinko-redakcia pipeline (lib/flow/12-publisher.js posiela žiadosť
// o schválenie cez sendApprovalRequest), ALE beží TU — v novinko-clean —
// lebo toto je repo, čo sa reálne nasadzuje cez git push. novinko-redakcia
// má vlastný (nefunkčný) Netlify setup, viac v PLAN.txt / CLAUDE.md tamtoho repa.
//
// Registrácia (jednorazovo, po deployi): pozri scripts/telegram-set-webhook
// v novinko-redakcia. Bezpečnosť: Telegram posiela secret_token v hlavičke,
// porovnávame s TELEGRAM_WEBHOOK_SECRET (site-level env, zdieľané oboma repo).

const { getQueueItem, advanceQueueItem } = require("../lib/redakcia-queue");
const { callBotApi, sendArticle, esc } = require("../lib/telegram");
const { appendRow } = require("../lib/sheets");
const { articleToRow } = require("../lib/article-row");

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

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

exports.handler = async (event) => {
  const headers = event.headers || {};
  const headerSecret = headers["x-telegram-bot-api-secret-token"] || headers["X-Telegram-Bot-Api-Secret-Token"];
  if (WEBHOOK_SECRET && headerSecret !== WEBHOOK_SECRET) {
    return { statusCode: 403, body: "forbidden" };
  }

  let update;
  try { update = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, body: "bad request" }; }

  const cq = update.callback_query;
  if (!cq || !cq.data) return { statusCode: 200, body: "ok" }; // iný typ update — ignoruj

  const [action, itemId] = cq.data.split(":");
  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;

  try {
    const item = await getQueueItem(itemId);
    if (!item) {
      await callBotApi("answerCallbackQuery", { callback_query_id: cq.id, text: "Položka sa nenašla (už spracovaná?)", show_alert: true });
      return { statusCode: 200, body: "ok" };
    }

    // POISTKA: konať smieme LEN nad položkou, ktorá stále čaká na rozhodnutie.
    // Bez tejto kontroly by druhý klik na ✅ zapísal článok do hárku DRUHÝKRÁT
    // a klik na starú správu by zverejnil aj to, čo medzitým niekto zamietol
    // (napr. hromadné zrušenie cenových článkov 31.7.2026).
    if (item.status !== "imaged") {
      const popis = { published: "už je zverejnené", rejected: "medzitým zamietnuté", error: "skončilo s chybou" }[item.status] || `stav: ${item.status}`;
      await callBotApi("answerCallbackQuery", { callback_query_id: cq.id, text: `Nič sa nestalo — ${popis}.`, show_alert: true });
      await markDecided(item, chatId, messageId, `⏸️ NEAKTUÁLNE (${popis})`);
      return { statusCode: 200, body: "ok" };
    }

    if (action === "approve") {
      const article = item.article;
      if (!article || !article.headline || !article.body) throw new Error("item.article chýba headline/body");
      const category = article.section || item.facts?.section || "krypto";
      const row = articleToRow(article, category);
      await appendRow(process.env.GOOGLE_SHEETS_ID, row, process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      await sendArticle({ title: article.headline, perex: article.perex, imageUrl: article.image_url, sheetId: row[0] });
      await advanceQueueItem(item.id, "published");
      await callBotApi("answerCallbackQuery", { callback_query_id: cq.id, text: "✅ Publikované" });
      await markDecided(item, chatId, messageId, "✅ PUBLIKOVANÉ");
    } else if (action === "reject") {
      await advanceQueueItem(item.id, "rejected", { error: "12-publisher: zamietnuté ručne cez Telegram" });
      await callBotApi("answerCallbackQuery", { callback_query_id: cq.id, text: "❌ Zamietnuté" });
      await markDecided(item, chatId, messageId, "❌ ZAMIETNUTÉ");
    } else {
      await callBotApi("answerCallbackQuery", { callback_query_id: cq.id });
    }
  } catch (e) {
    await callBotApi("answerCallbackQuery", { callback_query_id: cq.id, text: `Chyba: ${e.message}`.slice(0, 200), show_alert: true });
  }

  return { statusCode: 200, body: "ok" };
};
