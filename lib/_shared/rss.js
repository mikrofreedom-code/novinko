// RSS/ATOM CLIENT — stiahne a sparsuje feed na normalizované položky.
import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 15000,
  headers: { 'user-agent': 'novinko-redakcia/0.1 (+crypto news)' },
});

// Vyčisti HTML značky z textu (feedy niekedy dávajú HTML obsah).
function stripHtml(s) {
  return (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Vráti pole položiek: { guid, title, link, text, published }
export async function fetchFeed(url) {
  const feed = await parser.parseURL(url);
  return (feed.items ?? []).map((it) => ({
    guid: it.guid || it.id || it.link || it.title,
    title: it.title ?? null,
    link: it.link ?? null,
    text: stripHtml(it.contentSnippet || it.content || it['content:encoded'] || it.summary || ''),
    published: it.isoDate || it.pubDate || null,
  }));
}
