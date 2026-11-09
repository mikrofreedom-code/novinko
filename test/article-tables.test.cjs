const test = require('node:test');
const assert = require('node:assert/strict');
const {renderBlocks} = require('../assets/article-links');
const {paragraphsToCell} = require('../netlify/lib/article-row');
const {renderClanok} = require('../netlify/lib/clanok-render');
const text = 'Úvod.\n\n| Krajina | Počet |\n| --- | --- |\n| Slovensko | 5,4 milióna |\n| Česko | 10,9 milióna |\n\nZáver.';
test('tabuľka prežije uloženie a zobrazí sa rovnako v náhľade aj článku',()=>{
 const stored=paragraphsToCell(text);
 const html=renderBlocks(text);
 assert.equal(renderBlocks(stored),html);
 assert.match(html,/<th scope="col">Krajina<\/th>/);
 assert.match(html,/<td>5,4 milióna<\/td>/);
 assert.match(html,/<p>Záver\.<\/p>/);
 assert.match(renderClanok({title:'Tabuľka',category:'svet',content:stored}),/<table>/);
});
test('HTML v bunkách je text a odkazy sú bezpečné',()=>{
 const html=renderBlocks('| Názov | Zdroj |\n| --- | --- |\n| <script>alert(1)</script> | [web](https://example.com) |');
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.match(html,/<a href="https:\/\/example.com/);
 assert.doesNotMatch(renderBlocks('| A | B |\n| zlé | dáta |'),/<table>/);
});
