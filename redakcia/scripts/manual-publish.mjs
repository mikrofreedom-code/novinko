// RUČNÝ PUBLISH — z draft súboru spraví článok a nasadí ho na web (hárok) + Telegram.
// Pre obsah, ktorý nezbiera pipeline (napr. policajné správy zadané ručne).
//
//   node --env-file=.env scripts/manual-publish.mjs drafts/manual/nehoda.md
//   node --env-file=.env scripts/manual-publish.mjs drafts/manual/nehoda.md --image   # + AI ilustrácia
//   node --env-file=.env scripts/manual-publish.mjs drafts/manual/nehoda.md --dry      # len ukáž, nepublikuj
//
// LEGAL: publikuj len ORIGINÁLNY text z oficiálnych faktov + atribúcia „podľa X".
// Nekopíruj cudzie články/FB posty. Pri krimi: prezumpcia neviny, len oficiálne fakty.

import fs from 'node:fs/promises';
import { db } from '../lib/_shared/queue.js';
import { articleToRow, appendArticleRow } from '../lib/_shared/sheets.js';
import { sendArticle } from '../lib/_shared/telegram.js';
import { generateImage } from '../lib/_shared/images.js';
import { ask } from '../lib/_shared/ai-gateway.js';

const SITE_URL = process.env.SITE_URL || 'https://novinko.sk';

// ---- parse draft: frontmatter (key: value) medzi --- a --- , potom telo ----
function parseDraft(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('draft musí mať frontmatter medzi --- a --- , potom telo');
  const fm = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const body = m[2].trim();
  if (!fm.headline || !body) throw new Error('chýba headline alebo telo');
  return { fm, body };
}

const IMG_SYSTEM = `You write a SHORT visual prompt for an editorial news illustration.
Output ONLY the prompt, one line, IN ENGLISH, no quotes, max ~25 words. Symbolic, conceptual scene for the topic.
Strict: NO text/letters, NO real or recognizable people, NO logos/brands. Clean, modern, editorial.`;

async function imagePrompt(a) {
  try {
    const raw = await ask({
      tier: 'cheap', agent: 'manual-publish', system: IMG_SYSTEM,
      prompt: `Section: ${a.category}\nHeadline: ${a.headline}\nSummary: ${a.perex ?? ''}`,
      maxTokens: 90, temperature: 0.6,
    });
    const p = String(raw || '').trim().split('\n')[0].replace(/^["'`]+|["'`]+$/g, '').trim();
    return p.length > 8 ? `${p}, editorial illustration, dark modern background, no text, no logos, no real people` : null;
  } catch { return null; }
}

function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'manual';
}

async function main() {
  const file = process.argv[2];
  if (!file) { console.error('použitie: manual-publish.mjs <draft.md> [--image] [--dry]'); process.exit(1); }
  const withImage = process.argv.includes('--image');
  const dry = process.argv.includes('--dry');

  const { fm, body } = parseDraft(await fs.readFile(file, 'utf8'));
  const category = fm.category || 'slovensko';
  const article = {
    headline: fm.headline,
    perex: fm.perex || null,
    body,
    category,
    section: category,
    entity: fm.entity || null,
    sources: [{ name: fm.source || 'Novinko', url: fm.source_url || '', type: (fm.source_type || 'primary') }],
    image_url: '',
    generated_by: 'manual',
  };

  if (withImage) {
    const prompt = await imagePrompt(article);
    article.image_url = await generateImage(article.headline, `manual-${slugify(article.headline)}`, { section: category, prompt: prompt || undefined });
    console.log('obrázok:', article.image_url || '(zlyhal)');
  }

  console.log(`\n📰 ${article.headline}\n   kategória: ${category} · zdroj: ${article.sources[0].name}`);
  console.log(`   ${article.perex || ''}`);

  if (dry) { console.log('\n(dry-run — nič sa nepublikovalo)'); process.exit(0); }

  const row = articleToRow(article, category);
  await appendArticleRow(row);
  const tg = await sendArticle(article, row[0]);
  // audit záznam do fronty (kvôli prehľadu; terminálny status)
  await db.from('queue').insert({
    source_id: null, status: 'published',
    raw_data: { _src: 'manual', day: new Date().toISOString().slice(0, 10) },
    article,
  }).catch(() => {});

  console.log(`\n✅ publikované → ${SITE_URL}/clanok.html?id=${row[0]}`);
  console.log(`   telegram: ${tg.sent ? 'poslané' : (tg.skipped || tg.error)}`);
  console.log('   (na webe do ~10 min po obnovení cache)');
  process.exit(0);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
