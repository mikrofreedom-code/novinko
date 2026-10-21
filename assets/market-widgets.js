/* Shared lazy TradingView loader. Each config is mounted once. */
(function (root) {
  'use strict';
  function mount(container, fallbackUrl = 'https://www.tradingview.com/') {
    container.querySelectorAll('script[data-widget-src]').forEach(config => {
      if (config.dataset.mounted) return;
      config.dataset.mounted = 'true';
      const script = document.createElement('script');
      script.src = config.dataset.widgetSrc;
      script.async = true;
      script.textContent = config.textContent;
      function showMessage(text) {
        const host = config.parentElement;
        if (!host || host.querySelector('.crypto-widget-error')) return;
        const message = document.createElement('p');
        message.className = 'crypto-empty crypto-widget-error';
        message.textContent = text;
        const link = document.createElement('a');
        link.href = config.dataset.widgetFallback || fallbackUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'prehľad na TradingView ↗';
        message.appendChild(link);
        host.prepend(message);
      }
      const slowTimer = setTimeout(() => showMessage('Načítanie trhových údajov trvá dlhšie. Otvoriť '), 12000);
      script.addEventListener('load', () => {
        clearTimeout(slowTimer);
        config.parentElement?.querySelector('.crypto-widget-error')?.remove();
      }, { once: true });
      script.addEventListener('error', () => {
        clearTimeout(slowTimer);
        config.parentElement?.querySelector('.crypto-widget-error')?.remove();
        showMessage('Trhové údaje sa nepodarilo načítať. Obnovte stránku alebo otvorte ');
      }, { once: true });
      config.parentElement.appendChild(script);
    });
  }
  root.NovinkoWidgets = { mount };
})(window);
