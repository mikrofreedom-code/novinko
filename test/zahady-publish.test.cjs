const test = require('node:test');
const assert = require('node:assert/strict');

process.env.MANUAL_PUBLISH_SECRET = 'test-secret';
process.env.GOOGLE_SHEETS_ID = 'test-sheet';
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = '{}';

let existing = null;
let duplicate = null;
const writes = [];
const updates = [];
function mock(relative, exports) {
  const filename = require.resolve(relative);
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
mock('../netlify/lib/sheets', {
  findMysteryTopic: async () => duplicate,
  findSheetArticle: async () => existing,
  updateSheetArticle: async (_id, _key, rowNumber, row) => { updates.push({ rowNumber, row }); },
  appendRow: async (_id, row) => { writes.push(row); },
});
mock('../netlify/lib/topics', { syncMysteryTopic: async () => ({ synced: true }) });
mock('../netlify/lib/telegram', { sendArticle: async () => ({ skipped: 'off' }) });
mock('../netlify/lib/images', { generateImage: async () => '', uploadUserImage: async () => '' });
mock('../netlify/lib/store', {
  connect: () => {}, recentFailures: async () => 0, recordFailure: async () => {}, clearFailures: async () => {},
  RL_MAX_FAILURES: 8, loadScheduled: async () => [], saveScheduled: async () => {},
});

const { handler } = require('../netlify/functions/manual-publish');
const base = {
  password: 'test-secret', category: 'zahady', headline: 'Príbeh starej veže', perex: 'Čo o veži vieme?',
  text: 'Doložené fakty a pôvod legendy.', subcategory: 'legendy', contentType: 'L', series: 'slovensko',
  canonicalTopic: 'Stará veža', topicAliases: 'Legenda o starej veži', imageKind: 'archive',
  imageUrl: 'https://test.supabase.co/storage/v1/object/public/archiv/veza.webp', imageCredit: 'Mestský archív',
  sources: [{ name: 'Archív', url: 'https://example.org/archiv' }],
};
const request = (body) => handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(body) });

test('ručný článok prejde do hárku s metadátami a registráciou témy', async () => {
  const res = await request(base);
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][6], 'zahady');
  assert.equal(JSON.parse(writes[0][9]).canonicalTopic, 'Stará veža');
});

test('duplicitná téma sa nezverejní', async () => {
  duplicate = { id: '123456789', title: 'Stará veža' };
  const res = await request(base);
  assert.equal(res.statusCode, 409);
  assert.equal(writes.length, 1);
  duplicate = null;
});

test('úprava zachová ID, dátum a adresu článku', async () => {
  const originalRow = [...writes[0]];
  existing = { row: originalRow, rowNumber: 5 };
  const loaded = await request({ action: 'load', password: 'test-secret', articleId: originalRow[0] });
  assert.equal(loaded.statusCode, 200);
  assert.equal(JSON.parse(loaded.body).article.canonicalTopic, 'Stará veža');
  const res = await request({ ...base, articleId: originalRow[0], headline: 'Nové poznatky o veži' });
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).updated, true);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].row[0], originalRow[0]);
  assert.equal(updates[0].row[5], originalRow[5]);
  assert.equal(JSON.parse(updates[0].row[9]).slug, JSON.parse(originalRow[9]).slug);
  assert.equal(writes.length, 1);
});

test('nový redakčný uhol vyžaduje zapísaný dôvod', async () => {
  existing = null;
  duplicate = { id: writes[0][0], title: writes[0][1] };
  const res = await request({ ...base, newAngleReason: 'Nové archívne dokumenty zásadne menia chronológiu udalosti.' });
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 2);
  assert.match(JSON.parse(writes[1][9]).newAngleReason, /archívne dokumenty/);
});
