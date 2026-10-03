// Spoločný súhlas pre verejné stránky. Google tag sa načíta až po súhlase.
(function () {
  'use strict';
  var measurementId = 'G-FGCPZ28E5C';
  // Nový analytický účel vyžaduje nový súhlas; pôvodné odmietnutie rešpektujeme.
  var storageKey = 'novinko_cookie_consent_ga4_v1';
  var choice = null;
  try {
    choice = localStorage.getItem(storageKey);
    if (!choice && localStorage.getItem('novinko_cookie_consent') === 'rejected') choice = 'rejected';
  } catch (_) {}

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  function enableAnalytics() {
    if (document.getElementById('novinko-ga4')) return;
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    // Jeden automatický page_view pri načítaní; zmeny histórie meria GA4 Enhanced Measurement.
    window.gtag('config', measurementId);
    var script = document.createElement('script');
    script.id = 'novinko-ga4';
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(script);
  }

  if (choice === 'accepted') enableAnalytics();

  function initBanner() {
    var banner = document.getElementById('cookieBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'cookie-banner';
      banner.id = 'cookieBanner';
      banner.innerHTML = '<div class="cookie-inner"><div class="cookie-text"><strong>Tento web používa cookies.</strong> Nevyhnutné cookies slúžia na fungovanie stránky. So súhlasom používame Google Analytics na meranie návštevnosti. Viac v <a href="/sukromie.html">Zásadách ochrany súkromia</a>.</div><div class="cookie-actions"><button class="cookie-btn cookie-btn-reject" id="cookieReject" type="button">Odmietnuť</button><button class="cookie-btn cookie-btn-accept" id="cookieAccept" type="button">Prijať všetko</button></div></div>';
      document.body.appendChild(banner);
    }
    function show() { banner.classList.add('show'); document.body.classList.add('cookie-open'); }
    function hide() { banner.classList.remove('show'); document.body.classList.remove('cookie-open'); }
    if (choice !== 'accepted' && choice !== 'rejected') setTimeout(show, 800);

    function save(value) {
      var previous = choice;
      choice = value;
      try {
        localStorage.setItem(storageKey, value);
        localStorage.setItem('novinko_cookie_consent', value);
      } catch (_) {}
      hide();
      if (value === 'accepted') enableAnalytics();
      else if (previous === 'accepted') {
        window.gtag('consent', 'update', { analytics_storage: 'denied' });
        // Basic Consent Mode: po odvolaní súhlasu odstránime už načítaný tag.
        location.reload();
      }
    }
    document.getElementById('cookieAccept').addEventListener('click', function () { save('accepted'); });
    document.getElementById('cookieReject').addEventListener('click', function () { save('rejected'); });
    document.querySelectorAll('[data-cookie-settings]').forEach(function (button) {
      button.addEventListener('click', show);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBanner);
  else initBanner();
})();
