/* Deterministic topic overlap within a section; also connects Krypto with its school. */
(function (root) {
  'use strict';
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const stop = new Set('ktore ktory ktora ktori tieto tento tato toho tomu roku rokov dnes teraz podla medzi pred bude budu moze mozu nove nova novy preco znamena prinasa viac menej svoje jeho tieto vsetky'.split(' '));
  function terms(article) {
    const text = normalize(`${article.title || ''} ${article.perex || ''}`);
    const words = new Set((text.match(/[a-z]{4,}/g) || []).filter(word => !stop.has(word)));
    // Shared roots join common inflected forms and abbreviations without an AI classifier.
    for (const [key, pattern] of [
      ['bitcoin', /\b(?:bitcoin\w*|btc)\b/], ['ethereum', /\b(?:ethereum\w*|ether\w*|eth)\b/],
      ['etf', /\betf\b/], ['inflacia', /\binflac\w*/], ['hypoteky', /\bhypotek\w*/],
      ['sadzby', /\b(?:sadzb\w*|urok\w*|ecb|fed)\b/],
    ]) if (pattern.test(text)) words.add(key);
    return words;
  }
  function selectRelated(article, articles, limit = 3) {
    const crypto = ['krypto', 'krypto-skola'].includes(article.category);
    const subject = terms(article);
    const seen = new Set([String(article.id)]);
    const candidates = [];
    for (const candidate of articles) {
      const id = String(candidate.id);
      if (!candidate.id || seen.has(id)) continue;
      seen.add(id);
      const sameCategory = candidate.category === article.category;
      if (!sameCategory && !(crypto && ['krypto', 'krypto-skola'].includes(candidate.category))) continue;
      const overlap = [...terms(candidate)].filter(word => subject.has(word)).length;
      if (!sameCategory && overlap === 0) continue;
      const subcategory = article.mystery?.subcategory;
      const score = overlap * 3 + (subcategory && candidate.mystery?.subcategory === subcategory ? 2 : 0);
      candidates.push({ candidate, score });
    }
    return candidates.sort((a, b) => b.score - a.score
      || (Date.parse(b.candidate.date) || 0) - (Date.parse(a.candidate.date) || 0)
      || String(a.candidate.id).localeCompare(String(b.candidate.id)))
      .slice(0, limit).map(row => row.candidate);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { selectRelated };
  else root.NovinkoRelated = { selectRelated };
})(typeof globalThis !== 'undefined' ? globalThis : this);
