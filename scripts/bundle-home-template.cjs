// Bundle the final public HTML and its exact CSP into the homepage function.
// A generated JS module is bundled by esbuild; no runtime filesystem paths.
const fs = require('node:fs');
const path = require('node:path');
const output = process.argv[2] || '_site';
const html = fs.readFileSync(path.join(output, 'index.html'), 'utf8');
const headers = fs.readFileSync(path.join(output, '_headers'), 'utf8');
const csp = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1];
if (!csp || !html.includes('<!-- server:hero -->') || !html.includes('<!-- server:latest -->')) {
  throw new Error('Homepage template or CSP is incomplete');
}
fs.writeFileSync(path.join(__dirname, '../netlify/lib/home-template.cjs'),
  'module.exports = ' + JSON.stringify({ html, csp }) + ';\n');
