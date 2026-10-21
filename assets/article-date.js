/* Shared publication date format for browser pages and Netlify rendering. */
(function (root) {
  'use strict';
  const dateFormat = new Intl.DateTimeFormat('sk-SK', {
    timeZone: 'Europe/Bratislava', day: 'numeric', month: 'numeric', year: 'numeric',
  });
  const timeFormat = new Intl.DateTimeFormat('sk-SK', {
    timeZone: 'Europe/Bratislava', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  function formatArticleDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return `${dateFormat.format(date)} · ${timeFormat.format(date)}`;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { formatArticleDate };
  else root.formatArticleDate = formatArticleDate;
})(typeof globalThis !== 'undefined' ? globalThis : this);
