const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { renderInline, linkMarkup } = require('../assets/article-links');
const { renderClanok } = require('../netlify/lib/clanok-render');
const { paragraphsToCell } = require('../netlify/lib/article-row');

test('odkaz z označených slov prežije zápis do hárku a vykreslí sa v článku', () => {
  const markup = linkMarkup('pôvodná štúdia', 'https://example.com/paper?x=1&y=2');
  const content = paragraphsToCell(`Pozri ${markup}.\n\nĎalší odsek.`);
  const html = renderClanok({ title: 'Správa', content, category: 'svet' });
  assert.match(html, /Pozri <a href="https:\/\/example\.com\/paper\?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">pôvodná štúdia<\/a>\./);
  assert.match(html, /<p>Ďalší odsek\.<\/p>/);
});

test('priamo vložené URL zachovajú koncovú interpunkciu mimo odkazu', () => {
  const html = renderInline('Zdroj (https://example.com/a), druhý https://example.com/wiki/A_(B).');
  assert.match(html, /href="https:\/\/example\.com\/a"[^>]*>https:\/\/example\.com\/a<\/a>\),/);
  assert.match(html, /href="https:\/\/example\.com\/wiki\/A_\(B\)"[^>]*>https:\/\/example\.com\/wiki\/A_\(B\)<\/a>\./);
  assert.equal((html.match(/<a /g) || []).length, 2);
});

test('text odkazu so zátvorkami a URL so zátvorkami sa zobrazia správne', () => {
  const html = renderInline(linkMarkup('Výsledky [1] \\ detaily', 'https://example.com/A_(B)'));
  assert.match(html, /href="https:\/\/example\.com\/A_%28B%29"/);
  assert.match(html, />Výsledky \[1\] \\ detaily<\/a>/);
  assert.match(renderInline('[štúdia](https://example.com/A_(B))'), />štúdia<\/a>/);
});

test('nepovolí skripty, HTML injekciu, prihlasovacie údaje ani riadiace znaky v URL', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hello', '//example.com', '/local', 'https://user:password@example.com', 'https://example.com/\npath']) {
    assert.throws(() => linkMarkup('odkaz', url));
  }
  assert.equal(renderInline('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.doesNotMatch(renderInline('[klik](javascript:alert(1)) [x](data:text/html,test)'), /<a /);
  const html = renderInline(linkMarkup('<img src=x onerror=alert(1)>', 'https://example.com/?x="><svg/onload=alert(1)>'));
  assert.doesNotMatch(html, /<img|<svg/);
  assert.match(html, /%22%3E%3Csvg/);
  assert.match(html, /target="_blank" rel="noopener noreferrer">&lt;img/);
});

test('server a prehliadač používajú rovnaké vykreslenie, obyčajný text sa nemení', () => {
  const browser = { URL };
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/article-links'), 'utf8'), browser);
  for (const text of ['Obyčajný text & číslo 42.', '[NASA](https://nasa.gov)', 'https://example.com/?a=1&b=2', '[1] bez odkazu']) {
    assert.equal(browser.NovinkoLinks.renderInline(text), renderInline(text));
  }
  assert.equal(renderInline('Obyčajný text & číslo 42.'), 'Obyčajný text &amp; číslo 42.');
});

test('odkazy fungujú aj v podnadpisoch Záhad a v receptoch', () => {
  const mystery = renderClanok({ title: 'Príbeh', category: 'zahady', content: '## [Archív](https://example.com)\n\nText.' });
  assert.match(mystery, /<h2><a [^>]+>Archív<\/a><\/h2>/);
  const recipe = renderClanok({ title: 'Recept', category: 'recepty', content: 'Pozri [tip](https://example.com). ¶¶ Suroviny: ¶¶ múka ¶¶ Postup: ¶¶ 1. Pozri https://example.com/postup' });
  assert.match(recipe, /<p class="recept-intro">Pozri <a /);
  assert.match(recipe, /href="https:\/\/example\.com\/postup"/);
});
