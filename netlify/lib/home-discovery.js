const { clanokUrl, esc } = require('./clanok-render');
const { formatArticleDate } = require('../../assets/article-date');
const { describeImage } = require('../../assets/image-credit');
const LABELS = { slovensko: 'Slovensko', svet: 'Svet', ekonomika: 'Ekonomika',
  sport: 'Šport', krypto: 'Krypto', ai: 'Umelá inteligencia', 'krypto-skola': 'Krypto škola',
  zahrada: 'Záhrada', recepty: 'Recepty', horoskop: 'Horoskopy', zahady: 'Záhady a fenomény' };

function image(article, className) {
  if (!/^https:\/\//i.test(article.imageUrl || '')) return '';
  const credit = describeImage(article.imageUrl, article.imageCredit, article.mystery?.imageKind).text;
  return `<img class="${className}" src="${esc(article.imageUrl)}" alt="" loading="lazy">`
    + (credit ? `<span class="img-credit">${esc(credit)}</span>` : '');
}
function meta(article) {
  return `<div class="story-byline"><span>tím Novinko</span><span> · </span><time datetime="${esc(article.date)}">${esc(formatArticleDate(article.date))}</time></div>`;
}
function card(article) {
  return `<a class="news-item" href="${esc(clanokUrl(article))}">${image(article, 'news-item-img')}<div class="news-item-body"><span class="story-label">${esc(LABELS[article.category] || 'Správy')}</span><h3 class="news-title">${esc(article.title)}</h3>${meta(article)}</div></a>`;
}
function replaceBlock(html, name, content) {
  return html.replace(new RegExp(`<!-- server:${name} -->[\\s\\S]*?<!-- /server:${name} -->`), () => content);
}
function renderHome(html, articles, category = 'all') {
  const selected = (category === 'all' ? articles : articles.filter(a => a.category === category)).slice(0, 20);
  const [lead, ...secondary] = selected;
  const rest = secondary.slice(3);
  const hero = lead ? `<div class="story-featured"><div class="story-featured-left">${image(lead, 'story-featured-img')}<span class="story-label">${esc(LABELS[lead.category] || 'Správy')}</span><h2 class="story-headline-main"><a class="story-headline-xl" href="${esc(clanokUrl(lead))}">${esc(lead.title)}</a></h2><div class="story-summary">${esc(lead.perex)}</div>${meta(lead)}</div><div class="story-featured-right">${secondary.slice(0, 3).map(article => `<a class="story-secondary" href="${esc(clanokUrl(article))}">${image(article, 'story-secondary-img')}<div class="story-secondary-text"><span class="story-label">${esc(LABELS[article.category] || 'Správy')}</span><h3 class="story-headline-md">${esc(article.title)}</h3>${meta(article)}</div></a>`).join('')}</div></div>`
    : '<p>Ďalšie články nájdete v <a href="/archiv">archíve správ</a>.</p>';
  const rows = [];
  for (let i = 0; i < rest.length; i += 2) rows.push(`<div class="news-row">${rest.slice(i, i + 2).map(card).join('')}</div>`);
  const latest = rest.length ? `<section aria-label="Najnovšie články Novinka"><div class="section-head"><h2 class="section-head-title">Najnovšie články</h2><a href="/archiv">Archív správ →</a></div><div class="news-list">${rows.join('')}</div></section>` : '';
  html = replaceBlock(replaceBlock(html, 'hero', hero), 'latest', latest);
  if (category !== 'all') html = html.replace('Dnešné správy</h1>', () => `${esc(LABELS[category])}</h1>`);
  return html;
}
module.exports = { renderHome, LABELS };
