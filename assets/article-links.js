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

  function renderBlocks(value, headings = false) {
    const lines = String(value ?? '').replace(/\r\n?/g, '\n').replace(/\s*¶¶\s*/g, '\n\n').split('\n');
    const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(cell => cell.trim().replace(/\\\|/g, '|'));
    const row = line => /^\s*\|.*\|\s*$/.test(line);
    const output = []; let paragraph = [];
    function flush() {
      const text = paragraph.join(' ').trim(); paragraph = [];
      if (text) output.push(headings && /^## [^\n]{1,120}$/.test(text) ? `<h2>${renderInline(text.slice(3))}</h2>` : `<p>${renderInline(text)}</p>`);
    }
    for (let i = 0; i < lines.length; i++) {
      let next = i + 1;
      while (next < lines.length && !lines[next].trim()) next++;
      if (row(lines[i]) && row(lines[next] || '') && cells(lines[next]).length === cells(lines[i]).length && cells(lines[next]).every(cell => /^:?-{3,}:?$/.test(cell))) {
        flush();
        const header = cells(lines[i]); const body = []; i = next;
        while (true) {
          let j = i + 1; while (j < lines.length && !lines[j].trim()) j++;
          if (!row(lines[j] || '') || cells(lines[j]).length !== header.length) break;
          body.push(cells(lines[j])); i = j;
        }
        output.push('<div class="article-table" role="region" aria-label="Tabuľka v článku" tabindex="0"><table><thead><tr>' + header.map(cell => `<th scope="col">${renderInline(cell)}</th>`).join('') + '</tr></thead><tbody>' + body.map(cells => '<tr>' + cells.map(cell => `<td>${renderInline(cell)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      } else if (!lines[i].trim()) flush();
      else paragraph.push(lines[i]);
    }
    flush(); return output.join('\n');
  }
  return { renderInline, renderBlocks, linkMarkup, normalizeUrl };
});
