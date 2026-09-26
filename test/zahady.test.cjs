const test = require('node:test');
const assert = require('node:assert/strict');
const { validateMystery, parseMeta, normalizeTopic, sameTopic } = require('../netlify/lib/zahady');
const { articleToRow } = require('../netlify/lib/article-row');
const { renderClanok, clanokUrl } = require('../netlify/lib/clanok-render');
const { validArticleImageUrl } = require('../netlify/lib/zahady');

test('obrázky povoľujú pripravené aktíva a odmietajú cudzie adresy', () => {
  assert.equal(validArticleImageUrl('https://novinko.sk/assets/zahady/clanky/tarot.webp'), true);
  assert.equal(validArticleImageUrl('https://abc.supabase.co/storage/v1/object/public/a.webp'), true);
  for (const url of ['http://novinko.sk/assets/zahady/clanky/tarot.webp', 'https://novinko.sk.evil.org/assets/zahady/clanky/tarot.webp', 'https://user@novinko.sk/assets/zahady/clanky/tarot.webp', 'https://novinko.sk/secret.webp']) assert.equal(validArticleImageUrl(url), false);
});

test('všetky úvodné koncepty prejdú validáciou a vykreslia podnadpisy', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(__dirname, '../redakcia/content/zahady/start');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.facts.json'));
  assert.equal(files.length, 3);
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const mystery = validateMystery(d);
    assert.equal(validArticleImageUrl(d.imageUrl), true);
    assert.ok(fs.existsSync(path.join(__dirname, '..', new URL(d.imageUrl).pathname)));
    const html = renderClanok({ title: d.headline, content: d.text, category: 'zahady', mystery });
    assert.match(html, /<h2>/);
    assert.match(html, /<ol>/);
    assert.doesNotMatch(html, /<p>## /);
  }
});

const input = {
  subcategory: 'magia', contentType: 'L', series: 'slovensko',
  canonicalTopic: 'Legenda o zámku', topicAliases: 'Starý zámok, povesť o zámku',
  imageKind: 'archive', seoTitle: 'Legenda o zámku', metaDescription: 'Pôvod miestnej legendy.',
  sources: [{ name: 'Archív', url: 'https://example.org/pramen' }, { name: 'Múzeum', url: 'https://example.org/studia' }],
};

test('metadáta rubriky zachovajú zdroje a odlíšia tému od titulku', () => {
  const mystery = validateMystery(input);
  const row = articleToRow({ headline: 'Čo hovorí povesť?', perex: 'Príbeh.', body: 'Text.', category: 'zahady', sources: mystery.sources, mystery }, 'zahady');
  assert.equal(row.length, 10);
  assert.equal(row[6], 'zahady');
  assert.equal(row[4], 'Archív | https://example.org/pramen');
  assert.deepEqual(parseMeta(row[9]).sources, input.sources);
  assert.equal(parseMeta(row[9]).canonicalTopic, 'Legenda o zámku');
});

test('staré články majú prázdny desiaty stĺpec', () => {
  const row = articleToRow({ headline: 'Správa', body: 'Text', category: 'svet' }, 'svet');
  assert.equal(row[9], '');
  assert.deepEqual(parseMeta(row[9]), {});
});

test('neplatný zdroj alebo typ obsahu neprejde', () => {
  assert.throws(() => validateMystery({ ...input, sources: [{ name: 'Zlý', url: 'javascript:alert(1)' }] }), /platný odkaz/);
  assert.throws(() => validateMystery({ ...input, contentType: 'X' }), /platný typ/);
});

test('článok ukazuje viac zdrojov, legendu a správne označenie AI ilustrácie', () => {
  const mystery = { ...validateMystery(input), imageKind: 'ai', slug: 'povest-o-zamku' };
  const article = {
    id: '123456789', title: 'Povesť o zámku', perex: 'Pôvod príbehu.', content: 'Doložené fakty.',
    date: '2026-09-25T10:00:00.000Z', category: 'zahady', imageUrl: 'https://example.org/obrazok.webp', mystery,
  };
  const html = renderClanok(article);
  assert.match(html, /Pramene a zdroje/);
  assert.match(html, /Legenda alebo tradícia/);
  assert.match(html, /AI ilustrácia — nezobrazuje skutočnú udalosť/);
  assert.match(html, /Múzeum/);
  assert.equal(clanokUrl(article), 'https://novinko.sk/clanok/povest-o-zamku-123456789');
  assert.equal(normalizeTopic('Loď Mary Celeste'), 'lod mary celeste');
  assert.equal(sameTopic('Záhada lode Mary Celeste', 'Čo sa stalo posádke Mary Celeste?'), true);
  assert.equal(sameTopic('Záhada lode Mary Celeste', 'Legenda o Čachtickom hrade'), false);
});
