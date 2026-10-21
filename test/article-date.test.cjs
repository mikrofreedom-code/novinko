const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { formatArticleDate } = require('../assets/article-date');

test('publication dates use Slovak local time in summer and winter', () => {
  assert.equal(formatArticleDate('2026-10-21T12:35:00Z'), '21. 10. 2026 · 14:35');
  assert.equal(formatArticleDate('2026-12-21T12:35:00Z'), '21. 12. 2026 · 13:35');
  assert.equal(formatArticleDate('2026-10-21T22:05:00Z'), '22. 10. 2026 · 00:05');
});

test('missing and invalid publication dates stay empty', () => {
  for (const value of ['', null, undefined, 'invalid']) assert.equal(formatArticleDate(value), '');
});

test('browser and server format the same publication date', () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(require.resolve('../assets/article-date'), 'utf8'), context);
  const date = '2026-10-25T01:30:00Z';
  assert.equal(context.formatArticleDate(date), formatArticleDate(date));
  assert.equal(formatArticleDate(date), '25. 10. 2026 · 02:30');
});
