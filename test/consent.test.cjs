const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const code=fs.readFileSync(require.resolve('../assets/ga4-consent.js'),'utf8');
function boot(saved,legacy){
 const scripts=[];const handlers={};
 const document={cookie:'',readyState:'loading',getElementById:()=>null,createElement:()=>({}),head:{appendChild:s=>scripts.push(s)},addEventListener:(n,f)=>handlers[n]=f};
 const window={addEventListener(){}};
 vm.runInNewContext(code,{window,document,history:{pushState(){},replaceState(){}},location:{href:'https://novinko.sk/',hostname:'novinko.sk'},localStorage:{getItem:k=>k==='novinko_consent_v2'?JSON.stringify(saved):legacy},setTimeout,Date});
 return {window,scripts};
}
const choice=()=>({version:'2026-10-21',savedAt:Date.now(),analytics:true,external:false});
test('missing, legacy, expired, future and wrong-version consent never loads analytics',()=>{
 for(const record of [null,{...choice(),version:'old'},{...choice(),savedAt:0},{...choice(),savedAt:Date.now()+100000},{...choice(),analytics:'true'}]){
 const state=boot(record,'accepted');assert.equal(state.scripts.length,0);assert.equal(state.window.NovinkoConsent.allows('external'),false);
 }
});
test('only valid purpose-specific consent enables a service; ads stay denied',()=>{
 const state=boot(choice());assert.equal(state.scripts.length,1);assert.match(state.scripts[0].src,/googletagmanager/);
 assert.equal(state.window.NovinkoConsent.allows('analytics'),true);assert.equal(state.window.NovinkoConsent.allows('external'),false);assert.equal(state.window.NovinkoConsent.allows('marketing'),false);
 const config=Array.from(state.window.dataLayer).find(c=>c[0]==='config')[2];assert.equal(config.allow_google_signals,false);assert.equal(config.cookie_update,false);
 const external=boot({...choice(),analytics:false,external:true});assert.equal(external.scripts.length,0);assert.equal(external.window.NovinkoConsent.allows('external'),true);
});
