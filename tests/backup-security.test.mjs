import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBackup} from '../backup.mjs';

const fixture=()=>({
  settings:{business:'Negocio prueba',phone:'',email:'',currency:'CLP',tax:0},
  clients:[{id:'client-1',name:'Ana',phone:'',email:''}],
  services:[{id:'service-1',name:'Reparación',price:25000}],
  quotes:[{
    id:'quote-1',number:'COT-0001',clientId:'client-1',date:'2026-10-21',
    validUntil:'',followUp:'',status:'borrador',
    items:[{id:'item-1',name:'Reparación',qty:1,price:25000}],
    discount:0,tax:0,notes:'',currency:'CLP'
  }]
});

test('el respaldo conserva únicamente campos públicos esperados, nunca privilegios o propiedad forjados',()=>{
  const x=fixture();
  x.isPro=true;x.user_id='victim';x.payment_verified=true;
  x.settings.isAdmin=true;
  x.clients[0].user_id='victim';
  x.quotes[0].owner='victim';x.quotes[0].plan='pro';
  x.quotes[0].items[0].hiddenSecret='example';
  const normalized=validateBackup(x);
  assert.deepEqual(Object.keys(normalized).sort(),['settings','clients','services','quotes'].sort());
  assert.equal(normalized.user_id,undefined);
  assert.equal(normalized.payment_verified,undefined);
  assert.equal(normalized.settings.isAdmin,undefined);
  assert.equal(normalized.clients[0].user_id,undefined);
  assert.equal(normalized.quotes[0].plan,undefined);
  assert.equal(normalized.quotes[0].owner,undefined);
  assert.equal(normalized.quotes[0].items[0].hiddenSecret,undefined);
});

test('HTML hostil se mantiene como texto de usuario, sin transformarse en etiquetas',()=>{
  const payload='<img src=x onerror=window.__cotiza_xss=1>';
  const x=fixture();
  x.clients[0].name=payload;x.quotes[0].notes='<svg onload=alert(1)></svg>';
  const saved=validateBackup(x);
  assert.equal(saved.clients[0].name,payload);
  assert.equal(saved.quotes[0].notes,'<svg onload=alert(1)></svg>');
});

test('rechaza estados, referencias, fechas, duplicados, importes y formatos inválidos',()=>{
  const changes=[
    x=>{x.settings.currency='INVALID'},
    x=>{x.clients.push({...x.clients[0]})},
    x=>{x.quotes[0].clientId='victim'},
    x=>{x.quotes[0].status='paid'},
    x=>{x.quotes[0].date='2026-02-30'},
    x=>{x.quotes[0].items[0].qty=Number.POSITIVE_INFINITY},
    x=>{x.quotes[0].items[0].price=-1},
    x=>{x.quotes[0].items=[]},
    x=>{x.quotes[0].number=' '},
    x=>{x.quotes[0].notes='X'.repeat(1201)},
    x=>{x.quotes[0].items[0].name=' '},
    x=>{x.quotes[0].currency='BTC'},
    x=>{x.quotes[0].items[0].price=1e13},
    x=>{x.services[0].price=Number.NaN},
    x=>{x.quotes[0].discount=110},
    x=>{x.quotes[0].items=Array.from({length:501},()=>({name:'a',qty:1,price:1}))}
  ];
  for(const mutate of changes){
    const x=fixture();mutate(x);
    assert.throws(()=>validateBackup(x),/Respaldo no válido/,mutate.toString());
  }
});

test('un respaldo válido recupera los datos normalizados para la interfaz',()=>{
  const valid=validateBackup(fixture());
  assert.equal(valid.quotes.length,1);
  assert.equal(valid.quotes[0].items[0].name,'Reparación');
  assert.equal(valid.settings.currency,'CLP');
});
