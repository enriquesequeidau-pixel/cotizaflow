import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareProCommercialReport,exportProCommercialReport} from '../pro-commercial-report-action.mjs';

const sample=()=>({
  settings:{currency:'CLP'},
  clients:[{id:'client-a',name:'Ñandú Ltda.'}],
  quotes:[
    {id:'q1',number:'COT-001',clientId:'client-a',date:'2026-10-20',
      validUntil:'2026-10-30',followUp:'2026-10-27',status:'enviada',
      discount:0,tax:0,currency:'CLP',items:[{id:'i1',name:'Trabajo',qty:1,price:5000}]},
    {id:'q2',number:'COT-002',clientId:'client-a',date:'2026-10-21',
      validUntil:'2026-10-30',followUp:'',status:'aceptada',
      discount:0,tax:0,currency:'CLP',items:[{id:'i2',name:'Trabajo',qty:1,price:10000}]}
  ]
});
const filters={from:'2026-10-20',to:'2026-10-21',today:'2026-10-25'};
function harness(){
  const counters={reads:0,checks:0,downloads:[]};
  const payload=sample(),old=structuredClone(payload);
  const deps={verifyPro:async()=>{counters.checks++;return true;},
    readData:async()=>{counters.reads++;return payload;},filters,
    downloadCsv:async(...x)=>counters.downloads.push(x)};
  return {deps,counters,payload,old};
}
test('preview requires two live checks and computes correct non-revenue metrics',async()=>{
  const h=harness();
  const r=await prepareProCommercialReport(h.deps);
  assert.equal(r.totalQuoted,15000);
  assert.equal(r.acceptedValue,10000);
  assert.equal(r.acceptanceRate,50);
  assert.equal(r.rows.length,2);
  assert.match(r.disclaimer,/no representan pagos/);
  assert.equal(h.counters.checks,2);
  assert.equal(h.counters.reads,1);
  assert.deepEqual(h.counters.downloads,[]);
  assert.deepEqual(h.payload,h.old);
});
test('CSV requires three checks, excludes private notes and downloads once',async()=>{
  const h=harness();
  h.payload.quotes[0].notes='Confidencial';
  h.payload.clients[0].name='=HYPERLINK("https://example.invalid","click")';
  const r=await exportProCommercialReport(h.deps);
  assert.deepEqual(r,{rows:2,acceptanceRate:50});
  assert.equal(h.counters.checks,3);
  assert.equal(h.counters.downloads.length,1);
  const [csv,name]=h.counters.downloads[0];
  assert.equal(name,'cotizaflow-informe-comercial.csv');
  assert.match(csv,/cotizado/);
  assert.match(csv,/"'=HYPERLINK/);
  assert.ok(!csv.includes('Confidencial'));
});
test('Free denial occurs before reading any client records',async()=>{
  const h=harness();h.deps.verifyPro=async()=>false;
  await assert.rejects(prepareProCommercialReport(h.deps),/Acceso Pro/);
  assert.equal(h.counters.reads,0);
  assert.deepEqual(h.counters.downloads,[]);
});
test('cancelled Pro after async data read never prepares a report',async()=>{
  const h=harness();let checks=0;
  h.deps.verifyPro=async()=>++checks===1;
  await assert.rejects(prepareProCommercialReport(h.deps),/Acceso Pro/);
  assert.equal(checks,2);
  assert.deepEqual(h.counters.downloads,[]);
});
test('revoked plan after preview but before export prevents CSV download',async()=>{
  const h=harness();let checks=0;
  h.deps.verifyPro=async()=>++checks!==3;
  await assert.rejects(exportProCommercialReport(h.deps),/Acceso Pro/);
  assert.equal(checks,3);
  assert.deepEqual(h.counters.downloads,[]);
});
test('provider or network failure cannot be treated as Pro authorization',async()=>{
  const h=harness();
  h.deps.verifyPro=async()=>{throw Error('provider offline');};
  await assert.rejects(exportProCommercialReport(h.deps),/provider offline/);
  assert.equal(h.counters.reads,0);
});
test('date and client filters narrow the exported period without mutation',async()=>{
  const h=harness();h.deps.filters={from:'2026-10-21',to:'2026-10-21',
    clientId:'client-a',today:'2026-10-25'};
  const r=await prepareProCommercialReport(h.deps);
  assert.equal(r.rows.length,1);
  assert.equal(r.totalQuoted,10000);
  assert.deepEqual(h.payload,h.old);
});
test('incomplete dependencies are rejected before accessing private data',async()=>{
  const h=harness();
  await assert.rejects(prepareProCommercialReport({readData:h.deps.readData}),TypeError);
  await assert.rejects(exportProCommercialReport(h.deps&&{...h.deps,downloadCsv:undefined}),TypeError);
  assert.equal(h.counters.reads,0);
});
test('invalid customer data or inverted date selection fails without export',async()=>{
  const h=harness();h.deps.filters={from:'2026-11-01',to:'2026-10-01'};
  await assert.rejects(exportProCommercialReport(h.deps),/invertido/);
  assert.deepEqual(h.counters.downloads,[]);
});
