// Pure UI race regression. No Mercado Pago requests, credentials, or charges.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');

const source=readFileSync('plan-checkout.mjs','utf8');
const start=source.indexOf('    async function refresh() {');
const end=source.indexOf('    openButton.onclick',start);
assert.ok(start>=0&&end>start,'Could not locate plan refresh implementation');

function fixture(){
 const requests=[];
 const status={textContent:''};
 const subscribe={disabled:false},cancel={disabled:false},report={disabled:false};
 const context=vm.createContext({
  subscribe,cancel,report,status,
  setStatus:message=>{status.textContent=message;},
  callBilling:action=>{
   assert.equal(action,'status');
   return new Promise((resolve,reject)=>requests.push({resolve,reject}));
  }
 });
 vm.runInContext('let refreshGeneration=0;\n'+source.slice(start,end)+'\nthis.refresh=refresh;',context);
 return {requests,status,subscribe,cancel,report,refresh:context.refresh};
}

const active={status:'authorized',plan:'pro',checkout_enabled:false};
const cancelled={status:'cancelled',plan:'free',checkout_enabled:false};

test('older Pro response cannot restore actions after newer cancellation',async()=>{
 const f=fixture();
 const old=f.refresh(),latest=f.refresh();
 assert.equal(f.requests.length,2);
 f.requests[1].resolve(cancelled);
 await latest;
 f.requests[0].resolve(active);
 await old;
 assert.equal(f.report.disabled,true);
 assert.equal(f.cancel.disabled,true);
 assert.equal(f.subscribe.disabled,true);
 assert.match(f.status.textContent,/Suscripción cancelada/);
 assert.doesNotMatch(f.status.textContent,/Pro activo/);
});

test('older network failure cannot replace newer verified Pro status',async()=>{
 const f=fixture();
 const old=f.refresh(),latest=f.refresh();
 f.requests[1].resolve(active);
 await latest;
 f.requests[0].reject(new Error('Error antiguo de conexión'));
 await old;
 assert.equal(f.report.disabled,false);
 assert.equal(f.cancel.disabled,false);
 assert.match(f.status.textContent,/Pro activo/);
 assert.doesNotMatch(f.status.textContent,/Error antiguo/);
});

test('latest status error keeps actions locked despite delayed old Pro response',async()=>{
 const f=fixture();
 const old=f.refresh(),latest=f.refresh();
 f.requests[1].reject(new Error('Proveedor no disponible'));
 await latest;
 f.requests[0].resolve(active);
 await old;
 assert.equal(f.report.disabled,true);
 assert.equal(f.cancel.disabled,true);
 assert.equal(f.subscribe.disabled,true);
 assert.match(f.status.textContent,/Proveedor no disponible/);
});
