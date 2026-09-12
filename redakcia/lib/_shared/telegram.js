// TELEGRAM — pošle ZVEREJNENÝ článok do kanála/chatu (Bot API).
// Len ODCHÁDZAJÚCE volanie (HTTPS POST) → funguje z lokálneho cronu, zadarmo,
// bez webhooku či verejného endpointu. Ak nie je nastavený token/chat, je to no-op
// (nezhodí publikovanie).
//
// Schvaľovacie tlačidlá (Fáza 2): sendApprovalRequest() nižšie pošle náhľad
// do SÚKROMNÉHO chatu (TELEGRAM_APPROVAL_CHAT_ID, iný než verejný TELEGRAM_CHAT_ID)
// s inline tlačidlami ✅/❌. Kliknutie zachytí netlify/functions/telegram-webhook.js.
//
// .env:
//   TELEGRAM_BOT_TOKEN=123456:ABC...   (z @BotFather)
//   TELEGRAM_CHAT_ID=@mojkanal alebo -1001234567890   (verejný broadcast po publikovaní)
//   TELEGRAM_APPROVAL_CHAT_ID=1422827771              (súkromný chat, len pre schválenie)
//   SITE_URL=https://novinko.sk   (voliteľné; default nižšie)

const SITE_URL = process.env.SITE_URL || 'https://novinko.sk';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// IDENTICKÁ s netlify/lib/clanok-render.js slugify() — musí dať rovnaký slug
// pre ten istý titulok, inak by URL, ktorú pošle tento súbor do Telegramu,
// neviedla na ten istý riadok, aký si fetchSheetItems() zostaví pre web.
// Dve oddelené kópie (redakcia/ a netlify/lib/ sú samostatné codebase-y,
// žiadny spoločný import) — rovnaký vzor ako articleToRow, zdokumentovaný
// v koreňovom CLAUDE.md ("dve cesty k tomu istému").
function slugify(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'clanok';
}

// Zostaví text správy (HTML). Perex bezpečne oreže, nech sa zmestí do caption limitu.
function buildCaption(article, url) {
  const perex = article.perex ? esc(article.perex).slice(0, 600) : '';
  return `<b>${esc(article.headline)}</b>\n\n`
    + (perex ? `${perex}\n\n` : '')
    + `📖 <a href="${url}">Čítať celý článok</a>`;
}

// article: náš article objekt (headline, perex, image_url, …)
// sheetId: ID riadku v Google Sheete (= row[0]) → verejná URL článku.
export async function sendArticle(article, sheetId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { skipped: 'telegram nenastavený (chýba TELEGRAM_BOT_TOKEN/CHAT_ID)' };
  if (!article?.headline) return { skipped: 'bez headline' };

  // POZOR (nájdené 12. 9.): predtým tu bolo /clanok.html?id=... — tú stránku
  // skladá až JavaScript v prehliadači, takže Facebook/X/akýkoľvek crawler
  // (nespúšťa JS) videl len prázdnu hlavičku bez og:image/og:title. Presne
  // preto sa pri zdieľaní na Facebooku nezobrazoval obrázok. /clanok/<slug>-<id>
  // je funkcia (netlify/functions/clanok.js), ktorá vráti hotové HTML s og:
  // značkami hneď, bez JS.
  const url = `${SITE_URL}/clanok/${slugify(article.headline)}-${encodeURIComponent(sheetId)}`;
  const caption = buildCaption(article, url);

  try {
    const hasImg = typeof article.image_url === 'string' && article.image_url.startsWith('http');
    const method = hasImg ? 'sendPhoto' : 'sendMessage';
    const body = hasImg
      ? { chat_id: chat, photo: article.image_url, caption, parse_mode: 'HTML' }
      : { chat_id: chat, text: caption, parse_mode: 'HTML', disable_web_page_preview: false };

    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    if (!j.ok) return { error: `telegram: ${j.description || res.status}` };
    return { sent: true };
  } catch (e) {
    return { error: `telegram: ${e.message}` };
  }
}

// Náhľad pred publikovaním — bez verejnej URL (ešte nič nie je zverejnené),
// s dvomi inline tlačidlami. callback_data nesie queue item id, aby ho
// webhook vedel spätne dohľadať.
function buildApprovalCaption(article) {
  const perex = article.perex ? esc(article.perex).slice(0, 600) : '';
  const zdroje = (article.sources ?? [])
    .map((s) => `${esc(s.name)}${s.type === 'secondary' ? ' (sekundárny)' : ''}`)
    .join(', ');
  return `📝 <b>Na schválenie</b>\n\n<b>${esc(article.headline)}</b>\n\n`
    + (perex ? `${perex}\n\n` : '')
    + (zdroje ? `🔗 zdroje: ${zdroje}` : '');
}

// itemId: queue.id (uuid) — nesie sa v callback_data, aby webhook vedel, čo schváliť/zamietnuť.
export async function sendApprovalRequest(itemId, article) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_APPROVAL_CHAT_ID;
  if (!token || !chat) return { skipped: 'schvaľovací chat nenastavený (chýba TELEGRAM_APPROVAL_CHAT_ID)' };
  if (!article?.headline) return { skipped: 'bez headline' };

  const caption = buildApprovalCaption(article);
  const reply_markup = {
    inline_keyboard: [[
      { text: '✅ Publikovať', callback_data: `approve:${itemId}` },
      { text: '❌ Zamietnuť', callback_data: `reject:${itemId}` },
    ]],
  };

  const hasImg = typeof article.image_url === 'string' && article.image_url.startsWith('http');
  const method = hasImg ? 'sendPhoto' : 'sendMessage';
  const body = hasImg
    ? { chat_id: chat, photo: article.image_url, caption, parse_mode: 'HTML', reply_markup }
    : { chat_id: chat, text: caption, parse_mode: 'HTML', reply_markup };

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) return { error: `telegram schválenie: ${j.description || res.status}` };
  return { message_id: j.result.message_id, chat_id: chat };
}
