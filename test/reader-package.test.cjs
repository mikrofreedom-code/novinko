const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { describeImage } = require('../assets/image-credit');
const { selectRelated } = require('../assets/related-articles');
const { renderClanok } = require('../netlify/lib/clanok-render');
const article={id:'100001',category:'krypto',title:'Etherové ETF strácajú kapitál',perex:'Odlevy z fondov.',content:'Text článku.',date:'2026-10-21T12:00:00Z',imageUrl:'https://example.com/manual/photo.webp',imageCredit:'AI ilustrácia'};
const candidates=[
 article,
 {id:'100002',category:'svet',title:'ETF vo svete',date:'2026-10-21T13:00:00Z'},
 {id:'100003',category:'krypto',title:'Zcash mení technológiu',date:'2026-10-21T14:00:00Z'},
 {id:'100004',category:'krypto-skola',title:'Ako fungujú ETF',date:'2026-09-01T10:00:00Z'},
 {id:'100005',category:'krypto',title:'Ethereum a etherové fondy',date:'2026-10-20T10:00:00Z'},
 {id:'100006',category:'krypto-skola',title:'Ako zabezpečiť peňaženku',date:'2026-10-21T15:00:00Z'},
];
test('AI credit is recognised even for a manually uploaded image; explicit origins and credits survive',()=>{
 assert.equal(describeImage(article.imageUrl,'AI ilustrácia').type,'ai');
 assert.doesNotMatch(describeImage(article.imageUrl,'Foto: AI ilustrácia').text,/Foto:/);
 assert.equal(describeImage(article.imageUrl,'Ján Novák','photo').text,'Foto: Ján Novák');
 assert.equal(describeImage(article.imageUrl,'Foto: Ján Novák').text,'Foto: Ján Novák');
 assert.equal(describeImage(article.imageUrl,'Mestský archív','archive').text,'Archívny obrázok: Mestský archív');
 assert.equal(describeImage(article.imageUrl,'Ján Novák','illustration').text,'Ilustrácia: Ján Novák');
 assert.equal(describeImage(article.imageUrl,'').type,'');
 assert.equal(describeImage('https://test.supabase.co/storage/v1/object/public/article-images/krypto/a.webp','').type,'ai');
});
test('related articles prefer topic overlap, connect the school and exclude unrelated sections/self',()=>{
 const result=selectRelated(article,candidates);
 assert.deepEqual(new Set(result.slice(0,2).map(a=>a.id)),new Set(['100004','100005']));
 assert.deepEqual(new Set(result.map(a=>a.id)),new Set(['100003','100004','100005']));
 const garden={id:'g1',category:'zahrada',title:'Jesenná záhrada'};
 assert.deepEqual(selectRelated(garden,candidates),[]);
 assert.equal(selectRelated(garden,[garden,{id:'g2',category:'zahrada',title:'Kompost'}])[0].id,'g2');
});
test('shared image descriptions and related selection agree in browser and server',()=>{
 const context=vm.createContext({});
 for(const file of ['image-credit','related-articles']) vm.runInContext(fs.readFileSync(require.resolve('../assets/'+file),'utf8'),context);
 assert.equal(context.NovinkoImages.describeImage(article.imageUrl,article.imageCredit).text,describeImage(article.imageUrl,article.imageCredit).text);
 assert.equal(JSON.stringify(context.NovinkoRelated.selectRelated(article,candidates)),JSON.stringify(selectRelated(article,candidates)));
});
test('article has perex before image, sources before ad, editorial links and escaped captions',()=>{
 const html=renderClanok({...article,source:'Test | https://example.com'},[{title:'Ako fungujú ETF',url:'/clanok/etf-100004',date:'2026-09-01T10:00:00Z',category:'krypto-skola'}]);
 assert.ok(html.indexOf('class="article-perex"')<html.indexOf('class="article-figure"'));
 assert.ok(html.indexOf('class="source-link"')<html.indexOf('class="promo-slot"'));
 assert.match(html,/AI ilustrácia — nezobrazuje skutočnú udalosť/); assert.doesNotMatch(html,/Foto: AI/);
 assert.match(html,/href="\/pravo-na-opravu.html"/); assert.match(html,/Pokračujte v čítaní/);
 assert.match(html,/Krypto škola/); assert.match(html,/fetchpriority="high"/);
 const hostile=renderClanok({...article,imageCredit:'<script>alert(1)</script>',mystery:{}});
 assert.doesNotMatch(hostile,/<script>alert/); assert.match(hostile,/&lt;script&gt;/);
});
