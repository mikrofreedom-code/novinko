// Search existing published content; no extra service or model calls.
const PAGE_SIZE = 20;
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cleanQuery = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 160);

function searchArticles(articles, query, requestedPage = 1) {
  query = cleanQuery(query);
  const terms = [...new Set(normalize(query).split(/\s+/).filter(Boolean))];
  const matches = articles.map(article => {
    const title = normalize(article.title);
    const perex = normalize(article.perex);
    const body = normalize(article.content);
    if (!terms.every(term => title.includes(term) || perex.includes(term) || body.includes(term))) return null;
    const score = terms.reduce((n, term) => n + (title.includes(term) ? 5 : perex.includes(term) ? 2 : 1), 0);
    return { article, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score
    || (Date.parse(b.article.date) || 0) - (Date.parse(a.article.date) || 0)
    || String(a.article.id).localeCompare(String(b.article.id)));
  const total = matches.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const numericPage = Number(requestedPage);
  const page = Number.isSafeInteger(numericPage) ? Math.min(pages, Math.max(1, numericPage)) : 1;
  return { query, total, page, pages, pageSize: PAGE_SIZE,
    items: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(row => row.article) };
}

module.exports = { searchArticles, cleanQuery };
