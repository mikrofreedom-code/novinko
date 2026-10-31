// Insert the same identity used by the article renderer into the static homepage.
const fs = require('node:fs');
const path = require('node:path');
const { siteIdentityJsonLd } = require('../netlify/lib/site-identity');
const file = path.join(process.argv[2] || '_site', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const script = `<script id="site-identity" type="application/ld+json">${siteIdentityJsonLd()}</script>`;
fs.writeFileSync(file, html.replace(/<script id="site-identity"[^>]*>[\s\S]*?<\/script>\s*/g, '').replace('</head>', `${script}\n</head>`));
