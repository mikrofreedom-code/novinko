// Shared, versioned consent. Optional services must check allows() before loading.
(function () {
  'use strict';
  var measurementId = 'G-FGCPZ28E5C';
  var storageKey = 'novinko_consent_v2';
  // Bump when purposes/providers change, not for cosmetic changes.
  var policyVersion = '2026-10-21';
  var lifetime = 180 * 24 * 60 * 60 * 1000;
  var choice = null;
  var categories = [
    { id: 'necessary', title: 'Nevyhnutné a vaše voľby', text: 'Uloženie nastavenia súkromia a vami zvoleného vzhľadu stránky. Bez reklamného sledovania.', fixed: true },
    { id: 'analytics', title: 'Meranie návštevnosti', text: 'Google Analytics 4: návštevy, používanie stránok a základné údaje o zariadení. Pomáha nám zlepšovať obsah. Bez súhlasu sa Google Analytics nenačíta.' },
    { id: 'external', title: 'Externé grafy a trhové dáta', text: 'TradingView: interaktívne grafy a prehľady. Pri načítaní poskytovateľ dostane technické údaje vrátane IP adresy a môže používať vlastné úložisko. Bez súhlasu zostáva dostupný odkaz na jeho web.' },
    { id: 'marketing', title: 'Reklamné sledovanie', text: 'Momentálne nepoužívame. Bežné reklamné bannery sa môžu zobrazovať bez personalizácie. Pred zavedením sledovania uvedieme poskytovateľov a požiadame o príslušný súhlas.', inactive: true }
  ];
  function valid(value) {
    return value && value.version === policyVersion && Number.isFinite(value.savedAt)
      && value.savedAt <= Date.now() && Date.now() - value.savedAt < lifetime
      && typeof value.analytics === 'boolean' && typeof value.external === 'boolean';
  }
  try { var saved = JSON.parse(localStorage.getItem(storageKey)); if (valid(saved)) choice = saved; } catch (_) {}
  function allows(category) { return category === 'necessary' || (!!choice && valid(choice) && (category === 'analytics' || category === 'external') && choice[category] === true); }
  window.NovinkoConsent = { allows: allows, open: function () {}, version: policyVersion };
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window['ga-disable-' + measurementId] = !allows('analytics');
  window.gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  var previousPage = location.href;
  function trackPageChange() {
    var page = location.href, referrer = previousPage;
    previousPage = page;
    if (page !== referrer && allows('analytics')) window.gtag('event', 'page_view', { send_to: measurementId, page_location: page, page_referrer: referrer, page_title: document.title });
  }
  var originalPushState = history.pushState;
  history.pushState = function () { var result = originalPushState.apply(this, arguments); setTimeout(trackPageChange, 0); return result; };
  var originalReplaceState = history.replaceState;
  history.replaceState = function () { var result = originalReplaceState.apply(this, arguments); previousPage = location.href; return result; };
  window.addEventListener('popstate', function () { setTimeout(trackPageChange, 0); });
  function enableAnalytics() {
    if (!allows('analytics')) return;
    window['ga-disable-' + measurementId] = false;
    if (document.getElementById('novinko-ga4')) return;
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { cookie_expires: lifetime / 1000, cookie_update: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    var script = document.createElement('script');
    script.id = 'novinko-ga4'; script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(script);
  }
  function clearAnalyticsCookies() {
    document.cookie.split(';').forEach(function (cookie) {
      var name = cookie.split('=')[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) return;
      var domains = ['', location.hostname, '.' + location.hostname];
      var parts = location.hostname.split('.');
      while (parts.length > 2) { parts.shift(); domains.push('.' + parts.join('.')); }
      domains.forEach(function (domain) { document.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : ''); });
    });
  }
  if (allows('analytics')) enableAnalytics(); else clearAnalyticsCookies();
  function initBanner() {
    var banner = document.createElement('section');
    banner.id = 'cookieBanner'; banner.className = 'cookie-banner'; banner.hidden = true;
    banner.setAttribute('aria-label', 'Cookies a súkromie');
    banner.innerHTML = '<div class="cookie-inner"><div class="cookie-text"><strong class="cookie-title">Súkromie máte vo svojich rukách</strong><p>Články môžete čítať aj bez voliteľných cookies. S vaším súhlasom zapneme meranie návštevnosti a externé grafy. Voľbu môžete kedykoľvek zmeniť.</p><a href="/sukromie.html">Ako chránime súkromie</a></div><div class="cookie-actions"><button class="cookie-btn" id="cookieReject" type="button">Odmietnuť voliteľné</button><button class="cookie-btn" id="cookieAccept" type="button">Prijať voliteľné</button><button class="cookie-btn cookie-btn-settings" id="cookieCustomize" type="button" aria-expanded="false" aria-controls="cookieDetails">Nastaviť podrobne</button></div><div id="cookieDetails" hidden><h2>Čo dovolíte načítať?</h2>' + categories.map(function (c) {
      return '<label class="cookie-category"><span><strong>' + c.title + '</strong><span>' + c.text + '</span></span><input type="checkbox" id="consent-' + c.id + '"' + (c.fixed ? ' checked disabled' : c.inactive ? ' disabled' : '') + '><span class="cookie-status">' + (c.fixed ? 'Vždy aktívne' : c.inactive ? 'Neaktívne' : 'Voliteľné') + '</span></label>';
    }).join('') + '<p class="cookie-note">Prevádzkovateľ: Powerlink s. r. o. · Voľbu si pamätáme 180 dní. Nový účel alebo poskytovateľ môže vyžadovať nový súhlas.</p><div class="cookie-actions"><button type="button" class="cookie-btn" id="cookieSave">Uložiť výber</button><button type="button" class="cookie-btn" id="cookieClose">Zavrieť bez zmeny</button></div></div></div>';
    document.getElementById('cookieBanner')?.remove();
    document.body.appendChild(banner);
    var details = document.getElementById('cookieDetails');
    var customize = document.getElementById('cookieCustomize');
    var returnFocus = null;
    function show(expanded, focus) {
      returnFocus = document.activeElement;
      ['analytics', 'external'].forEach(function (id) { document.getElementById('consent-' + id).checked = allows(id); });
      details.hidden = !expanded; customize.setAttribute('aria-expanded', String(!!expanded));
      banner.hidden = false; banner.classList.add('show');
      if (focus) document.getElementById('cookieReject').focus();
    }
    function hide() { banner.hidden = true; banner.classList.remove('show'); if (returnFocus?.isConnected) returnFocus.focus(); }
    function save(analytics, external) {
      var revoked = (allows('analytics') && !analytics) || (allows('external') && !external);
      choice = { version: policyVersion, savedAt: Date.now(), analytics: analytics, external: external, marketing: false };
      try { localStorage.setItem(storageKey, JSON.stringify(choice)); localStorage.removeItem('novinko_cookie_consent_ga4_v1'); localStorage.removeItem('novinko_cookie_consent'); } catch (_) {}
      hide();
      if (!analytics) { window['ga-disable-' + measurementId] = true; clearAnalyticsCookies(); }
      if (revoked) { location.reload(); return; }
      enableAnalytics();
      window.dispatchEvent(new CustomEvent('novinko:consent-change'));
    }
    window.NovinkoConsent.open = function () { show(true, true); };
    document.getElementById('cookieAccept').onclick = function () { save(true, true); };
    document.getElementById('cookieReject').onclick = function () { save(false, false); };
    document.getElementById('cookieSave').onclick = function () { save(document.getElementById('consent-analytics').checked, document.getElementById('consent-external').checked); };
    document.getElementById('cookieClose').onclick = hide;
    customize.onclick = function () { details.hidden = !details.hidden; customize.setAttribute('aria-expanded', String(!details.hidden)); };
    banner.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    var settings = document.createElement('button');
    settings.type = 'button'; settings.className = 'cookie-reopen'; settings.textContent = 'Nastavenia cookies'; settings.setAttribute('data-cookie-settings', '');
    (document.querySelector('footer') || document.body).appendChild(settings);
    document.addEventListener('click', function (event) { if (event.target.closest('[data-cookie-settings]')) window.NovinkoConsent.open(); });
    window.addEventListener('storage', function (event) { if (event.key === storageKey || event.key === null) location.reload(); });
    // Legacy consent covered GA4 only; never silently expand it to new purposes.
    if (!choice) show(false, false);
    window.dispatchEvent(new CustomEvent('novinko:consent-change'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBanner); else initBanner();
})();
