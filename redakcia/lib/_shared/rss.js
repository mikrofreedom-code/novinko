// RSS/ATOM CLIENT — stiahne a sparsuje feed na normalizované položky.
import Parser from 'rss-parser';

const parserOptions = {
  timeout: 15000,
  // SEC a niektoré inštitúcie vyžadujú User-Agent s kontaktom.
  headers: { 'user-agent': process.env.FEED_USER_AGENT ?? 'NovinkoRedakcia/0.1 redakcia@novinko.sk' },
};
const parser = new Parser(parserOptions);
// HBR uses ns6:feed/ns6:entry for Atom; rss-parser expects unprefixed keys.
// Keep this adapter scoped to HBR so RSS media/content namespaces stay intact.
const hbrParser = new Parser({ ...parserOptions, xml2js: {
  tagNameProcessors: [(name) => name.replace(/^ns6:/, '')],
} });

// Vyčisti HTML značky z textu (feedy niekedy dávajú HTML obsah).
function stripHtml(s) {
  return (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Vráti pole položiek: { guid, title, link, text, published }
export async function fetchFeed(url, xml) {
  if(xml !== undefined && (typeof xml !== 'string' || Buffer.byteLength(xml)>1024*1024 || /<!\s*(DOCTYPE|ENTITY)/i.test(xml))) throw new Error('Nepovolený XML feed.');
  const isHbr = new URL(url).hostname === 'feeds.hbr.org';
  const client = isHbr ? hbrParser : parser;
  const feed = xml === undefined ? await client.parseURL(url) : await client.parseString(xml);
  return (feed.items ?? []).map((it) => ({
    guid: it.guid || it.id || it.link || it.title,
    title: it.title ?? null,
    link: isHbr && it.link?.startsWith('/') ? new URL(it.link, 'https://hbr.org').href : it.link ?? null,
    text: stripHtml(it.contentSnippet || it.content || it['content:encoded'] || it.summary || ''),
    published: it.isoDate || it.pubDate || null,
  }));
}
