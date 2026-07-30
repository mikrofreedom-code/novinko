// Manuálna kontrola Learning Log archívu (logs/learning/).
// Vypíše celkovú veľkosť a zoznam súborov bezpečných na presun na externý HDD
// (všetky okrem dnešného/aktívneho, do ktorého sa práve zapisuje).
//
//   node scripts/check-learning-size.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { DIR, listLogFiles, activeFile, totalLogBytes } from '../lib/_shared/learning-log.js';

function human(bytes) {
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

async function main() {
  const files = await listLogFiles();
  const active = await activeFile();
  const total = await totalLogBytes();

  console.log(`📦 logs/learning/ — spolu ${human(total)} (${files.length} súborov)`);
  if (files.length === 0) { console.log('   (zatiaľ žiadne dáta)'); return; }

  const archivable = files.filter((f) => f !== active);
  console.log(`   aktívny súbor (nehýbať): ${active}`);

  if (archivable.length === 0) {
    console.log('   žiadne súbory zatiaľ nie sú pripravené na presun.');
    return;
  }

  let archivableBytes = 0;
  console.log(`\n   pripravené na presun na externý HDD (${archivable.length}):`);
  for (const f of archivable) {
    const { size } = await fs.stat(path.join(DIR, f));
    archivableBytes += size;
    console.log(`     ${f}  (${(size / 1024 ** 2).toFixed(1)} MB)`);
  }
  console.log(`   spolu na presun: ${human(archivableBytes)}`);
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
