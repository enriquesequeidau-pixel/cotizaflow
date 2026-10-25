import test from 'node:test';
import assert from 'node:assert/strict';
import {duplicateProQuote} from '../pro-duplicate-action.mjs';

const sample=()=>({
  settings:{business:'Taller',phone:'',email:'',currency:'CLP',tax:19},
  clients:[{id:'c1',name:'Ana Pérez',phone:'',email:''}],
  services:[],
  quotes:[{id:'q1',number:'COT-0001',clientId:'c1',
    date:'2026-10-18',validUntil:'2026-10-25',followUp:'2026-10-21',
    status:'aceptada',discount:10,tax:19,notes:'Cotización original',
    currency:'CLP',acceptanceToken:'never-copy',
    items:[{id:'i1',name:'Instalación',qty:2,price:10000,internalToken:'never-copy'}]}]
});
function fixture(overrides={}){
  let raw=JSON.stringify(sample()),writes=0,reads=0;
  const storage={
    getItem:()=>{reads++;return raw;},
    setItem:(key,value)=>{assert.equal(key,'cotizaflow-v1');writes++;raw=value;}
  };
  let checks=0;
  const deps={
    storage,sourceId:'q1',date:'2026-10-25',
    idFactory:(()=>{const ids=['q2','i2'];return ()=>ids.shift();})(),
    verifyPro:async()=>{checks++;return true;},...overrides
  };
  return {deps,storage,raw:()=>raw,writes:()=>writes,reads:()=>reads,checks:()=>checks};
}
test('Pro verified twice: duplicates into persisted local JSON, original unchanged',async()=>{
  const f=fixture(),before=JSON.parse(f.raw());
  const result=await duplicateProQuote(f.deps);
  assert.deepEqual(result,{id:'q2',number:'COT-0002',status:'borrador'});
  assert.equal(f.checks(),2);assert.equal(f.writes(),1);
  const data=JSON.parse(f.raw());
  assert.equal(data.quotes.length,2);
  assert.equal(data.quotes[1].id,before.quotes[0].id);
  assert.equal(data.quotes[1].number,before.quotes[0].number);
  assert.equal(data.quotes[1].status,'aceptada');
  assert.equal(data.quotes[1].notes,before.quotes[0].notes);
  assert.deepEqual(data.quotes[1].items,[{id:'i1',name:'Instalación',qty:2,price:10000}]);
  assert.equal(data.quotes[0].id,'q2');
  assert.equal(data.quotes[0].date,'2026-10-25');
  assert.equal(data.quotes[0].validUntil,'2026-11-09');
  assert.equal(data.quotes[0].followUp,'2026-10-28');
  assert.equal(data.quotes[0].status,'borrador');
  assert.equal(data.quotes[0].items[0].id,'i2');
  assert.ok(!f.raw().includes('never-copy'));
});
test('Free denial before any read or write',async()=>{
  const f=fixture({verifyPro:async()=>false});
  await assert.rejects(duplicateProQuote(f.deps),/Acceso Pro no verificado/);
  assert.equal(f.reads(),0);assert.equal(f.writes(),0);
});
test('revoked Pro between read and write never persists',async()=>{
  let checks=0;const f=fixture({verifyPro:async()=>++checks===1});
  const before=f.raw();
  await assert.rejects(duplicateProQuote(f.deps),/Acceso Pro no verificado/);
  assert.equal(checks,2);assert.equal(f.writes(),0);assert.equal(f.raw(),before);
});
test('storage changes while entitlement request pending: no lost update',async()=>{
  const f=fixture();const original=f.raw();let checks=0;
  f.deps.verifyPro=async()=>{
    if(++checks===2)f.storage.setItem('cotizaflow-v1',original+' ');
    return true;
  };
  await assert.rejects(duplicateProQuote(f.deps),/otra pestaña/);
  assert.equal(f.writes(),1);
  assert.equal(f.raw(),original+' ');
});
test('corrupted data is rejected without resetting Free storage',async()=>{
  const f=fixture();f.storage.setItem('cotizaflow-v1','{bad');
  const before=f.raw();
  await assert.rejects(duplicateProQuote(f.deps),/dañados/);
  assert.equal(f.raw(),before);assert.equal(f.writes(),1);
});
test('localStorage quota errors are surfaced and never claimed successful',async()=>{
  const f=fixture({storage:{
    getItem:()=>JSON.stringify(sample()),
    setItem:()=>{throw Error('QuotaExceededError');}
  }});
  await assert.rejects(duplicateProQuote(f.deps),/QuotaExceededError/);
});
test('read-back mismatch cannot be reported as successful save',async()=>{
  const f=fixture({storage:{
    getItem:(()=>{let n=0;const raw=JSON.stringify(sample());return ()=>++n>2?'different':raw;})(),
    setItem:()=>{}
  }});
  await assert.rejects(duplicateProQuote(f.deps),/confirmar el guardado/);
});
test('malformed dependencies fail before reading customer data',async()=>{
  const f=fixture();
  await assert.rejects(duplicateProQuote({...f.deps,sourceId:'../bad'}),TypeError);
  await assert.rejects(duplicateProQuote({...f.deps,verifyPro:null}),TypeError);
  assert.equal(f.reads(),0);
});
test('duplicate IDs or missing source do not mutate persisted records',async()=>{
  const f=fixture({idFactory:()=> 'q1'});
  await assert.rejects(duplicateProQuote(f.deps),/ID nuevo/);
  assert.equal(f.writes(),0);
  const g=fixture({sourceId:'q-unknown'});
  await assert.rejects(duplicateProQuote(g.deps),/no encontrada/);
  assert.equal(g.writes(),0);
});
test('can duplicate twice with distinct IDs and consecutive numbers',async()=>{
  const f=fixture();
  await duplicateProQuote(f.deps);
  const next=['q3','i3'];
  await duplicateProQuote({...f.deps,idFactory:()=>next.shift()});
  const data=JSON.parse(f.raw());
  assert.deepEqual(data.quotes.map(q=>q.number),['COT-0003','COT-0002','COT-0001']);
  assert.equal(f.writes(),2);
});
