const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matches, state } = require('../assets/economy');

test('economy links have safe defaults and retain a valid topic', () => {
  assert.deepEqual(state(''), { view: 'spravy', topic: 'all' });
  assert.deepEqual(state('?pohlad=trhy&tema=sadzby'), { view: 'trhy', topic: 'sadzby' });
  assert.deepEqual(state('?pohlad=<script>&tema=missing'), { view: 'spravy', topic: 'all' });
});

test('Slovak accents and inflections classify existing titles and perexes', () => {
  const article = { title: 'Slovenské firmy čakajú zmeny cien energií', description: 'Inflácia ovplyvňuje mzdy, úvery a úrokové sadzby.' };
  const original = JSON.stringify(article);
  for (const topic of ['slovensko', 'firmy', 'inflacia', 'energie', 'praca', 'sadzby']) assert(matches(article, topic), topic);
  assert.equal(matches(article, 'europa'), false);
  assert.equal(JSON.stringify(article), original);
});

test('word boundaries avoid common false matches and missing fields are safe', () => {
  assert.equal(matches({ title: 'Centrálna banka oznámila rozhodnutie' }, 'inflacia'), false);
  assert.equal(matches({ title: 'Koniec federácie klubov' }, 'sadzby'), false);
  assert.equal(matches({ title: 'ECB znižuje sadzby' }, 'sadzby'), true);
  assert.equal(matches({ description: 'Eurozóna a nemecká ekonomika' }, 'europa'), true);
  assert.equal(matches({}, 'all'), true);
  assert.equal(matches({}, 'slovensko'), false);
});

test('wages do not match payments or platforms, and federal news needs a central bank context', () => {
  for (const title of ['Platby kartou rastú', 'Platforma získala investíciu', 'Platnosť zmluvy vypršala']) {
    assert.equal(matches({ title }, 'praca'), false, title);
  }
  for (const title of ['Vyšší plat pre zamestnancov', 'Vývoj platov', 'Zmeny platových tabuliek', 'Rast platu']) {
    assert.equal(matches({ title }, 'praca'), true, title);
  }
  assert.equal(matches({ title: 'Federálna vláda mení obchodnú politiku' }, 'sadzby'), false);
  assert.equal(matches({ title: 'Federálny rezervný systém oznámil rozhodnutie' }, 'sadzby'), true);
});
