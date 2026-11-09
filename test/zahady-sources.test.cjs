const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sources = require('../assets/zahady/sources');
const { validateMystery } = require('../netlify/lib/zahady');
const { articleToRow } = require('../netlify/lib/article-row');
const { renderClanok } = require('../netlify/lib/clanok-render');

const metadata = { subcategory: 'zahady', contentType: 'F', canonicalTopic: 'Chupacabra', imageKind: 'photo' };
const legacy = {
  name: '[1] Benjamin Radford – Skeptical Inquirer [2] Lauren Derby – Past & Present [3] McGill University [4] American Museum of Natural History [5] San Juan Star [6] A',
  url: 'https://skepticalinquirer.org/2020/06/tracking-the-chupacabra-twenty-five-years-later/ https://academic.oup.com/past/article/199/suppl_3/290/1480120 https://www.mcgill.ca/oss/article/critical-thinking-history/mythical-creature-known-chupacabra-walked-out-movie https://www.amnh.org/explore/ology/ology-cards/281-chupacabra https://www.princeton.edu/~accion/chupa27.html https://www.cbsnews.com/news/its-not-chupacabra-just-a-coyote/ https://texnat.tamu.edu/files/2021/10/Diseases-Chupacabra-2017.pdf',
};

test('oddelené názvy a číslované URL prežijú formulár, validáciu, hárok aj zobrazenie', () => {
  const htmlForm = fs.readFileSync(require.resolve('../publikovat.html'), 'utf8');
  const code = htmlForm.slice(htmlForm.indexOf('function doplnZahadyMetadata(data)'), htmlForm.indexOf("document.getElementById('f').addEventListener('submit'"));
  const context = { NovinkoSources: sources };
  vm.runInNewContext(code, context);
  const data = { ...metadata, sourceNames: '[1] FBI\r\n\r\n[2] Štúdia', sourceUrls: '[1] https://fbi.gov/case\r\n[2] https://example.org/paper?x=1&y=2' };
  context.doplnZahadyMetadata(data);
  const parsed = data.sources;
  const mystery = validateMystery({ ...metadata, sources: parsed });
  const row = articleToRow({ headline: 'Príbeh', body: 'Text.', category: 'zahady', sources: parsed, mystery }, 'zahady');
  assert.deepEqual(JSON.parse(row[9]).sources, parsed);
  const html = renderClanok({ title: 'Príbeh', category: 'zahady', content: 'Text.', mystery: JSON.parse(row[9]) });
  assert.match(html, /href="https:\/\/fbi.gov\/case"/);
  assert.match(html, /href="https:\/\/example.org\/paper\?x=1&amp;y=2"/);
  assert.equal((html.match(/<li><a href=/g) || []).length, 2);
});

test('chybné, zlepené alebo nespárované zdroje sa neodošlú', () => {
  assert.throws(() => sources.parse('FBI', ''), /1 až 12/);
  assert.throws(() => sources.parse('FBI', 'https://fbi.gov\nhttps://example.org'), /Počet/);
  assert.throws(() => sources.parse('FBI', 'https://fbi.gov https://example.org'), /jednu platnú URL/);
  assert.throws(() => sources.parse('[2] FBI', '[1] https://fbi.gov'), /Číslovanie/);
  for (const url of ['javascript:alert(1)', 'https://user:pass@example.org', 'https://example.org/https://other.org']) {
    assert.throws(() => sources.parse('Zdroj', url), /platnú URL/);
  }
  assert.throws(() => sources.parse('a'.repeat(161), 'https://example.org'), /160/);
  assert.throws(() => sources.parse(Array(13).fill('Zdroj').join('\n'), Array(13).fill('https://example.org').join('\n')), /1 až 12/);
  assert.throws(() => validateMystery({ ...metadata, sources: [legacy] }), /jeden platný odkaz/);
});

test('zlepené URL chupacabry sa zobrazia ako sedem samostatných odkazov', () => {
  const repaired = sources.normalize([legacy]);
  assert.equal(repaired.length, 7);
  assert.equal(repaired[0].name, 'Benjamin Radford – Skeptical Inquirer');
  assert.equal(repaired[5].name, 'cbsnews.com');
  assert.equal(repaired[6].name, 'texnat.tamu.edu');
  const html = renderClanok({ title: 'Chupacabra', category: 'zahady', content: 'Text.', mystery: { ...metadata, sources: [legacy] } });
  const section = html.match(/<div class="mystery-sources">([\s\S]*?)<\/div>/)[1];
  assert.equal((section.match(/<li>/g) || []).length, 7);
  for (const source of repaired) assert(section.includes(`href="${source.url}"`));
  assert.doesNotMatch(section, /href="[^"]* https:/);
});

test('načítanie článku a konceptu naplní editovateľné polia bez straty odkazov', () => {
  const form = { elements: { sourceNames: {}, sourceUrls: {} } };
  sources.fill(form, [legacy]);
  const parsed = sources.parse(form.elements.sourceNames.value, form.elements.sourceUrls.value);
  assert.deepEqual(parsed, sources.normalize([legacy]));
  sources.fill(form, [{ name: 'Nový zdroj', url: 'https://example.org/new' }]);
  assert.deepEqual(sources.parse(form.elements.sourceNames.value, form.elements.sourceUrls.value), [{ name: 'Nový zdroj', url: 'https://example.org/new' }]);
});

test('prehliadač aj server majú rovnaký parser a formulár používa nové polia', () => {
  const browser = { URL };
  vm.runInNewContext(fs.readFileSync(require.resolve('../assets/zahady/sources'), 'utf8'), browser);
  assert.equal(JSON.stringify(browser.NovinkoSources.parse('FBI', 'https://fbi.gov')), JSON.stringify(sources.parse('FBI', 'https://fbi.gov')));
  const html = fs.readFileSync(require.resolve('../publikovat.html'), 'utf8');
  assert.match(html, /<textarea name="sourceNames"/);
  assert.match(html, /<textarea name="sourceUrls"/);
  assert.doesNotMatch(html, /sourcesText/);
  for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(script[1]);
});
