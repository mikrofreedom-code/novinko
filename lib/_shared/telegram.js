// TELEGRAM — pošle ZVEREJNENÝ článok do kanála/chatu (Bot API).
// Len ODCHÁDZAJÚCE volanie (HTTPS POST) → funguje z lokálneho cronu, zadarmo,
// bez webhooku či verejného endpointu. Ak nie je nastavený token/chat, je to no-op
// (nezhodí publikovanie). Schvaľovacie tlačidlá = neskôr (Fáza 2).
//
// .env:
//   TELEGRAM_BOT_TOKEN=123456:ABC...   (z @BotFather)
//   TELEGRAM_CHAT_ID=@mojkanal alebo -1001234567890
//   SITE_URL=https://novinko.netlify.app   (voliteľné; default nižšie)

const SITE_URL = process.env.SITE_URL || 'https://novinko.netlify.app';

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

  const url = `${SITE_URL}/clanok.html?id=${encodeURIComponent(sheetId)}`;
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
