/* Krypto uses the same published feed as the rest of Novinko. No extra API. */
(function (root) {
  'use strict';
  const topics = [
    ['all', 'Všetko'],
    ['bitcoin', 'Bitcoin', /\bbitcoin\w*|\bbtc\b/i],
    ['ethereum', 'Ethereum', /\bethere\w*|\beth\b/i],
    ['altcoiny', 'Altcoiny', /\b(altcoin\w*|solan\w*|sol|xrp|cardan\w*|dogecoin\w*|memecoin\w*|bnb|avax|sui|chainlink\w*|aleo|litecoin\w*)\b/i],
    ['etf', 'ETF', /\betf\b/i],
    ['regulacia', 'Regulácia', /\b(regul\w*|mica|sec|zakon\w*|legislativ\w*|sankci\w*|licenci\w*|sud\w*)\b/i],
    ['bezpecnost', 'Bezpečnosť', /\b(hack\w*|podvod\w*|bezpecn\w*|utok\w*|phishing\w*|kradez\w*|ukrad\w*|unik\w*)\b/i],
    ['defi', 'DeFi', /\b(defi|staking\w*|stake\w*|dex|uniswap\w*|aave|tokeniz\w*)\b/i],
  ];
  const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  function matches(item, topic) {
    const definition = topics.find(t => t[0] === topic);
    return !definition?.[2] || definition[2].test(normalize(`${item.title || ''} ${item.description || ''}`));
  }
  function state(search) {
    const params = new URLSearchParams(search);
    return {
      view: ['spravy', 'trh', 'skola'].includes(params.get('pohlad')) ? params.get('pohlad') : 'spravy',
      topic: topics.some(t => t[0] === params.get('tema')) ? params.get('tema') : 'all',
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { topics, matches, state };
  if (!root.document) return;

  let context;
  let initialized = false;
  let promo;
  let promoPosition;
  const $ = id => document.getElementById(id);
  const url = (view, topic = 'all') => `/?rubrika=krypto${view === 'spravy' ? '' : '&pohlad=' + view}${topic === 'all' ? '' : '&tema=' + topic}`;
  const arrow = '<span aria-hidden="true">↗</span>';

  function mountWidgets(container) {
    container.querySelectorAll('script[data-widget-src]').forEach(config => {
      if (config.dataset.mounted) return;
      config.dataset.mounted = 'true';
      const script = document.createElement('script');
      script.src = config.dataset.widgetSrc;
      script.async = true;
      script.textContent = config.textContent;
      config.parentElement.appendChild(script);
    });
  }
  function init() {
    if (initialized) return;
    initialized = true;
    $('cryptoPortal').innerHTML = `
      <header class="crypto-mast">
        <p class="crypto-kicker">NOVINKO / KRYPTO</p>
        <h1>Krypto v súvislostiach<span>.</span></h1>
        <p class="crypto-intro">Správy, ktoré vysvetľujú pohyb trhu. Technológie, ktoré menia financie.</p>
        <nav id="cryptoNav" class="crypto-nav" aria-label="Pohľady rubriky Krypto"></nav>
      </header>
      <section id="cryptoNews" aria-label="Krypto spravodajstvo">
        <div id="cryptoLead"></div>
        <div class="crypto-feed-head"><h2>Najnovšie správy</h2><a href="/archiv">Archív správ ${arrow}</a></div>
        <div id="cryptoFilters" class="crypto-filters" role="group" aria-label="Filtrovať správy podľa témy"></div>
        <p id="cryptoCount" class="crypto-count" role="status"></p>
        <div id="cryptoFeed"></div>
        <div id="cryptoPromoSlot"></div>
        <div class="crypto-school-teaser"><div><span class="crypto-kicker">ROZUMIEŤ JE VIAC NEŽ SLEDOVAŤ</span><h2>V kryptosvete sa dá zorientovať.</h2><p>Peňaženky, bezpečnosť aj fungovanie technológií. Začnite s Krypto školou.</p></div><a class="crypto-cta" data-crypto-view="skola" href="${url('skola')}">Otvoriť Krypto školu →</a></div>
      </section>
      <section id="cryptoMarket" hidden aria-labelledby="cryptoMarketTitle">
        <div class="crypto-panel-head"><p class="crypto-kicker">TRH V KONTEXTE</p><h2 id="cryptoMarketTitle">Najprv dáta. Potom súvislosti.</h2><p>Graf začína párom BTC/USDT na burze Binance. Symbol a obdobie môžete zmeniť priamo v grafe.</p></div>
        <div id="cryptoChartSlot"></div>
        <p class="crypto-market-note">Grafy a kurzy poskytuje TradingView. USDT je stablecoin; cena páru BTC/USDT nie je kurz BTC/EUR. Dostupnosť a aktuálnosť údajov závisí od poskytovateľa.</p>
        <a class="crypto-text-link" href="https://www.tradingview.com/symbols/BTCUSDT/" target="_blank" rel="noopener noreferrer">Ak sa graf nezobrazí, otvoriť na TradingView ${arrow}</a>
        <div id="cryptoScreenerSlot"></div>
        <div class="crypto-feed-head"><h2>Správy k trhu</h2><a data-crypto-view="spravy" href="${url('spravy')}">Všetky správy →</a></div>
        <div id="cryptoMarketNews"></div>
      </section>
      <section id="cryptoSchool" hidden aria-labelledby="cryptoSchoolTitle">
        <div class="crypto-panel-head"><p class="crypto-kicker">KRYPTO ŠKOLA</p><h2 id="cryptoSchoolTitle">Pochopte základy. Spoznajte riziká.</h2><p>Vysvetlenia, ku ktorým sa môžete vrátiť aj po dočítaní dnešných správ.</p></div>
        <div id="cryptoLessons" class="crypto-lessons"></div>
      </section>`;
    $('cryptoChartSlot').appendChild($('chartSection'));
    $('cryptoScreenerSlot').appendChild($('screenerSection'));
    promo = document.querySelector('#main > .promo-slot');
    if (promo) {
      promoPosition = document.createComment('Original promo position outside Krypto');
      promo.before(promoPosition);
    }
    document.addEventListener('click', event => {
      const link = event.target.closest('a[data-crypto-view],a[data-crypto-topic]');
      if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const focusKey = link.dataset.cryptoTopic || link.dataset.cryptoView;
      history.pushState({}, '', link.href);
      render(context);
      const selector = link.hasAttribute('data-crypto-topic') ? '[data-crypto-topic]' : '#cryptoNav [data-crypto-view]';
      Array.from(document.querySelectorAll(selector)).find(el => (el.dataset.cryptoTopic || el.dataset.cryptoView) === focusKey)?.focus({ preventScroll: true });
    });
  }
  function setActive(active) {
    document.body.classList.toggle('crypto-active', active);
    $('cryptoPortal').hidden = !active;
    $('cryptoAside').hidden = !active;
    if (!active && promo && promoPosition) promoPosition.after(promo);
  }
  function render(ctx) {
    if (!ctx) return;
    context = ctx;
    init();
    if (promo) $('cryptoPromoSlot').appendChild(promo);
    const { items, school, loaded, esc, safeLink, ownImg } = ctx;
    const { view, topic } = state(location.search);
    $('cryptoNav').innerHTML = [['spravy', 'Správy'], ['trh', 'Trh'], ['skola', 'Krypto škola']].map(([key, name]) =>
      `<a href="${url(key)}" data-crypto-view="${key}" ${view === key ? 'aria-current="page"' : ''}>${name}${key === 'trh' ? ' <span aria-hidden="true">↗</span>' : ''}</a>`).join('');
    $('cryptoNews').hidden = view !== 'spravy';
    $('cryptoMarket').hidden = view !== 'trh';
    $('cryptoSchool').hidden = view !== 'skola';
    document.title = `${view === 'trh' ? 'Kryptotrh' : view === 'skola' ? 'Krypto škola' : 'Krypto'} — Novinko`;
    const topicName = item => topics.find(t => t[0] !== 'all' && matches(item, t[0]))?.[1] || 'Krypto';
    const date = item => {
      const d = new Date(item.pubDate);
      return Number.isFinite(d.getTime()) ? `<time datetime="${esc(d.toISOString())}">${esc(d.toLocaleDateString('sk-SK', { day: 'numeric', month: 'short', timeZone: 'Europe/Bratislava' }))} · ${esc(d.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Bratislava' }))}</time>` : '';
    };
    const card = (item, lead = false) => `<article class="${lead ? 'crypto-lead-card' : 'crypto-story'}">
      <a href="${safeLink(item.link)}" class="crypto-story-link">
        ${ownImg(item, lead ? 'story-featured-img' : 'news-item-img')}
        <div class="crypto-story-copy"><span class="crypto-story-topic">${esc(topicName(item))}</span>
        <h${lead ? '2' : '3'}>${esc(item.title)}</h${lead ? '2' : '3'}>
        ${item.description ? `<p class="crypto-perex">${esc(item.description)}</p>` : ''}
        <div class="crypto-story-meta">${esc(item.source || 'Novinko')} <span aria-hidden="true">·</span> ${date(item)}</div></div>
      </a></article>`;
    const leadItems = topic === 'all' ? items.slice(0, 4) : [];
    $('cryptoLead').innerHTML = leadItems.length ? `<div class="crypto-lead-grid">${card(leadItems[0], true)}<div class="crypto-lead-side">${leadItems.slice(1).map(i => card(i)).join('')}</div></div>` : '';
    $('cryptoFilters').innerHTML = topics.map(([key, label]) => `<a href="${url('spravy', key)}" data-crypto-topic="${key}" ${topic === key ? 'aria-current="true"' : ''}>${label}</a>`).join('');
    const filtered = items.filter(i => matches(i, topic));
    const list = topic === 'all' ? filtered.slice(leadItems.length) : filtered;
    $('cryptoCount').textContent = topic === 'all' ? 'Najnovšie publikované články, zoradené podľa času.' : `${topics.find(t => t[0] === topic)[1]} · ${filtered.length} článkov v aktuálnom prehľade`;
    $('cryptoFeed').innerHTML = list.length ? list.map(i => card(i)).join('') : `<div class="crypto-empty">${!loaded ? 'Správy sa nepodarilo načítať. Skúste tlačidlo obnovenia v hlavičke.' : !items.length ? 'V tejto rubrike zatiaľ nie sú dostupné správy.' : topic === 'all' ? 'Všetky aktuálne správy nájdete vyššie.' : 'V aktuálnom prehľade nie sú články k tejto téme. Vyberte inú tému alebo otvorte archív.'}</div>`;
    $('cryptoMarketNews').innerHTML = items.slice(0, 4).map(i => card(i)).join('');
    $('cryptoLessons').innerHTML = school.length ? school.map((item, index) => `<a class="crypto-lesson" href="${safeLink(item.link)}"><span class="crypto-lesson-number">${String(index + 1).padStart(2, '0')}</span><div><h3>${esc(item.title)}</h3>${item.description ? `<p>${esc(item.description)}</p>` : ''}</div>${arrow}</a>`).join('') : '<p class="crypto-empty">Vzdelávacie články momentálne nie sú dostupné. Skúste obnoviť stránku.</p>';
    $('cryptoAside').innerHTML = `<div class="crypto-aside-block"><span class="crypto-kicker">VÁŠ PREHĽAD</span><h2>Od udalosti<br>k pochopeniu.</h2><p>Čo sa stalo, čo hovoria dáta a čo zatiaľ nevieme.</p><a data-crypto-view="trh" href="${url('trh')}">Pozrieť trh ${arrow}</a></div>
      <div class="crypto-aside-block"><h2>Začnite súvislosťami</h2>${school.slice(0, 3).map(i => `<a class="crypto-aside-story" href="${safeLink(i.link)}">${esc(i.title)} ${arrow}</a>`).join('')}<a data-crypto-view="skola" href="${url('skola')}">Celá Krypto škola →</a></div>
      <div class="crypto-aside-block crypto-trust"><h2>Ako vzniká Novinko</h2><p>Píše AI. Človek kontroluje. Pozrite si informácie o redakcii alebo nás upozornite na chybu.</p><a href="/impressum.html">O redakcii ${arrow}</a><a href="/pravo-na-opravu.html">Právo na opravu ${arrow}</a></div>`;
    if (view === 'trh') {
      $('chartSection').style.display = '';
      $('screenerSection').style.display = '';
      mountWidgets($('cryptoMarket'));
    }
    mountWidgets($('tickerCrypto'));
  }
  root.NovinkoCrypto = { render, setActive };
})(typeof window !== 'undefined' ? window : globalThis);
