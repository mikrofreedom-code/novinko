// EVERGREEN ROTÁCIA — „Krypto škola".
// Nadčasové vysvetlivky uložené ako súbory v content/krypto-skola/*.md.
// Raz za EVERGREEN_CADENCE_DAYS vytiahne tú, čo sa najdlhšie neukázala, a
// publikuje ju na hlavnú (rovnaký hárok ako bežné články). Bez AI textu;
// obrázok sa generuje RAZ a kešuje (opätovné publikovanie je zadarmo).
//
// Stav „kedy bola ktorá naposledy" sa neukladá zvlášť — číta sa z fronty
// (záznamy s raw_data._src='evergreen'). Žiadny extra state súbor.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './queue.js';
import { articleToRow, appendArticleRow } from './sheets.js';
import { generateImage } from './images.js';
import { sendArticle } from './telegram.js';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../content/krypto-skola');
const DAY = 86_400_000;
const CADENCE_DAYS = Number(process.env.EVERGREEN_CADENCE_DAYS ?? 2.5);  // ako často sa smie objaviť ďalšia
const NO_REPEAT_DAYS = Number(process.env.EVERGREEN_NO_REPEAT_DAYS ?? 12); // ten istý článok nie skôr než...

// ---------- Knižnica ----------
function parseDoc(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const front = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) front[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const body = m[2].trim();
  if (!front.slug || !front.headline || !body) return null;
  return { slug: front.slug, headline: front.headline, perex: front.perex || '', body };
}

export async function loadLibrary() {
  let files = [];
  try { files = await fs.readdir(DIR); } catch { return []; }
  const out = [];
  for (const f of files) {
    if (!f.endsWith('.md')) continue;
    const doc = parseDoc(await fs.readFile(path.join(DIR, f), 'utf8'));
    if (doc) out.push(doc);
  }
  return out;
}

// ---------- Kedy bola ktorá naposledy zverejnená (z fronty) ----------
async function lastPublishedMap() {
  const { data } = await db.from('queue')
    .select('raw_data, created_at')
    .eq('raw_data->>_src', 'evergreen')
    .order('created_at', { ascending: false })
    .limit(500);
  const map = new Map();
  for (const r of data ?? []) {
    const slug = r.raw_data?.slug;
    if (slug && !map.has(slug)) map.set(slug, r.created_at);  // prvý = najnovší (zoradené desc)
  }
  return map;
}

// ---------- Výber ďalšej ----------
export function pickNext(library, lastMap, now = Date.now()) {
  const scored = library.map((a) => {
    const last = lastMap.get(a.slug);
    return { ...a, lastMs: last ? new Date(last).getTime() : 0 };
  });
  // Vylúč tie, čo boli zverejnené príliš nedávno (no-repeat okno).
  const eligible = scored.filter((c) => !c.lastMs || (now - c.lastMs) >= NO_REPEAT_DAYS * DAY);
  if (!eligible.length) return null;
  eligible.sort((a, b) => a.lastMs - b.lastMs);   // najdlhšie nezobrazená (0 = nikdy) prvá
  return eligible[0];
}

// ---------- Obrázok (generuj raz, kešuj) ----------
export async function imageFor(slug, headline) {
  const cachePath = path.join(DIR, '.images.json');
  let cache = {};
  try { cache = JSON.parse(await fs.readFile(cachePath, 'utf8')); } catch { /* prvý raz */ }
  if (cache[slug]) return cache[slug];
  if (process.env.AI_ENABLED === 'false') return '';
  let url = '';
  try { url = await generateImage(headline, `evergreen-${slug}`); } catch { /* graceful */ }
  if (url) { cache[slug] = url; await fs.writeFile(cachePath, JSON.stringify(cache, null, 2)); }
  return url;
}

// ---------- Rotácia ----------
export async function rotate({ dryRun = false, force = false } = {}) {
  const library = await loadLibrary();
  if (!library.length) return { skipped: 'prázdna knižnica' };

  const lastMap = await lastPublishedMap();

  // Kadencia: ak sa nejaký evergreen objavil pred menej než CADENCE_DAYS, počkaj.
  if (!force) {
    let maxMs = 0;
    for (const v of lastMap.values()) maxMs = Math.max(maxMs, new Date(v).getTime());
    if (maxMs && (Date.now() - maxMs) < CADENCE_DAYS * DAY) {
      return { skipped: `kadencia: posledný evergreen pred < ${CADENCE_DAYS} d` };
    }
  }

  const pick = pickNext(library, lastMap);
  if (!pick) return { skipped: 'všetky nedávno zverejnené (no-repeat okno)' };
  if (dryRun) return { dryRun: true, pick: pick.slug, headline: pick.headline, libSize: library.length };

  // Outbound poistka — rovnaká brána ako publisher.
  if (process.env.MANUAL_APPROVAL === 'true' && process.env.ALLOW_PUBLISH !== 'true') {
    return { skipped: 'publikovanie vypnuté (ALLOW_PUBLISH=true povolí)', wouldPick: pick.slug };
  }

  const image_url = await imageFor(pick.slug, pick.headline);
  const article = {
    headline: pick.headline,
    perex: pick.perex,
    body: pick.body,
    sources: [{ name: 'Novinko — Krypto škola', url: '' }],
    image_url,
    kind: 'evergreen',
    slug: pick.slug,
  };
  const row = articleToRow(article);
  await appendArticleRow(row);
  const tg = await sendArticle(article, row[0]);
  if (tg.error) console.warn(`[evergreen] ${tg.error}`);
  await db.from('queue').insert({
    source_id: null,
    status: 'published',
    raw_data: { _src: 'evergreen', slug: pick.slug, day: new Date().toISOString().slice(0, 10) },
    article,
  });
  return { published: pick.slug, headline: pick.headline, image: !!image_url };
}
