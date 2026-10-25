import test from 'node:test';
import assert from 'node:assert/strict';
import {duplicateQuote} from '../quote-duplicate.mjs';
import {calc, validateQuote} from '../core.mjs';

const sample=()=>({
  settings:{business:'Taller',currency:'CLP'},
  clients:[{id:'c1',name:'Ana Pérez',phone:'',email:''}],
  quotes:[{
    id:'q1',number:'COT-0001',clientId:'c1',date:'2026-10-18',
    validUntil:'2026-10-25',followUp:'2026-10-21',status:'aceptada',
    discount:10,tax:19,notes:'Instalación eléctrica Ñandú',
    currency:'CLP',updatedAt:'2026-10-18T13:00:00.000Z',
    items:[{id:'item-1',name:'Instalación',qty:2,price:10000,internalToken:'never-copy'}],
    acceptanceToken:'never-copy'
  }]
});
const ids=(...values)=>{let n=0;return ()=>values[n++];};

test('duplica con IDs, número, fechas y estado nuevos; conserva importes sin mutar origen',()=>{
  const data=sample(),before=structuredClone(data);
  const copy=duplicateQuote(data,'q1',{date:'2026-10-24',idFactory:ids('q2','item-2')});
  assert.equal(copy.id,'q2');
  assert.equal(copy.number,'COT-0002');
  assert.equal(copy.status,'borrador');
  assert.equal(copy.date,'2026-10-24');
  assert.equal(copy.validUntil,'2026-11-08');
  assert.equal(copy.followUp,'2026-10-27');
  assert.equal(copy.clientId,'c1');
  assert.equal(copy.currency,'CLP');
  assert.equal(copy.notes,'Instalación eléctrica Ñandú');
  assert.equal(copy.items[0].id,'item-2');
  assert.equal(calc(copy.items,copy.discount,copy.tax).total,21420);
  assert.deepEqual(validateQuote(copy,data.clients),[]);
  assert.deepEqual(data,before);
  assert.notStrictEqual(copy.items,data.quotes[0].items);
  assert.notStrictEqual(copy.items[0],data.quotes[0].items[0]);
  copy.items[0].name='Cambiado';
  assert.equal(data.quotes[0].items[0].name,'Instalación');
});

test('no copia estado de aceptación, fechas viejas, metadata interna ni tokens',()=>{
  const data=sample();
  const copy=duplicateQuote(data,'q1',{date:'2026-10-24',idFactory:ids('q2','item-2')});
  assert.deepEqual(Object.keys(copy).sort(),[
    'id','number','clientId','date','validUntil','followUp','status',
    'items','discount','tax','notes','currency'
  ].sort());
  assert.deepEqual(Object.keys(copy.items[0]).sort(),['id','name','qty','price'].sort());
  assert.equal(copy.acceptanceToken,undefined);
  assert.equal(copy.updatedAt,undefined);
  assert.equal(copy.items[0].internalToken,undefined);
});

test('rechaza fuente inválida, cliente inexistente, fecha imposible y número ausente',()=>{
  const data=sample();
  assert.throws(()=>duplicateQuote(data,'missing',{date:'2026-10-24'}),/no encontrada/);
  data.quotes[0].clientId='other';
  assert.throws(()=>duplicateQuote(data,'q1',{date:'2026-10-24'}),/original no válida/);
  data.quotes[0].clientId='c1';
  assert.throws(()=>duplicateQuote(data,'q1',{date:'2026-02-30'}),/Fecha no válida/);
  assert.throws(()=>duplicateQuote(data,'q1',{date:'2026-10-24',followUp:'2026-13-01'}),/Fecha no válida/);
  data.quotes[0].number='';
  assert.throws(()=>duplicateQuote(data,'q1',{date:'2026-10-24'}),/original no válida/);
});

test('rechaza IDs repetidos, malformados y cantidades inválidas sin escribir datos',()=>{
  const data=sample(),before=structuredClone(data);
  assert.throws(()=>duplicateQuote(data,'q1',{date:'2026-10-24',idFactory:ids('q1','item-2')}),/ID nuevo/);
  assert.throws(()=>duplicateQuote(data,'q1',{date:'2026-10-24',idFactory:ids('q2','item-1')}),/ID nuevo/);
  assert.throws(()=>duplicateQuote(data,'q1',{date:'2026-10-24',idFactory:ids('q2','bad id')}),/ID nuevo/);
  assert.throws(()=>duplicateQuote(data,'q1',{date:'2026-10-24',idFactory:'not-a-function'}),/Generador/);
  assert.deepEqual(data,before);
  data.quotes[0].items[0].qty=Infinity;
  assert.throws(()=>duplicateQuote(data,'q1',{date:'2026-10-24'}),/Servicios originales/);
});

test('numeración evita duplicados y los plazos cruzan años sin errores DST',()=>{
  const data=sample();
  data.quotes.push({...structuredClone(data.quotes[0]),id:'q3',number:'COT-0002'});
  const copy=duplicateQuote(data,'q1',{date:'2026-12-30',idFactory:ids('q4','item-4')});
  assert.equal(copy.number,'COT-0003');
  assert.equal(copy.validUntil,'2027-01-14');
  assert.equal(copy.followUp,'2027-01-02');
  const leap=duplicateQuote(sample(),'q1',{date:'2028-02-28',idFactory:ids('q5','item-5')});
  assert.equal(leap.followUp,'2028-03-02');
  assert.equal(leap.validUntil,'2028-03-14');
});
