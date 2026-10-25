import test from 'node:test';
import assert from 'node:assert/strict';
import {exportProFollowups,localCalendarNamespace} from '../pro-calendar-action.mjs';

const sample=()=>({quotes:[
  {id:'q1',number:'COT-1',status:'enviada',clientId:'c1',followUp:'2026-09-06'},
  {id:'q2',number:'COT-2',status:'aceptada',clientId:'c1',followUp:'2026-09-07'}
],clients:[{id:'c1',name:'Cliente privado'}]});
const at=new Date('2026-10-25T12:00:00.000Z');
function fixture(overrides={}) {
  const downloads=[],calls=[];
  const deps={
    verifyPro:async()=>{calls.push('verify');return true;},
    readData:()=>{calls.push('read');return sample();},
    namespace:()=>{calls.push('namespace');return 'test_account';},
    downloadIcs:async(ics,name)=>{calls.push('download');downloads.push({ics,name});},
    generatedAt:at,...overrides
  };
  return {deps,calls,downloads};
}

test('exporta ICS privado solo tras verificar Pro, en orden seguro',async()=>{
  const f=fixture();
  const ics=await exportProFollowups(f.deps);
  assert.deepEqual(f.calls,['verify','read','namespace','download']);
  assert.equal(f.downloads[0].name,'cotizaflow-seguimientos.ics');
  assert.equal(f.downloads[0].ics,ics);
  assert.match(ics,/DTSTART;VALUE=DATE:20260906/);
  assert.ok(!ics.includes('Cliente privado'));
  assert.ok(!ics.includes('COT-2'));
});
test('denegación Free impide leer datos, crear UID o descargar',async()=>{
  const f=fixture({verifyPro:async()=>{return false;}});
  await assert.rejects(exportProFollowups(f.deps),/Acceso Pro no verificado/);
  assert.deepEqual(f.calls,[]);
  assert.equal(f.downloads.length,0);
});
test('fallo de verificación remota se propaga sin descarga',async()=>{
  const f=fixture({verifyPro:async()=>{throw Error('red no disponible');}});
  await assert.rejects(exportProFollowups(f.deps),/red no disponible/);
  assert.equal(f.downloads.length,0);
  assert.deepEqual(f.calls,[]);
});
test('revalida acceso en cada exportación, incluso tras una primera aprobación',async()=>{
  let checks=0;
  const f=fixture({verifyPro:async()=>++checks===1});
  await exportProFollowups(f.deps);
  await assert.rejects(exportProFollowups(f.deps),/Acceso Pro no verificado/);
  assert.equal(checks,2);
  assert.equal(f.downloads.length,1);
});
test('datos corruptos bloquean descarga y no se reparan silenciosamente',async()=>{
  const bad=sample();bad.quotes[0].followUp='2026-02-30';
  const f=fixture({readData:()=>bad});
  await assert.rejects(exportProFollowups(f.deps),/Fecha de seguimiento inválida/);
  assert.equal(f.downloads.length,0);
});
test('namespace local es opaco, estable y no depende de PII',()=>{
  const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)};
  let calls=0;
  const randomUUID=()=>{calls++;return 'aabbccdd-1234-4567-89ab-0123456789ab';};
  const one=localCalendarNamespace(storage,randomUUID);
  assert.equal(one,'cal_aabbccdd1234456789ab0123456789ab');
  assert.equal(localCalendarNamespace(storage,randomUUID),one);
  assert.equal(calls,1);
  assert.ok(!one.includes('@'));
});
test('falla de almacenamiento o generador inseguro impide crear UID',()=>{
  assert.throws(()=>localCalendarNamespace({getItem:()=>null,setItem:()=>{}},()=> 'guessable'),/seguro/);
  assert.throws(()=>localCalendarNamespace({getItem:()=>null,setItem:()=>{throw Error('cuota');}},()=> 'aabbccdd-1234-4567-89ab-0123456789ab'),/cuota/);
});
test('errores de descarga se informan y no se presentan como éxito',async()=>{
  const f=fixture({downloadIcs:async()=>{throw Error('descarga bloqueada');}});
  await assert.rejects(exportProFollowups(f.deps),/descarga bloqueada/);
});
test('adaptador rechaza dependencias incompletas antes de consultar datos',async()=>{
  await assert.rejects(exportProFollowups({verifyPro:async()=>true}),/Integración/);
});

test('lectura asíncrona de datos aislados espera resolución antes de exportar',async()=>{
  const f=fixture({readData:async()=>{f.calls.push('read-async');return sample();}});
  const ics=await exportProFollowups(f.deps);
  assert.deepEqual(f.calls,['verify','read-async','namespace','download']);
  assert.match(ics,/BEGIN:VEVENT/);
});
test('rechazo de lectura asíncrona no crea UID ni descarga datos',async()=>{
  const f=fixture({readData:async()=>{throw Error('lectura aislada fallida');}});
  await assert.rejects(exportProFollowups(f.deps),/lectura aislada fallida/);
  assert.equal(f.downloads.length,0);
});
