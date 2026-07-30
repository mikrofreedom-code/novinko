// Cron entry point pre krok 05 Verification.
import { claim, advance } from '../../lib/_shared/queue.js';
import { run } from '../../lib/flow/05-verification.js';
export default async () => {
  const items = await claim('collected', 10);
  for (const it of items) {
    try { const facts = await run(it); await advance(it.id, 'facts_ready', { facts }); }
    catch (e) { await advance(it.id, 'error', { error: String(e) }); }
  }
  return new Response(JSON.stringify({ step: 'verification', processed: items.length }));
};
