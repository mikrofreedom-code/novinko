/* Editorial economy view. Uses existing published articles and market embeds. */
(function (root) {
  'use strict';
  const topics = [
    ['all', 'Všetko'],
    ['slovensko', 'Slovensko', /\b(slovensk\w*|slovak\w*|bratislav\w*|nbs)\b/i],
    ['europa', 'Európa', /\b(eurozon\w*|europsk\w*|europa|ecb|eurostat|brusel\w*|nemeck\w*|francuz\w*)\b/i],
    ['inflacia', 'Ceny a inflácia', /\b(inflac\w*|zdraz\w*|spotrebitelsk\w*|cen(?:a|y|u|ou|ach|ami|ov\w*|otvor\w*)|cpi|hicp)\b/i],
    ['sadzby', 'Sadzby a úvery', /\b(sadzb\w*|urok\w*|uver\w*|hypotek\w*|ecb|fed|federaln\w*\s+rezerv\w*)\b/i],
    ['firmy', 'Firmy a obchod', /\b(firm\w*|podnik\w*|spolocnost\w*|obchod\w*|clo|cla|coln\w*|tarif\w*|export\w*|import\w*|trzb\w*|zisk\w*)\b/i],
    ['energie', 'Energie', /\b(energi\w*|energet\w*|rop\w*|plyn\w*|elektr\w*|opec)\b/i],
    ['praca', 'Práca a mzdy', /\b(mzd\w*|plat(?:y|u|om|och|mi|ov\w*)?|pracovn\w*|nezamestnan\w*|zamestnan\w*|prepust\w*|dochod\w*)\b/i],
  ];
  const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function matches(item, topic) {
    const pattern = topics.find(t => t[0] === topic)?.[2];
    return !pattern || pattern.test(normalize(`${item.title || ''} ${item.description || ''}`));
  }
  function state(search) {
    const params = new URLSearchParams(search);
    return { view: params.get('pohlad') === 'trhy' ? 'trhy' : 'spravy',
      topic: topics.some(t => t[0] === params.get('tema')) ? params.get('tema') : 'all' };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { topics, matches, state };
  if (!root.document) return;
  const $ = id => document.getElementById(id);
  const url = (view = 'spravy', topic = 'all') => `/?rubrika=ekonomika${view === 'trhy' ? '&pohlad=trhy' : ''}${topic === 'all' ? '' : '&tema=' + topic}`;
  let context, initialized = false, promo, promoPosition;
  function init() {
    if (initialized) return;
    initialized = true;
    $('economyPortal').innerHTML = `
      <header class="crypto-mast economy-mast">
        <p class="crypto-kicker">NOVINKO / EKONOMIKA</p>
        <h1>Ekonomika, ktorá sa <br>dotýka vás<span>.</span></h1>
        <p class="crypto-intro">Od rozhodnutí centrálnych bánk po každodenné výdavky. Správy, čísla a ich súvislosti.</p>
        <nav id="economyNav" class="crypto-nav" aria-label="Pohľady rubriky Ekonomika"></nav>
      </header>
      <section id="economyNews" aria-label="Ekonomické spravodajstvo">
        <div id="economyLead"></div>
        <div class="crypto-feed-head"><h2>Najnovšie z ekonomiky</h2><a href="/archiv">Archív správ ↗</a></div>
        <div id="economyFilters" class="crypto-filters" role="group" aria-label="Filtrovať ekonomické správy podľa témy"></div>
        <p id="economyCount" class="crypto-count" role="status"></p>
        <div id="economyFeed"></div><div id="economyPromoSlot"></div>
        <aside class="economy-reading-note"><span class="crypto-kicker">ČÍSLA V SÚVISLOSTIACH</span><h2>Za každým percentom je porovnanie.</h2><p>Pri inflácii, mzdách aj raste ekonomiky záleží na období, metodike a zdroji. Medziročná a medzimesačná zmena hovoria o inom porovnaní.</p><a class="crypto-text-link" data-economy-view="trhy" href="${url('trhy')}">Otvoriť trhy a ekonomický kalendár →</a></aside>
      </section>
      <section id="economyMarket" hidden aria-labelledby="economyMarketTitle">
        <div class="crypto-panel-head"><p class="crypto-kicker">TRHY A KALENDÁR</p><h2 id="economyMarketTitle">Údaje, ktoré dopĺňajú správy.</h2><p>Menový kurz, udalosti eurozóny a Spojených štátov. Čísla čítajte spolu s časom, obdobím a zdrojom.</p></div>
        <section class="market-section" aria-labelledby="economyChartTitle"><div class="section-head"><h3 id="economyChartTitle" class="section-head-title">Menový kurz EUR/USD</h3></div>
          <div class="tv-chart-wrap"><div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:100%;width:100%"></div>
          <script type="application/json" data-widget-fallback="https://www.tradingview.com/symbols/EURUSD/" data-widget-src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js">{"autosize":true,"symbol":"FX:EURUSD","interval":"D","timezone":"Europe/Bratislava","theme":"light","style":"1","locale":"sk","allow_symbol_change":true,"calendar":false,"support_host":"https://www.tradingview.com"}</script></div></div>
          <p class="crypto-market-note">EUR/USD vyjadruje hodnotu jedného eura v amerických dolároch. V grafe môžete zmeniť symbol aj obdobie.</p><a class="crypto-text-link" href="https://www.tradingview.com/symbols/EURUSD/" target="_blank" rel="noopener noreferrer">Ak sa graf nezobrazí, otvoriť na TradingView ↗</a>
        </section>
        <div id="economyCalendarSlot"></div>
        <p class="crypto-market-note">Graf, kalendár a horný pás poskytuje TradingView. Údaje môžu byť oneskorené. Indexy označené CFD v páse sú derivátové kotácie; nejde o priamy kurz hotovostného indexu. Kalendár môže zobrazovať názvy ukazovateľov v angličtine.</p>
        <a class="crypto-text-link" href="https://www.tradingview.com/economic-calendar/" target="_blank" rel="noopener noreferrer">Ak sa kalendár nezobrazí, otvoriť na TradingView ↗</a>
        <div class="crypto-feed-head"><h2>Správy v súvislostiach</h2><a data-economy-view="spravy" href="${url()}">Všetky správy →</a></div><div id="economyMarketNews"></div>
      </section>`;
    $('economyCalendarSlot').appendChild($('sbEkonomika'));
    promo = document.querySelector('#main > .promo-slot');
    if (promo) { promoPosition = document.createComment('Original promo position outside Economy'); promo.before(promoPosition); }
    document.addEventListener('click', event => {
      const link = event.target.closest('a[data-economy-view],a[data-economy-topic]');
      if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const topicLink = link.hasAttribute('data-economy-topic');
      const key = topicLink ? link.dataset.economyTopic : link.dataset.economyView;
      if (link.href === location.href) return;
      history.pushState({}, '', link.href);
      render(context);
      const selector = topicLink ? '#economyFilters a' : '#economyNav a';
      Array.from(document.querySelectorAll(selector)).find(a => (topicLink ? a.dataset.economyTopic : a.dataset.economyView) === key)?.focus({ preventScroll:true });
      // Collapsing the lead or opening markets from the bottom changes page height.
      // Keep the controls and new content in view, including for keyboard users.
      $(topicLink ? 'economyFilters' : 'economyNav').scrollIntoView({ block:'start', behavior:'instant' });
    });
  }
  function setActive(active) {
    document.body.classList.toggle('economy-active', active);
    if (!active) document.body.classList.remove('economy-market-active');
    $('economyPortal').hidden = !active;
    $('economyAside').hidden = !active;
    if (!active && promo && promoPosition) promoPosition.after(promo);
  }
  function render(ctx) {
    if (!ctx) return;
    context = ctx; init();
    if (promo) $('economyPromoSlot').appendChild(promo);
    const { items, loaded, esc, safeLink, ownImg } = ctx;
    const { view, topic } = state(location.search);
    document.body.classList.toggle('economy-market-active', view === 'trhy');
    $('economyNav').innerHTML = [['spravy','Správy'],['trhy','Trhy a kalendár']].map(([key,label]) => `<a href="${url(key)}" data-economy-view="${key}" ${view === key ? 'aria-current="page"' : ''}>${label}</a>`).join('');
    $('economyNews').hidden = view !== 'spravy'; $('economyMarket').hidden = view !== 'trhy';
    document.title = `${view === 'trhy' ? 'Trhy a ekonomický kalendár' : 'Ekonomika'} — Novinko`;
    const label = item => topics.find(t => t[0] !== 'all' && matches(item,t[0]))?.[1] || 'Ekonomika';
    const date = item => {
      const d = new Date(item.pubDate);
      return Number.isFinite(d.getTime()) ? `<time datetime="${esc(d.toISOString())}">${esc(root.formatArticleDate(item.pubDate))}</time>` : '';
    };
    const card = (item, lead = false) => `<article class="${lead ? 'crypto-lead-card' : 'crypto-story'}"><a href="${safeLink(item.link)}" class="crypto-story-link">${ownImg(item,lead ? 'story-featured-img' : 'news-item-img')}<div class="crypto-story-copy"><span class="crypto-story-topic">${esc(label(item))}</span><h${lead ? '2' : '3'}>${esc(item.title)}</h${lead ? '2' : '3'}>${item.description ? `<p class="crypto-perex">${esc(item.description)}</p>` : ''}<div class="crypto-story-meta">${esc(item.source || 'Novinko')} <span aria-hidden="true">·</span> ${date(item)}</div></div></a></article>`;
    const lead = topic === 'all' ? items.slice(0,4) : [];
    $('economyLead').innerHTML = lead.length ? `<div class="crypto-lead-grid">${card(lead[0],true)}<div class="crypto-lead-side">${lead.slice(1).map(i=>card(i)).join('')}</div></div>` : '';
    $('economyFilters').innerHTML = topics.map(([key,name]) => `<a href="${url('spravy',key)}" data-economy-topic="${key}" ${key === topic ? 'aria-current="true"' : ''}>${name}</a>`).join('');
    const filtered = items.filter(i=>matches(i,topic));
    const rest = topic === 'all' ? filtered.slice(lead.length) : filtered;
    const countLabel = filtered.length === 1 ? 'článok' : filtered.length >= 2 && filtered.length <= 4 ? 'články' : 'článkov';
    $('economyCount').textContent = topic === 'all' ? 'Najnovšie publikované články, zoradené podľa času.' : `${topics.find(t=>t[0]===topic)[1]} · ${filtered.length} ${countLabel} v aktuálnom prehľade`;
    $('economyFeed').innerHTML = rest.length ? rest.map(i=>card(i)).join('') : `<p class="crypto-empty">${!loaded ? 'Správy sa nepodarilo načítať. Skúste tlačidlo obnovenia v hlavičke.' : !items.length ? 'V tejto rubrike zatiaľ nie sú dostupné správy.' : topic === 'all' ? 'Všetky aktuálne správy nájdete vyššie.' : 'V aktuálnom prehľade nie sú články k tejto téme. Vyberte inú tému alebo otvorte archív.'}</p>`;
    $('economyMarketNews').innerHTML = items.slice(0,4).map(i=>card(i)).join('');
    $('economyAside').innerHTML = `<div class="crypto-aside-block economy-perspective"><span class="crypto-kicker">ŠIRŠÍ POHĽAD</span><h2>Veľké rozhodnutia.<br>Každodenné dôsledky.</h2><p>Ceny, úroky, firmy a práca. Ekonomika od Slovenska po svet.</p><a data-economy-view="trhy" href="${url('trhy')}">Trhy a ekonomický kalendár ↗</a></div>
      <div class="crypto-aside-block"><h2>Rozumieť ukazovateľom</h2><dl class="economy-glossary"><dt>Inflácia</dt><dd>Zmena cenovej hladiny. Spomalenie inflácie samo osebe neznamená pokles cien.</dd><dt>Úroková sadzba</dt><dd>Cena požičiavania peňazí vyjadrená v percentách za dané obdobie.</dd><dt>HDP</dt><dd>Hodnota produkcie ekonomiky. Pri porovnávaní rastu záleží aj na zohľadnení cien.</dd></dl></div>
      <div class="crypto-aside-block crypto-trust"><h2>Ako vzniká Novinko</h2><p>Píše AI. Človek kontroluje. Zdroje a čas údajov patria k správe.</p><a href="/impressum.html">O redakcii ↗</a><a href="/pravo-na-opravu.html">Právo na opravu ↗</a></div>`;
    if (view === 'trhy') NovinkoWidgets.mount($('economyMarket'),'https://www.tradingview.com/economic-calendar/');
    NovinkoWidgets.mount($('tickerEkonomika'),'https://www.tradingview.com/markets/');
  }
  root.NovinkoEconomy = { render, setActive };
})(typeof window !== 'undefined' ? window : globalThis);
