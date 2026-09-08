import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTriagePrompt, editorialOutcome, triageCandidate, validateTriageDecisions } from '../lib/_shared/editorial-triage.js';

test('candidate contains facts but no raw source text', () => {
  const row = triageCandidate({ id: 'a' }, {
    entity: 'AfD', event_type: 'election', location: 'Germany',
    facts: [{ statement: 'AfD získala 44 percent hlasov.' }],
  }, 75);
  assert.deepEqual(row, {
    id: 'a', entity: 'AfD', event_type: 'election', location: 'Germany',
    software_score: 75, facts: ['AfD získala 44 percent hlasov.'],
  });
  assert.match(buildTriagePrompt([row], []), /KANDIDÁTI/);
});

test('validates decisions, clamps numbers and ignores unknown ids', () => {
  const result = validateTriageDecisions({ decisions: [
    { id: 'a', decision: 'duplicate', priority: 120, confidence: 2, reason: 'rovnaké' },
    { id: 'b', decision: 'nonsense', priority: 50, confidence: .5 },
    { id: 'x', decision: 'new', priority: 60, confidence: .8 },
  ] }, ['a', 'b']);
  assert.deepEqual(result.get('a'), { decision: 'duplicate', priority: 100, confidence: 1, reason: 'rovnaké' });
  assert.equal(result.has('b'), false);
  assert.equal(result.has('x'), false);
});

test('manual rejection is hard, while a confident update may cross cooldown', () => {
  const update = { decision: 'update', priority: 80, confidence: .9, reason: 'konečný výsledok' };
  assert.equal(editorialOutcome({ decision: update, manualBlock: true, recentBlock: true, softwareScore: 75 }).reject, 'manual-cooldown');
  assert.deepEqual(
    editorialOutcome({ decision: update, manualBlock: false, recentBlock: true, softwareScore: 60 }),
    { reject: null, importance: 73, cooldownOverride: true },
  );
  assert.equal(editorialOutcome({
    decision: { decision: 'duplicate', priority: 70, confidence: .9 },
    manualBlock: false, recentBlock: false, softwareScore: 75,
  }).reject, 'duplicate');
});
