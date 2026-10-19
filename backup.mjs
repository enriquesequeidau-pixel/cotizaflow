import {initialData, STATUSES, calc} from './core.mjs';
export const CURRENCIES = ['CLP','MXN','COP','PEN','USD'];
const fail = () => { throw new Error('Respaldo no válido: revisa campos, importes y referencias.'); };
const obj = v => { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(); return v; };
const str = (v, max, required=false) => { if (typeof v !== 'string' || v.length>max || (required&&!v.trim())) fail(); return v; };
const num = (v,min,max) => { if (typeof v!=='number'||!Number.isFinite(v)||v<min||v>max) fail(); return v; };
const id = v => { if(typeof v!=='string'||! /^[a-zA-Z0-9_-]{1,100}$/.test(v)) fail(); return v; };
const date = (v,required=false) => { str(v,10,required); if(v && (!/^\d{4}-\d{2}-\d{2}$/.test(v)|| !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10)!==v)) fail(); return v; };
const rows = v => { if(!Array.isArray(v)||v.length>10000) fail(); const seen=new Set(); return v.map(x=>{obj(x);id(x.id);if(seen.has(x.id))fail();seen.add(x.id);return x;}); };
export function validateBackup(input) {
  obj(input); const s=obj(input.settings ?? initialData().settings);
  if(!CURRENCIES.includes(s.currency)) fail();
  const settings={business:str(s.business,100,true),phone:str(s.phone,25),email:str(s.email,120),currency:s.currency,tax:num(s.tax,0,100)};
  const clients=rows(input.clients).map(c=>({id:c.id,name:str(c.name,100,true),phone:str(c.phone,25),email:str(c.email,120)}));
  const services=rows(input.services).map(s=>({id:s.id,name:str(s.name,100,true),price:num(s.price,0,1e12)}));
  const numbers=new Set();
  const quotes=rows(input.quotes).map(q=>{
    if(!clients.some(c=>c.id===q.clientId)||!STATUSES.includes(q.status))fail();
    const number=str(q.number,40,true);if(numbers.has(number))fail();numbers.add(number);
    if(!Array.isArray(q.items)||q.items.length===0||q.items.length>500)fail();
    const items=q.items.map(i=>{obj(i);return {id:i.id===undefined?undefined:id(i.id),name:str(i.name,180,true),qty:num(i.qty,0.01,1e9),price:num(i.price,0,1e12)};});
    const discount=num(q.discount,0,100),tax=num(q.tax,0,100);
    if(!Number.isSafeInteger(Math.round(calc(items,discount,tax).total*100)))fail();
    const currency=q.currency??settings.currency;if(!CURRENCIES.includes(currency))fail();
    return {id:q.id,number,clientId:q.clientId,date:date(q.date,true),validUntil:date(q.validUntil),followUp:date(q.followUp),status:q.status,items,discount,tax,notes:str(q.notes,1200),currency};
  });
  return {settings,clients,services,quotes};
}
