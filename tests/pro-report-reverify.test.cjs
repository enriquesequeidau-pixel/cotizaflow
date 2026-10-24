const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');

function fixture(nextStatus){
 const nodes=new Map();
 const node=id=>{
  if(!nodes.has(id))nodes.set(id,{id,disabled:false,textContent:'',innerHTML:'',onclick:null,
   append(){},click(){},remove(){},showModal(){},close(){},
   querySelector(sel){return node(sel.slice(1))}});
  return nodes.get(id);
 };
 const document={head:{append(){}},body:{append(){}},
  createElement:tag=>node(tag==='dialog'?'dialog':tag==='a'?'download-link':tag==='button'?'open-button':'style')};
 const source=readFileSync('plan-checkout.mjs','utf8').replace(/^import[^\n]*\n/gm,'');
 let checks=0;
 const fakeFetch=async url=>{
  if(url.includes('/cotizaflow-pro-report'))return {ok:true,blob:async()=>({csv:true})};
  if(url.includes('/cotizaflow-mp-checkout')){
   checks++;
   const payload=checks===1?{status:'authorized',plan:'pro',payment_verified:true,checkout_enabled:false}:nextStatus;
   if(payload===null)return {ok:false,status:503,json:async()=>({error:'Sin conexión con el proveedor'})};
   return {ok:true,json:async()=>payload};
  }
  throw Error('Unexpected network request: '+url);
 };
 const run=new Function('document','window','sessionStorage','URL','fetch','rememberCheckoutRedirect',
  'consumeCheckoutRedirect','subscriptionReturnMessage','Blob','setTimeout',source+'\nreturn {refresh,report};');
 const api=run(document,{CotizaFlowSession:{token:async()=> 'fixture-jwt'}},
  {getItem:()=>null},{createObjectURL:()=> 'blob:fixture',revokeObjectURL:()=>{}},
  fakeFetch,()=>{},()=>false,()=>'',class FakeBlob{},()=>{});
 return {api,node,checks:()=>checks};
}

test('report action stays disabled after server-side cancellation during export',async()=>{
 const f=fixture({status:'cancelled',plan:'free',payment_verified:false,checkout_enabled:false});
 await f.api.refresh();
 assert.equal(f.api.report.disabled,false);
 await f.api.report.onclick();
 assert.equal(f.api.report.disabled,true);
 assert.match(f.node('cf-plan-state').textContent,/Suscripción cancelada/);
 assert.equal(f.checks(),2);
});

test('report action stays disabled when post-export entitlement recheck fails',async()=>{
 const f=fixture(null);
 await f.api.refresh();
 assert.equal(f.api.report.disabled,false);
 await f.api.report.onclick();
 assert.equal(f.api.report.disabled,true);
 assert.match(f.node('cf-plan-state').textContent,/Sin conexión con el proveedor/);
 assert.equal(f.checks(),2);
});
