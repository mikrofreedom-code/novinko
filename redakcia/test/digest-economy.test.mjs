import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DIGEST_FEEDS } from '../lib/_shared/digest-feeds.js';
import { fetchFeed } from '../lib/_shared/rss.js';

test('economy has all 22 feeds; central banks are primary, media secondary', () => {
  const feeds = DIGEST_FEEDS.filter(f => f.section === 'ekonomika');
  assert.equal(feeds.length, 22);
  assert.equal(new Set(feeds.map(f => f.url)).size, 22);
  assert.deepEqual(feeds.filter(f => f.tier === 'P1').map(f => new URL(f.url).hostname).sort(), ['www.ecb.europa.eu', 'www.federalreserve.gov']);
  assert.equal(feeds.filter(f => f.tier === 'P2').length, 20);
});

test('HBR namespaced Atom retains titles, dates and resolves links to the publisher', async () => {
  const xml = '<ns6:feed xmlns:ns6="http://www.w3.org/2005/Atom"><ns6:title>HBR</ns6:title><ns6:entry><ns6:id>hbr-123</ns6:id><ns6:title>Economic strategy</ns6:title><ns6:link href="/2026/10/economic-strategy" rel="alternate"/><ns6:published>2026-10-21T12:25:11Z</ns6:published><ns6:summary>Business update</ns6:summary></ns6:entry></ns6:feed>';
  const [item] = await fetchFeed('http://feeds.hbr.org/harvardbusiness', xml);
  assert.equal(item.guid, 'hbr-123'); assert.equal(item.title, 'Economic strategy');
  assert.equal(item.link, 'https://hbr.org/2026/10/economic-strategy');
  assert.equal(Date.parse(item.published), Date.parse('2026-10-21T12:25:11Z'));
  const [rss] = await fetchFeed('https://example.org/feed', '<rss version="2.0"><channel><title>News</title><item><title>Rates</title><link>https://example.org/rates</link><guid>rates</guid><description>Rate update</description></item></channel></rss>');
  assert.equal(rss.title, 'Rates'); assert.equal(rss.link, 'https://example.org/rates');
  await assert.rejects(fetchFeed('http://feeds.hbr.org/harvardbusiness', '<!DOCTYPE feed><feed/>'), /Nepovolený/);
});

test('dry digest formats economy, prioritizes primary sources and tolerates a failed feed without AI or delivery', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'novinko-digest-test-'));
  try {
    const rssModule = `export async function fetchFeed(url) {
      if (url.includes('marketwatch')) throw new Error('fixture unavailable');
      return [{guid:'economy-test-'+url,title:'Fixture economic news',link:'https://example.org/'+encodeURIComponent(url),published:new Date().toISOString()}];
    }`;
    const aiModule = `export async function askFull() { throw new Error('AI must not run'); }`;
    const loader = `export async function resolve(specifier, context, next) {
      if (specifier.endsWith('/rss.js')) return {url:${JSON.stringify('data:text/javascript,' + encodeURIComponent(rssModule))},shortCircuit:true};
      if (specifier.endsWith('/ai-gateway.js')) return {url:${JSON.stringify('data:text/javascript,' + encodeURIComponent(aiModule))},shortCircuit:true};
      return next(specifier,context);
    }`;
    const loaderPath = join(dir, 'loader.mjs'); await writeFile(loaderPath, loader);
    const childEnv = {...process.env, DIGEST_TRANSLATE:'false', TELEGRAM_DIGEST_BOT_TOKEN:'', TELEGRAM_DIGEST_CHAT_ID:'', DIGEST_SECTION_CAP:'20', DIGEST_MAX_PER_FEED:'25'};
    delete childEnv.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ['--experimental-loader', loaderPath, 'scripts/digest.mjs', '--dry'], {
      cwd: new URL('../', import.meta.url), encoding: 'utf8', timeout: 15000,
      env: childEnv,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /📊 Ekonomika: 20 nových/);
    assert.match(result.stdout, /Federal Reserve – Press Releases/);
    assert.match(result.stdout, /ECB – Press Releases/);
    assert.match(result.stdout, /MarketWatch.*ekonomika.*fixture unavailable/);
    assert.match(result.stdout, /Cena tohto behu: \$0/);
    assert.doesNotMatch(result.stdout, /✅ odoslané/);
  } finally { await rm(dir, {recursive:true, force:true}); }
});
