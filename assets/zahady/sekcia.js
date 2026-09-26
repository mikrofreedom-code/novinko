(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const labels = Object.fromEntries([...$('tema').options].map((o) => [o.value, o.textContent]));
  const seriesLabels = Object.fromEntries([...$('seria').options].map((o) => [o.value, o.textContent]));
  const types = { F: 'Faktografický článok', M: 'Záhada', H: 'Hypotéza', L: 'Legenda alebo tradícia', E: 'Ezoterický výklad', N: 'Nový objav' };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const normalize = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const articleLink = (url) => /^\/clanok\/[a-z0-9-]+$/.test(String(url || '')) ? url : null;
  function imageLink(url) {
    try {
      const u = new URL(url || '', location.origin);
      if (!url || u.username || u.password) return '';
      return u.origin === location.origin || (u.protocol === 'https:' && u.hostname.endsWith('.supabase.co')) ? u.href : '';
    } catch { return ''; }
  }
  let items = [], state = 'loading', limit = 12;
  let topic = '', series = '', query = '';
  function readLocation() {
    const p = new URLSearchParams(location.search);
    topic = Object.hasOwn(labels, p.get('tema')) ? p.get('tema') : '';
    series = Object.hasOwn(seriesLabels, p.get('series')) ? p.get('series') : '';
    query = (p.get('q') || '').slice(0, 200);
    $('tema').value = topic; $('seria').value = series; $('hladat').value = query;
    limit = 12;
  }
  function updateLocation() {
    const p = new URLSearchParams();
    if (topic) p.set('tema', topic);
    if (series) p.set('series', series);
    if (query) p.set('q', query);
    history.replaceState(null, '', location.pathname + (p.size ? '?' + p : '') + location.hash);
  }
  function imageCaption(item) {
    return item.mystery?.imageKind === 'ai' || /AI ilustrácia/i.test(item.imageCredit || '') ? 'AI ilustrácia' : '';
  }
  function card(item) {
    const m = item.mystery || {};
    const image = imageLink(item.image);
    const date = new Date(item.pubDate);
    const dateHTML = Number.isNaN(date.getTime()) ? '' : `<time datetime="${date.toISOString()}">${date.toLocaleDateString('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' })}</time>`;
    return `<article class="story"><a href="${esc(articleLink(item.link))}"><span class="story-media">${image ? `<img src="${esc(image)}" alt="" width="640" height="400" loading="lazy">${imageCaption(item) ? '<span class="image-credit">AI ilustrácia</span>' : ''}` : '<span class="story-media story-placeholder" aria-hidden="true">N.</span>'}</span><div class="story-body"><div class="story-meta"><span class="story-category">${esc(labels[m.subcategory] || 'Záhady a fenomény')}</span>${types[m.contentType] ? `<span class="story-type">${esc(types[m.contentType])}</span>` : ''}</div><h3>${esc(item.title)}</h3><p>${esc(item.description || '')}</p>${dateHTML}</div></a></article>`;
  }
  function show() {
    const active = Boolean(topic || series || query);
    $('reset').hidden = !active;
    document.querySelectorAll('.topic-nav [data-topic]').forEach((a) => {
      if (a.dataset.topic === topic) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
    $('more').hidden = true;
    if (state === 'loading') return;
    if (state === 'error') {
      $('count').textContent = '';
      $('stories').innerHTML = '<div class="empty-state" role="status"><h3>Príbehy sa nepodarilo načítať</h3><p>Skúste to znova o chvíľu.</p><button type="button" id="retry" class="outline-button more-button">Skúsiť znova</button></div>';
      $('retry').addEventListener('click', load);
      return;
    }
    const words = normalize(query).trim().split(/\s+/).filter(Boolean);
    const visible = items.filter((item) => {
      const m = item.mystery || {};
      const haystack = normalize([item.title, item.description, m.canonicalTopic, m.location, labels[m.subcategory], ...(Array.isArray(m.tags) ? m.tags : [])].join(' '));
      return (!topic || m.subcategory === topic) && (!series || m.series === series) && words.every((word) => haystack.includes(word));
    });
    const n = visible.length;
    $('count').textContent = `${n} ${n === 1 ? 'článok' : n > 1 && n < 5 ? 'články' : 'článkov'}`;
    $('stories-title').textContent = series ? seriesLabels[series] : topic ? labels[topic] : 'Príbehy, ktoré stoja za pozornosť';
    $('stories').innerHTML = n ? visible.slice(0, limit).map(card).join('') : `<div class="empty-state" role="status"><h3>${active ? 'Tento príbeh ešte čaká na objavenie' : 'Prvé príbehy už čoskoro'}</h3><p>${active ? 'Zvolenému výberu zatiaľ nezodpovedá žiadny článok. Skúste inú tému alebo zrušte filtre.' : 'Pripravujeme pre vás rubriku plnú histórie, objavov a legiend. Zatiaľ môžete objavovať jednotlivé témy alebo si prečítať horoskop.'}</p>${active ? '<button type="button" id="empty-reset" class="outline-button more-button">Zobraziť všetky príbehy</button>' : '<a class="text-link" href="/horoskop.html">Prejsť na horoskopy <span aria-hidden="true">↗</span></a>'}</div>`;
    $('empty-reset')?.addEventListener('click', reset);
    $('more').hidden = n <= limit;
  }
  function reset() {
    topic = ''; series = ''; query = ''; limit = 12;
    $('tema').value = ''; $('seria').value = ''; $('hladat').value = '';
    updateLocation(); show();
  }
  function renderLead() {
    const lead = items.find((i) => i.mystery?.series === 'tyzden') || items[0];
    if (!lead) return;
    $('lead-title').textContent = lead.title;
    $('lead-description').textContent = lead.description || '';
    const type = types[lead.mystery?.contentType];
    $('lead-kicker').textContent = (lead.mystery?.series === 'tyzden' ? 'Záhada týždňa' : 'Najnovší príbeh') + (type ? ` / ${type}` : '');
    $('lead-link').href = articleLink(lead.link);
    $('lead-link').innerHTML = 'Čítať celý príbeh <span aria-hidden="true">↗</span>';
    const image = imageLink(lead.image);
    if (image) {
      $('lead-image').src = image;
      $('lead-credit').textContent = imageCaption(lead) || String(lead.imageCredit || '');
      $('lead-credit').hidden = !$('lead-credit').textContent;
    }
  }
  async function load() {
    state = 'loading';
    $('stories').setAttribute('aria-busy', 'true');
    $('stories').innerHTML = '<p class="empty-state" role="status">Načítavame príbehy…</p>';
    try {
      const res = await fetch('/.netlify/functions/fetch-rss?category=zahady', { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error('Failed to load stories');
      const data = await res.json();
      if (!Array.isArray(data.items)) throw new Error('Invalid stories response');
      items = data.items.filter((i) => i && typeof i.title === 'string' && articleLink(i.link));
      items.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
      state = 'ready'; renderLead();
    } catch { state = 'error'; }
    $('stories').setAttribute('aria-busy', 'false'); show();
  }
  $('filters').addEventListener('submit', (e) => e.preventDefault());
  $('tema').addEventListener('change', () => { topic = $('tema').value; limit = 12; updateLocation(); show(); });
  $('seria').addEventListener('change', () => { series = $('seria').value; limit = 12; updateLocation(); show(); });
  $('hladat').addEventListener('input', () => { query = $('hladat').value.slice(0, 200); limit = 12; updateLocation(); show(); });
  $('reset').addEventListener('click', reset);
  $('more').addEventListener('click', () => {
    const firstNewIndex = limit;
    limit += 12; show();
    $('stories').querySelectorAll('.story a')[firstNewIndex]?.focus({ preventScroll: true });
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-topic],a[data-series]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    history.pushState(null, '', a.href); readLocation(); show();
    $('pribehy').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    $('tema').focus({ preventScroll: true });
  });
  addEventListener('popstate', () => { readLocation(); show(); });
  // Avoid broken-image icons without inline handlers (the site has a strict CSP).
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.id === 'lead-image' && !img.src.endsWith('/assets/zahady/krajina.webp')) {
      img.src = '/assets/zahady/krajina.webp';
      $('lead-credit').textContent = 'AI ilustrácia · imaginárna krajina'; $('lead-credit').hidden = false;
    } else if (img.closest('.story-media')) {
      img.parentElement.classList.add('story-placeholder'); img.parentElement.textContent = 'N.';
    }
  }, true);
  readLocation(); show(); load();
})();
