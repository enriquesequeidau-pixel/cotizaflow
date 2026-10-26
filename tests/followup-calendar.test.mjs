import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFollowupCalendar} from '../followup-calendar.mjs';

const generatedAt = new Date('2026-10-25T10:00:00.000Z');
const options = {namespace:'test_account_01', generatedAt};
const quote = (id, followUp, overrides = {}) => ({
  id, number:`COT-${id}`, status:'enviada', clientId:'client1', followUp, ...overrides
});
const data = () => ({clients:[{id:'client1',name:'Ñandú Ltda.'}], quotes:[
  quote('a','2026-09-06'), quote('b','2026-04-05'),
  quote('c','2026-10-25',{status:'aceptada'}), quote('d','')
]});
const exportIcs = (d, opts={}) => buildFollowupCalendar(d,{...options,...opts});
const unfold = value => value.replace(/\r\n /g,'');

test('solo exporta enviadas con seguimiento y no modifica los datos',()=>{
  const d=data(), before=structuredClone(d);
  const ics=exportIcs(d);
  assert.equal((ics.match(/BEGIN:VEVENT/g)||[]).length,2);
  assert.ok(!ics.includes('COT-c'));
  assert.ok(!ics.includes('COT-d'));
  assert.deepEqual(d,before);
  assert.match(ics,/BEGIN:VCALENDAR\r\nVERSION:2\.0/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});
test('fechas de cambio horario chileno se conservan como días completos sin UTC desplazado',()=>{
  const ics=exportIcs(data());
  assert.match(ics,/DTSTART;VALUE=DATE:20260405\r\nDTEND;VALUE=DATE:20260406/);
  assert.match(ics,/DTSTART;VALUE=DATE:20260906\r\nDTEND;VALUE=DATE:20260907/);
  assert.ok(!ics.includes('TZID='));
  assert.ok(!ics.includes('DTSTART:2026'));
});
test('identificador estable, aislado por cuenta, sin emails ni nombres por defecto',()=>{
  const one=exportIcs(data()), two=exportIcs(data(),{namespace:'other_account'});
  assert.match(one,/UID:a\.test_account_01@cotizaflow\.invalid/);
  assert.match(two,/UID:a\.other_account@cotizaflow\.invalid/);
  assert.ok(!one.includes('Ñandú'));
  assert.ok(!one.includes('client1'));
  assert.equal(one,exportIcs(data()));
});
test('nombres opcionales y caracteres especiales se escapan sin inyección CRLF',()=>{
  const d={clients:[{id:'client1',name:'Árbol, S.A.; \\ Norte\nEVENT:malicioso'}],
    quotes:[quote('a','2026-10-25',{number:'A, B; \\ prueba\nEND:VEVENT'})]};
  const ics=unfold(exportIcs(d,{includeClientNames:true}));
  assert.match(ics,/SUMMARY:Seguimiento A\\, B\\; \\\\ prueba\\nEND:VEVENT — Árbol\\, S\.A\.\\; \\\\ Norte\\nEVENT:malicioso/);
  assert.equal((ics.match(/\r\nEND:VEVENT\r\n/g)||[]).length,1);
});
test('dobla líneas por octetos UTF-8 y permite reconstrucción exacta',()=>{
  const d={quotes:[quote('x','2026-10-25',{number:'á'.repeat(75)})]};
  const ics=exportIcs(d);
  for (const line of ics.trimEnd().split('\r\n')) {
    assert.ok(new TextEncoder().encode(line).length<=75,`línea demasiado larga: ${line}`);
  }
  assert.ok(unfold(ics).includes(`SUMMARY:Seguimiento ${'á'.repeat(75)}`));
});
test('rechaza fechas imposibles, calendarios ambiguos y estado corrupto',()=>{
  assert.throws(()=>exportIcs({quotes:[quote('x','2026-02-30')]}),/Fecha de seguimiento/);
  assert.throws(()=>exportIcs(data(),{namespace:'nombre@correo.com'}),/Identificador/);
  assert.throws(()=>exportIcs({quotes:[quote('x','2026-10-25'),quote('x','2026-10-26')]}),/duplicada/);
  assert.throws(()=>exportIcs({quotes:[quote('x','2026-10-25',{status:'pagada'})]}),/Cotización inválida/);
  assert.throws(()=>exportIcs(data(),{generatedAt:new Date(NaN)}),/generación/);
});
test('exportar sin eventos produce calendario válido, sin eventos fantasma',()=>{
  const ics=exportIcs({quotes:[]});
  assert.match(ics,/BEGIN:VCALENDAR/);
  assert.ok(!ics.includes('BEGIN:VEVENT'));
});
test('no exporta clientes ajenos ni PII cuando se solicita modo privado',()=>{
  const d={quotes:[quote('a','2026-10-25',{clientId:'not-present'})]};
  const ics=exportIcs(d);
  assert.ok(!ics.includes('not-present'));
  assert.throws(()=>exportIcs(d,{includeClientNames:true}),/Clientes inválidos/);
});
