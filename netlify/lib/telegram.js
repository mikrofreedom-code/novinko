// TELEGRAM — pošle vygenerovaný článok do kanála/chatu (Bot API).
// Odchádzajúce volanie, no-op ak chýba token/chat (nezhodí generovanie).
// Rovnaký bot a chat ako v novinko-redakcia (lib/_shared/telegram.js).
const { httpsPost } = require("./net");
const { slugify } = require("./clanok-render");

const SITE_URL = process.env.SITE_URL || "https://novinko.sk";

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildCaption(title, perex, url) {
  const p = perex ? esc(perex).slice(0, 600) : "";
  return `<b>${esc(title)}</b>\n\n` + (p ? `${p}\n\n` : "") + `📖 <a href="${url}">Čítať celý článok</a>`;
}

// sheetId: hodnota stĺpca A (id riadku) → verejná URL článku.
async function sendArticle({ title, perex, imageUrl, sheetId }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { skipped: "telegram nenastavený (chýba TELEGRAM_BOT_TOKEN/CHAT_ID)" };
  if (!title) return { skipped: "bez titulku" };

  // POZOR (nájdené 12. 9.): predtým tu bolo /clanok.html?id=... — tú stránku
  // skladá až JavaScript v prehliadači, takže Facebook/Twitter/akýkoľvek
  // crawler (nespúšťa JS) videl len prázdnu hlavičku bez og:image/og:title.
  // Presne preto sa pri zdieľaní na Facebooku nezobrazoval obrázok článku.
  // /clanok/<slug>-<id> je funkcia (netlify/functions/clanok.js), ktorá
  // vracia hotové HTML s og: značkami hneď — slugify() musí byť IDENTICKÁ
  // s tou v netlify/lib/sheets.js (fetchSheetItems), inak by sa URL rozišli.
  const url = `${SITE_URL}/clanok/${slugify(title)}-${encodeURIComponent(sheetId)}`;
  const caption = buildCaption(title, perex, url);
  const hasImg = typeof imageUrl === "string" && imageUrl.startsWith("http");

  try {
    const method = hasImg ? "sendPhoto" : "sendMessage";
    const body = hasImg
      ? { chat_id: chat, photo: imageUrl, caption, parse_mode: "HTML" }
      : { chat_id: chat, text: caption, parse_mode: "HTML" };
    const res = await httpsPost("api.telegram.org", `/bot${token}/${method}`, body, {
      "Content-Type": "application/json",
    });
    if (!res || res.ok !== true) return { error: `telegram: ${res?.description || "neznáma chyba"}` };
    return { sent: true };
  } catch (e) {
    return { error: `telegram: ${e.message}` };
  }
}

// Generické volanie ľubovoľnej Bot API metódy (pre schvaľovacie tlačidlá).
async function callBotApi(method, body) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { skipped: "chýba TELEGRAM_BOT_TOKEN" };
  try {
    const res = await httpsPost("api.telegram.org", `/bot${token}/${method}`, body, {
      "Content-Type": "application/json",
    });
    if (!res || res.ok !== true) return { error: `telegram: ${res?.description || "neznáma chyba"}` };
    return { ok: true, result: res.result };
  } catch (e) {
    return { error: `telegram: ${e.message}` };
  }
}

module.exports = { sendArticle, callBotApi, buildCaption, esc };
