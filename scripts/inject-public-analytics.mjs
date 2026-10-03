// Statické HTML súbory majú spoločný tag bez opakovania ID alebo inline kódu.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const directory = process.argv[2] || '_site';
for (const name of readdirSync(directory).filter((file) => file.endsWith('.html') && file !== 'publikovat.html')) {
  const path = join(directory, name);
  const html = readFileSync(path, 'utf8');
  if (html.includes('/assets/ga4-consent.js')) continue;
  if (!html.includes('</head>')) throw new Error(`${name}: chýba </head>`);
  const css = name === 'index.html' ? '' : '  <link rel="stylesheet" href="/assets/consent.css">\n';
  writeFileSync(path, html.replace('</head>', `${css}  <script src="/assets/ga4-consent.js" defer></script>\n</head>`));
}
