const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { parseCSV, parseCSVLine, splitCSVRecords } = require('../netlify/lib/csv');

const header = ['id','title','perex','content','source','date','category','image','credit','meta'];
const originalDate = '2026-09-22T07:08:06.140Z';
const article = ['179006088613901','Staršia analýza','Úvod článku.\nDáta boli skontrolované 22. septembra.','Text s "citáciou", čiarkou\na ďalším riadkom.','Novinko',originalDate,'krypto','','',''];
const encode = rows => rows.map(row => row.map(value => '"' + value.replaceAll('"','""') + '"').join(',')).join('\r\n');
const csv = encode([header,article]);

test('CSV zachová viacriadkové bunky, dátum a počet článkov', () => {
  const records = splitCSVRecords('\ufeff' + csv + '\r\n\r\n');
  assert.equal(records.length, 2);
  assert.deepEqual(parseCSVLine(records[1]), article);
  assert.equal(parseCSV(csv)[0].date, originalDate);
  assert.equal(parseCSV(csv)[0].content, article[3]);
});

test('prehliadač používa rovnaké delenie CSV záznamov', () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(require.resolve('../assets/csv-records.js'),'utf8'), context);
  assert.equal(context.splitCSVRecords(csv).length, 2);
  for (const page of ['clanok.html','archiv.html']) {
    const html = readFileSync(require.resolve('../'+page),'utf8');
    assert.match(html, /src="\/assets\/csv-records.js"/);
    assert.match(html, /splitCSVRecords\(csv\)/);
  }
});

test('obnova feedu neomladzuje starý článok ani článok bez dátumu', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-09-27T18:00:00Z'));
  const noDate = [...article]; noDate[0] = '2'; noDate[1] = 'Bez dátumu'; noDate[5] = '';
  const invalidDate = [...article]; invalidDate[0] = '3'; invalidDate[1] = 'Neplatný dátum'; invalidDate[5] = 'neznámy';
  const net = require('../netlify/lib/net');
  t.mock.method(net, 'fetchUrl', async () => encode([header,article,noDate,invalidDate]));
  delete require.cache[require.resolve('../netlify/lib/sheets')];
  const { fetchSheetItems } = require('../netlify/lib/sheets');
  for (let run = 0; run < 2; run++) {
    const items = await fetchSheetItems({all:true});
    assert.equal(items.length, 3);
    assert.equal(items.find(i=>i.id===article[0]).pubDate, originalDate);
    assert.equal(items.find(i=>i.id==='2').pubDate, '');
    assert.equal(items.find(i=>i.id==='3').pubDate, '');
  }
  assert.equal((await fetchSheetItems()).length, 0);
});

test('detail a sitemap čítajú pôvodný dátum aj cez viacriadkový perex', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(csv));
  const detail = await require('../netlify/functions/clanok').handler({queryStringParameters:{id:article[0]}});
  assert.equal(detail.statusCode, 200);
  assert.ok(detail.body.includes(originalDate));
  const sitemap = await require('../netlify/functions/sitemap').handler({});
  assert.equal(sitemap.statusCode, 200);
  assert.ok(sitemap.body.includes('2026-09-22'));
});
