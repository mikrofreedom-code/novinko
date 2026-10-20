const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matches, state } = require('../assets/crypto');

test('topic links use safe defaults and retain a valid view and topic', () => {
  assert.deepEqual(state(''), { view: 'spravy', topic: 'all' });
  assert.deepEqual(state('?rubrika=krypto&pohlad=trh&tema=bitcoin'), { view: 'trh', topic: 'bitcoin' });
  assert.deepEqual(state('?pohlad=%3Cscript%3E&tema=unknown'), { view: 'spravy', topic: 'all' });
});

test('Slovak inflections and accents work without changing the published feed', () => {
  const article = { title: 'Regulácia Bitcoinu: nové pravidlá', description: 'Bezpečnosť peňaženiek a staking Etherea.' };
  const original = JSON.stringify(article);
  for (const topic of ['bitcoin', 'ethereum', 'regulacia', 'bezpecnost', 'defi']) {
    assert.equal(matches(article, topic), true, topic);
  }
  assert.equal(matches(article, 'etf'), false);
  assert.equal(JSON.stringify(article), original);
});

test('short symbols must be whole words; missing fields are accepted', () => {
  assert.equal(matches({ title: 'Konsolidácia a výsledky spoločností' }, 'altcoiny'), false);
  assert.equal(matches({ title: 'SOL a XRP rastú' }, 'altcoiny'), true);
  assert.equal(matches({}, 'bitcoin'), false);
  assert.equal(matches({}, 'all'), true);
  assert.equal(matches({ description: 'Prílev do ETF' }, 'etf'), true);
});
