// ============================================================
// NAHRAJ VLASTNÚ FOTKU DO ÚLOŽISKA
// ------------------------------------------------------------
// Vypíše verejnú URL, ktorú vložíš do poľa "URL obrázka" na publikovat.html.
//
//   node --env-file=.env scripts/nahraj-obrazok.mjs fotka.jpg
//   node --env-file=.env scripts/nahraj-obrazok.mjs fotka.jpg --nazov burza-2026
//
// PREČO TENTO SKRIPT EXISTUJE:
// CSP webu povoľuje obrázky iba z 'self', data: a https://*.supabase.co
// (scripts/gen-csp.mjs). Odkaz na cudzí hosting formulár síce prijme
// (manual-publish.js:60 kontroluje len to, či začína na "http"), ale prehliadač
// obrázok zablokuje a článok vyjde bez neho — TICHO, bez chybovej hlášky.
// Preto fotka musí ležať v tomto buckete.
//
// Ukladá do priečinka manual/, ktorý reset-pred-startom.mjs nemaže (ten čistí
// len krypto/ a ai/). Ručne nahrané fotky teda reset prežijú.
// ============================================================

import { readFileSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const BUCKET = process.env.SUPABASE_BUCKET ?? 'article-images';
const PRIECINOK = 'manual';
const MAX_MB = 5;

const TYPY = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
};

function usage(sprava) {
  if (sprava) console.error(`\n\x1b[31m${sprava}\x1b[0m`);
  console.error(`
Použitie:
  node --env-file=.env scripts/nahraj-obrazok.mjs <súbor> [--nazov vlastny-nazov]

Podporované: ${Object.keys(TYPY).join(', ')}
Maximum: ${MAX_MB} MB
`);
  process.exit(1);
}

const args = process.argv.slice(2);
const cesta = args.find((a) => !a.startsWith('--'));
if (!cesta) usage('Nezadal si súbor.');

const iNazov = args.indexOf('--nazov');
const vlastnyNazov = iNazov !== -1 ? args[iNazov + 1] : null;

const pripona = extname(cesta).toLowerCase();
const contentType = TYPY[pripona];
if (!contentType) usage(`Nepodporovaná prípona "${pripona}".`);

let data, velkost;
try {
  data = readFileSync(cesta);
  velkost = statSync(cesta).size;
} catch (e) {
  usage(`Súbor sa nedá prečítať: ${e.message}`);
}

if (velkost > MAX_MB * 1024 * 1024) {
  usage(`Súbor má ${(velkost / 1024 / 1024).toFixed(1)} MB, maximum je ${MAX_MB} MB.`);
}

if (!process.env.IMAGE_SUPABASE_URL || !process.env.IMAGE_SUPABASE_KEY) {
  usage('Chýba IMAGE_SUPABASE_URL alebo IMAGE_SUPABASE_KEY v .env.');
}

// Názov: bez diakritiky a medzier, s časovou pečiatkou proti prepísaniu.
const zaklad = (vlastnyNazov || basename(cesta, pripona))
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'fotka';
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T-]/g, '');
const path = `${PRIECINOK}/${zaklad}-${stamp}${pripona}`;

const supabase = createClient(process.env.IMAGE_SUPABASE_URL, process.env.IMAGE_SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`\nNahrávam ${cesta} (${(velkost / 1024).toFixed(0)} kB, ${contentType})…`);

const { error } = await supabase.storage.from(BUCKET)
  .upload(path, data, { contentType, upsert: false });

if (error) {
  console.error(`\n\x1b[31mNahrávanie zlyhalo: ${error.message}\x1b[0m\n`);
  process.exit(1);
}

const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

console.log(`\n\x1b[32m✓ Nahraté\x1b[0m`);
console.log(`\nVlož toto do poľa "URL obrázka" na https://novinko.sk/publikovat.html:\n`);
console.log(`\x1b[36m${url}\x1b[0m\n`);
