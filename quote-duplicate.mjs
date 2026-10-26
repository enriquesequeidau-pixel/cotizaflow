/*
 * CotizaFlow Pro v2 — pure, local quote-duplication primitive.
 * This module is NOT wired to the Free editor or a Pro entitlement yet.
 * The caller must verify Pro server-side before exposing a premium action.
 */
import {uid, validateQuote} from './core.mjs';
import {nextQuoteNumber, localDate} from './workflow.mjs';

const ID=/^[A-Za-z0-9_-]{1,100}$/;
const CURRENCIES=new Set(['CLP','MXN','COP','PEN','USD']);

function checkedDate(value) {
  if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError('Fecha no válida.');
  const parsed=new Date(value+'T12:00:00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==value) throw new RangeError('Fecha no válida.');
  return value;
}

function plusCalendarDays(date, days) {
  const parsed=new Date(checkedDate(date)+'T12:00:00Z');
  parsed.setUTCDate(parsed.getUTCDate()+days);
  return parsed.toISOString().slice(0,10);
}

export function duplicateQuote(data, sourceId, options={}) {
  const {quotes, clients, settings}=data||{};
  if (!Array.isArray(quotes) || !Array.isArray(clients)) throw new TypeError('Datos de cotizaciones no válidos.');
  const source=quotes.find(q=>q && q.id===sourceId);
  if (!source) throw new Error('Cotización original no encontrada.');
  if (!ID.test(source.id) || typeof source.number!=='string' || !source.number.trim() || source.number.length>40) throw new Error('Cotización original no válida.');
  if (!Array.isArray(source.items) || !source.items.length || source.items.length>500) throw new Error('Servicios originales no válidos.');
  if (source.items.some(item=>!item || typeof item.name!=='string' || !item.name.trim() || item.name.length>180 ||
      typeof item.qty!=='number' || !Number.isFinite(item.qty) || item.qty<=0 || item.qty>1e9 ||
      typeof item.price!=='number' || !Number.isFinite(item.price) || item.price<0 || item.price>1e12)) {
    throw new Error('Servicios originales no válidos.');
  }
  if (typeof source.discount!=='number' || typeof source.tax!=='number' ||
      typeof source.notes!=='string' || source.notes.length>1200 ||
      validateQuote(source,clients).length) throw new Error('Cotización original no válida.');
  const currency=source.currency||settings?.currency||'CLP';
  if (!CURRENCIES.has(currency)) throw new Error('Moneda no válida.');
  const date=checkedDate(options.date??localDate());
  const validUntil=checkedDate(options.validUntil??plusCalendarDays(date,15));
  const followUp=checkedDate(options.followUp??plusCalendarDays(date,3));
  const idFactory=options.idFactory??uid;
  if (typeof idFactory!=='function') throw new TypeError('Generador de ID no válido.');
  const usedQuotes=new Set(quotes.map(q=>q?.id));
  const usedItems=new Set(quotes.flatMap(q=>Array.isArray(q?.items)?q.items.map(i=>i?.id):[]));
  function nextId(used) {
    const id=idFactory();
    if (typeof id!=='string' || !ID.test(id) || used.has(id)) throw new Error('ID nuevo no válido o repetido.');
    used.add(id);
    return id;
  }
  const id=nextId(usedQuotes);
  const items=source.items.map(item=>({
    id:nextId(usedItems), name:item.name, qty:item.qty, price:item.price
  }));
  const result={
    id,number:nextQuoteNumber(quotes),clientId:source.clientId,date,validUntil,followUp,
    status:'borrador',items,discount:source.discount,tax:source.tax,
    notes:source.notes,currency
  };
  if (validateQuote(result,clients).length) throw new Error('La copia no supera la validación.');
  return result;
}
