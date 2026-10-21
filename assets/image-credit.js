/* One image-origin rule for cards and both article renderers. Returns plain text. */
(function (root) {
  'use strict';
  function describeImage(url, credit = '', kind = '') {
    credit = String(credit || '').trim();
    const normalized = credit.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const aiCredit = /\bai\b|umel\w* inteligenc\w*|vygenerovan\w*/.test(normalized);
    let type = ['ai', 'photo', 'archive', 'illustration'].includes(kind) ? kind : '';
    if (!type) {
      if (aiCredit) type = 'ai';
      else if (/\bilustrac/.test(normalized)) type = 'illustration';
      else if (credit) type = 'photo';
      // Known generated assets; an unknown/manual image must not be called AI by default.
      else if (/\/article-images\/(?:krypto|ai|ekonomika|svet|evergreen|horoskop|zahrada|recepty)\//i.test(url || '')
        || /\/assets\/horoskop-zverokruh\.webp(?:$|\?)/i.test(url || '')) type = 'ai';
    }
    if (type === 'ai') {
      const generic = /^(?:foto:\s*)?(?:ai ilustracia|ilustracny obrazok vytvoreny umelou inteligenciou)[.!]?$/i.test(normalized);
      const detail = credit.replace(/^foto:\s*/i, '');
      return { type, text: 'AI ilustrácia — nezobrazuje skutočnú udalosť' + (credit && !generic ? ` · ${detail}` : '') };
    }
    if (type === 'illustration') return { type, text: /^ilustrac/i.test(normalized) ? credit : `Ilustrácia${credit ? ': ' + credit : ''}` };
    if (type === 'archive') return { type, text: `Archívny obrázok${credit ? ': ' + credit : ''}` };
    return { type, text: credit ? (/^foto\s*:/i.test(credit) ? credit : `Foto: ${credit}`) : '' };
  }
  const api = { describeImage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NovinkoImages = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
