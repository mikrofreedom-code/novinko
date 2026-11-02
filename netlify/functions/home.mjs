import template from '../lib/home-template.cjs';
import discovery from '../lib/discovery-articles.js';
import home from '../lib/home-discovery.js';
import store from '../lib/store.js';

async function loadHomeArticles() {
  const snapshot = await store.loadNews('discovery');
  const now = Date.now();
  const published = items => items.filter(article => article.id && article.title
    && Number.isFinite(Date.parse(article.date)) && Date.parse(article.date) <= now)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  if (Array.isArray(snapshot?.items)) {
    const articles = published(snapshot.items);
    if (articles.length) return articles;
  }
  // Existing production cache covers the first request before the next cron
  // has prepared the new discovery snapshot. Never include external RSS URLs.
  const existing = await store.loadNews('all');
  if (Array.isArray(existing?.items)) {
    const articles = published(existing.items.filter(item => item.source === 'tím Novinko')
      .map(item => ({ id: item.id, title: item.title, perex: item.description,
        date: item.pubDate, category: item.category, imageUrl: item.image,
        imageCredit: item.imageCredit, mystery: item.mystery || {} })));
    if (articles.length) return articles;
  }
  return discovery.loadDiscoveryArticles();
}

export default async function handler(request) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': template.csp,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), interest-cohort=()',
    'Netlify-Vary': 'query=rubrika',
  };
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });
  }
  const requested = new URL(request.url).searchParams.get('rubrika');
  const category = Object.hasOwn(home.LABELS, requested) ? requested : 'all';
  try {
    const articles = await loadHomeArticles();
    return new Response(request.method === 'HEAD' ? null : home.renderHome(template.html, articles, category), {
      headers: { ...headers, ...discovery.discoveryCache },
    });
  } catch (error) {
    console.error('[home] Published articles unavailable:', error.message);
    return new Response(request.method === 'HEAD' ? null : home.renderHome(template.html, [], category), {
      status: 503, headers: { ...headers, 'Cache-Control': 'no-store', 'Retry-After': '120' },
    });
  }
}
