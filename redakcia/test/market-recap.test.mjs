import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL ??= 'http://127.0.0.1:1';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-only-key';
const { run } = await import('../lib/flow/13-market-recap.js');

test('disabled recap never fetches data or calls AI, even with force', async () => {
  const original = process.env.MARKET_RECAP_ENABLED;
  const fetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected network request'); };
  try {
    for (const value of [undefined, 'false']) {
      if (value === undefined) delete process.env.MARKET_RECAP_ENABLED;
      else process.env.MARKET_RECAP_ENABLED = value;
      assert.match((await run()).skipped, /vypnutý/);
      assert.match((await run({ force: true })).skipped, /vypnutý/);
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = fetch;
    if (original === undefined) delete process.env.MARKET_RECAP_ENABLED;
    else process.env.MARKET_RECAP_ENABLED = original;
  }
});
