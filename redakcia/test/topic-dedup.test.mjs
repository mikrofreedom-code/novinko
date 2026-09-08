import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blocksTopic,
  canonicalEntity,
  handledTopicKeys,
  manuallyRejectedTopicKeys,
  topicKey,
} from '../lib/_shared/topic-dedup.js';

test('normalizes translated names through their acronym', () => {
  assert.equal(canonicalEntity('Alternative for Germany (AfD)'), 'afd');
  assert.equal(canonicalEntity('Alternative für Deutschland (AfD)'), 'afd');
  assert.equal(canonicalEntity('AfD'), 'afd');
});

test('builds the same topic key for translated entity names', () => {
  const a = { section: 'svet', entity: 'Alternative for Germany (AfD)', event_type: 'election' };
  const b = { section: 'svet', entity: 'Alternative für Deutschland (AfD)', event_type: 'election' };
  assert.equal(topicKey(a), topicKey(b));
});

test('does not collapse unrelated entity-less events', () => {
  assert.equal(topicKey({ section: 'svet', entity: null, event_type: 'disaster' }), null);
});

test('manual rejection blocks a topic but a technical rejection does not', () => {
  const base = { article: { headline: 'x' }, facts: { section: 'svet', entity: 'AfD', event_type: 'election' } };
  assert.equal(blocksTopic({ ...base, status: 'rejected', error: '12-publisher: zamietnuté ručne cez Telegram' }), true);
  assert.equal(blocksTopic({ ...base, status: 'rejected', error: '09-legal: atribúcia' }), false);
  assert.equal(blocksTopic({ ...base, status: 'published' }), true);
  assert.deepEqual([...handledTopicKeys([{ ...base, status: 'published' }])], ['svet|afd|election']);
  assert.deepEqual(
    [...manuallyRejectedTopicKeys([{ ...base, status: 'rejected', error: '12-publisher: zamietnuté ručne cez Telegram' }])],
    ['svet|afd|election'],
  );
});
