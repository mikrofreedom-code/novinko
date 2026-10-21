const { test } = require('node:test');
const assert = require('node:assert/strict');
const { searchArticles } = require('../netlify/lib/article-search');
const { handler } = require('../netlify/functions/archiv');
const { renderSearch } = require('../netlify/lib/clanok-render');
const articles = [
 {id:'100001',title:'Úroky a hypotéky na Slovensku',perex:'Náklady domácností.',content:'Príklad výpočtu.',date:'2026-10-20T10:00:00Z',category:'ekonomika'},
 {id:'100002',title:'Banky menia ponuku',perex:'Nové úroky hypoték.',content:'Hypotéky na Slovensku.',date:'2026-10-21T10:00:00Z',category:'ekonomika'},
 {id:'100003',title:'Bitcoin rastie',perex:'Kryptotrh.',content:'Iná správa.',date:'2026-10-21T11:00:00Z',category:'krypto'},
];
function csv(items) {
 const rows=[['id','title','perex','content','source','date','category','image','credit','meta'],...items.map(a=>[a.id,a.title,a.perex,a.content,'Novinko',a.date,a.category,'','',''])];
 return rows.map(row=>row.map(v=>'"'+String(v||'').replaceAll('"','""')+'"').join(',')).join('\n');
}
test('search ignores accents/case, requires all words and favours title matches', () => {
 assert.deepEqual(searchArticles(articles,'  UROKY  SLOVENSKU ').items.map(a=>a.id),['100001','100002']);
 assert.equal(searchArticles(articles,'priklad vypoctu').items[0].id,'100001');
 assert.equal(searchArticles(articles,'bitcoin hypoteky').total,0);
});
test('pagination keeps all matching articles without repeating a page', () => {
 const many=Array.from({length:45},(_,i)=>({...articles[0],id:String(100000+i)}));
 const first=searchArticles(many,'uroky'); const second=searchArticles(many,'uroky',2);
 assert.equal(first.total,45); assert.equal(first.pages,3); assert.equal(first.items.length,20);
 assert.equal(new Set([...first.items,...second.items].map(a=>a.id)).size,40);
 assert.equal(searchArticles(many,'uroky',999).items.length,5);
 for(const page of ['NaN','1.5','-2','Infinity']) assert.equal(searchArticles(many,'uroky',page).page,1);
});
test('search handles query parameters while the full archive remains indexable',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response(csv(articles)));
 const result=await handler({queryStringParameters:{q:'uroky'}});
 assert.equal(result.statusCode,200);
 assert.match(result.body,/2 výsledky/); assert.doesNotMatch(result.body,/Bitcoin rastie/);
 assert.match(result.body,/noindex, follow/); assert.equal(result.headers['Cache-Control'],'private, no-store');
 const archive=await handler({});
 assert.match(archive.body,/Bitcoin rastie/); assert.doesNotMatch(archive.body,/noindex/);
 assert.match(archive.body,/action="\/archiv" method="get"/);
 const empty=await handler({queryStringParameters:{q:'zzznothing987654321'}});
 assert.equal(empty.statusCode,200); assert.match(empty.body,/Nenašli sme žiadne články/);
 assert.doesNotMatch(empty.body,/class="search-result"/);
});
test('untrusted query and result text cannot inject HTML; pagination preserves query',()=>{
 const query='"<svg onload=alert(1)> & úroky';
 const html=renderSearch({query,total:21,page:1,pages:2,pageSize:20,items:[{...articles[0],title:'<img src=x onerror=alert(1)>'}]});
 assert.doesNotMatch(html,/<svg onload|<img src=x/); assert.match(html,/&lt;svg/);
 const next=html.match(/rel="next" href="([^"]+)"/)[1].replaceAll('&amp;','&');
 const url=new URL(next,'https://novinko.sk'); assert.equal(url.searchParams.get('q'),query); assert.equal(url.searchParams.get('strana'),'2');
});
test('a sheet outage is temporary unavailability, not no matches or a missing article',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('down',{status:503}));
 t.mock.method(console,'error',()=>{});
 const result=await handler({queryStringParameters:{q:'hypoteky'}});
 assert.equal(result.statusCode,503); assert.equal(result.headers['Cache-Control'],'no-store');
 assert.match(result.body,/Články sa nepodarilo načítať/); assert.match(result.body,/value="hypoteky"/);
 assert.doesNotMatch(result.body,/Článok nenájdený|Nenašli sme/);
});
