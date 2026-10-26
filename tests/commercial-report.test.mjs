import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCommercialReport,commercialReportCsv} from '../commercial-report.mjs';

const q=(id,status,price,overrides={})=>({
  id,number:'COT-'+id,clientId:'c1',date:'2026-10-20',validUntil:'2026-10-24',
  followUp:'2026-10-25',status,discount:0,tax:0,currency:'CLP',
  items:[{id:'i-'+id,name:'Trabajo',qty:1,price}],...overrides
});
const sample=()=>({
  settings:{currency:'CLP'},
  clients:[{id:'c1',name:'Ñandú Ltda.'},{id:'c2',name:'Cliente 2'}],
  quotes:[q('1','borrador',10000),q('2','enviada',20000),
    q('3','aceptada',30000),q('4','rechazada',40000)]
});

test('total cotizado incluye borradores; aceptado no es ingreso y tasa usa embudo enviado',()=>{
  const r=buildCommercialReport(sample(),{today:'2026-10-25'});
  assert.equal(r.totalQuoted,100000);
  assert.equal(r.acceptedValue,30000);
  assert.equal(r.counts.total,4);
  assert.equal(r.counts.borrador,1);
  assert.equal(r.counts.embudoEnviado,3);
  assert.equal(r.acceptanceRate,33.33);
  assert.match(r.disclaimer,/no representan pagos/);
});
test('solo las enviadas pendientes generan vencimientos y recordatorios',()=>{
  const r=buildCommercialReport(sample(),{today:'2026-10-25'});
  assert.equal(r.counts.vencidas,1);
  assert.equal(r.counts.seguimientosVencidos,1);
  assert.equal(r.counts.seguimientosProximos,0);
  const d=sample();d.quotes[1].followUp='2026-10-26';d.quotes[1].validUntil='2026-10-25';
  const next=buildCommercialReport(d,{today:'2026-10-25'});
  assert.equal(next.counts.vencidas,0);
  assert.equal(next.counts.seguimientosProximos,1);
});
test('sin cotizaciones evita dividir por cero',()=>{
  const r=buildCommercialReport({settings:{currency:'CLP'},quotes:[]},{today:'2026-10-25'});
  assert.equal(r.acceptanceRate,0);
  assert.equal(r.totalQuoted,0);
  assert.equal(r.rows.length,0);
});
test('filtros por período inclusivo y cliente, sin mutar entrada',()=>{
  const d=sample();
  d.quotes[0].date='2026-10-19';
  d.quotes[3].clientId='c2';
  const before=structuredClone(d);
  const r=buildCommercialReport(d,{from:'2026-10-20',to:'2026-10-20',clientId:'c1',today:'2026-10-25'});
  assert.equal(r.counts.total,2);
  assert.equal(r.totalQuoted,50000);
  assert.deepEqual(d,before);
});
test('rechaza fechas imposibles, período invertido y estados inválidos',()=>{
  assert.throws(()=>buildCommercialReport(sample(),{today:'2026-02-30'}),/Fecha actual/);
  assert.throws(()=>buildCommercialReport(sample(),{from:'2026-10-26',to:'2026-10-25'}),/invertido/);
  const d=sample();d.quotes[0].status='pagada';
  assert.throws(()=>buildCommercialReport(d,{today:'2026-10-25'}),/Cotización no válida/);
});
test('no mezcla monedas ni suma importes no finitos',()=>{
  const d=sample();d.quotes[0].currency='USD';
  assert.throws(()=>buildCommercialReport(d,{today:'2026-10-25'}),/monedas diferentes/);
  d.quotes[0].currency='CLP';d.quotes[0].items[0].price=Infinity;
  assert.throws(()=>buildCommercialReport(d,{today:'2026-10-25'}),/Servicio no válido/);
});
test('rechaza cotizaciones duplicadas para no inflar indicadores',()=>{
  const d=sample();d.quotes.push({...d.quotes[0]});
  assert.throws(()=>buildCommercialReport(d,{today:'2026-10-25'}),/duplicadas/);
});
test('CSV neutraliza fórmulas y conserva caracteres españoles sin exportar notas privadas',()=>{
  const d=sample();
  d.clients[0].name='  =HYPERLINK("https://example.invalid","clic")';
  d.quotes[0].number='+SUM(1,1)';
  d.quotes[0].notes='secreto que no debe salir';
  const csv=commercialReportCsv(buildCommercialReport(d,{today:'2026-10-25'}));
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv,/"'\+SUM\(1,1\)"/);
  assert.match(csv,/"'  =HYPERLINK\(""https:\/\/example.invalid"",""clic""\)"/);
  assert.ok(!csv.includes('secreto que no debe salir'));
  assert.match(csv,/cotizado/);
});
