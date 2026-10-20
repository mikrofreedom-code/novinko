// Shared by server-rendered articles, the legacy article page and editor preview.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NovinkoLinks = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[c]);
  }

  function normalizeUrl(value) {
    const raw = String(value ?? '').trim();
    if (!/^https?:\/\//i.test(raw) || /[\s\u0000-\u001f\u007f]/u.test(raw)) return null;
    try {
      const url = new URL(raw);
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
      return url.href;
    } catch { return null; }
  }

  function linkMarkup(label, value) {
    const url = normalizeUrl(value);
    if (!url) throw new Error('Zadaj platný odkaz začínajúci https:// alebo http://, bez prihlasovacích údajov.');
    const text = String(label ?? '').replace(/[\r\n]+/g, ' ').trim() || url;
    // Escaped brackets keep selected text intact; encoded parentheses delimit URLs.
    return `[${text.replace(/[\\[\]]/g, '\\$&')}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
  }

  function renderInline(value) {
    const text = String(value ?? '');
    const tokens = /\[((?:\\.|[^\]\\\r\n])+)\]\((https?:\/\/(?:[^()\s<>]|\([^()\s<>]*\))*)\)|https?:\/\/[^\s<>"']+/gi;
    let html = '', end = 0, match;
    while ((match = tokens.exec(text))) {
      html += esc(text.slice(end, match.index));
      let label = match[1]?.replace(/\\([\\[\]])/g, '$1');
      let raw = match[2] || match[0], suffix = '';
      if (label === undefined) {
        // Sentence punctuation is not part of a pasted URL. Keep balanced brackets.
        const trailing = raw.match(/[.,;:!?]+$/)?.[0] || '';
        raw = raw.slice(0, raw.length - trailing.length); suffix = trailing;
        for (const [open, close] of [['(', ')'], ['[', ']'], ['{', '}']]) {
          let balance = [...raw].filter((c) => c === close).length - [...raw].filter((c) => c === open).length;
          while (balance > 0 && raw.endsWith(close)) {
            suffix = close + suffix; raw = raw.slice(0, -1); balance--;
          }
        }
        label = raw;
      }
      const url = normalizeUrl(raw);
      html += url
        ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>${esc(suffix)}`
        : esc(match[0]);
      end = tokens.lastIndex;
    }
    return html + esc(text.slice(end));
  }

  return { renderInline, linkMarkup, normalizeUrl };
});
