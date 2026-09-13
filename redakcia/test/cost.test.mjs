import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

// Testy nesmú siahnuť na produkčnú DB: falošná URL a podvrhnutý db.from.
process.env.SUPABASE_URL ??= 'http://127.0.0.1:1';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-only-key';

const { db } = await import('../lib/_shared/queue.js');
const { todaySpendUsd, logCost } = await import('../lib/_shared/cost.js');

let odpoved;
db.from = () => ({
  select: () => ({ gte: async () => odpoved.select }),
  insert: async () => odpoved.insert,
});
mock.timers.enable({ apis: ['Date'], now: new Date(2026, 8, 13, 12).getTime() });
mock.method(console, 'error', () => {});

// Poradie testov je zámerné — cost.js drží stav cache medzi volaniami.

test('bez overeného nákladu guard zastaví platené volanie', async () => {
  odpoved = { select: { data: null, error: { message: 'db down' } } };
  await assert.rejects(todaySpendUsd(), /budget guard/);
});

test('nezapísaný náklad sa pri ďalšom obnovení zo súčtu nestratí', async () => {
  odpoved = {
    select: { data: [{ cost_usd: 0.5 }], error: null },
    insert: { error: { message: 'insert down' } },
  };
  assert.equal(await todaySpendUsd(), 0.5);
  await logCost({ agent: 'test', model: 'claude-haiku-4-5', usage: { input_tokens: 1_000_000, output_tokens: 0 } });
  mock.timers.tick(61_000);
  assert.equal(await todaySpendUsd(), 1.5);
});

test('krátky výpadok DB použije poslednú overenú hodnotu, dlhý zastaví', async () => {
  odpoved = { select: { data: null, error: { message: 'db down' } } };
  mock.timers.tick(61_000);
  assert.equal(await todaySpendUsd(), 1.5);
  mock.timers.tick(10 * 60_000);
  await assert.rejects(todaySpendUsd(), /budget guard/);
});
