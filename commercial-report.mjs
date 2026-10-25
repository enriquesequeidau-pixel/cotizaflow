/*
 * CotizaFlow Pro v2 — pure commercial report, NOT a payment/revenue report.
 * Never expose through an API or Pro UI without a fresh server-side entitlement.
 * No data is persisted, transmitted, or modified by this module.
 */
import {calc} from './core.mjs';
import {localDate} from './workflow.mjs';

const STATUSES=new Set(['borrador','enviada','aceptada','rechazada']);
const CURRENCIES=new Set(['CLP','MXN','COP','PEN','USD']);
const FUNNEL=new Set(['enviada','aceptada','rechazada']);

function isoDate(value,label,{optional=false}={}) {
  if(optional && (value==='' || value==null)) return '';
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError(label+' inválida.');
  const date=new Date(value+'T12:00:00Z');
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value) throw new RangeError(label+' inválida.');
  return value;
}
function moneySafe(amount) {
  if(!Number.isFinite(amount)||!Number.isSafeInteger(Math.round(amount*100))) throw new RangeError('Importe fuera de rango seguro.');
  return amount;
}
function checkedQuote(q,currency) {
  if(!q||typeof q!=='object'||typeof q.id!=='string'||!q.id||typeof q.number!=='string'||!q.number||
    typeof q.clientId!=='string'||!q.clientId||!STATUSES.has(q.status)) throw new TypeError('Cotización no válida.');
  isoDate(q.date,'Fecha de cotización');
  isoDate(q.validUntil,'Vigencia',{optional:true});
  isoDate(q.followUp,'Seguimiento',{optional:true});
  if((q.currency||currency)!==currency) throw new Error('No se pueden sumar monedas diferentes.');
  if(!Number.isFinite(q.discount)||q.discount<0||q.discount>100||
    !Number.isFinite(q.tax)||q.tax<0||q.tax>100||
    !Array.isArray(q.items)||q.items.length===0||q.items.length>500) throw new TypeError('Importes de cotización no válidos.');
  for(const item of q.items) {
    if(!item||typeof item.name!=='string'||!item.name.trim()||
      !Number.isFinite(item.qty)||item.qty<=0||item.qty>1e9||
      !Number.isFinite(item.price)||item.price<0||item.price>1e12) throw new TypeError('Servicio no válido.');
  }
  return moneySafe(calc(q.items,q.discount,q.tax).total);
}
function cents(value) { return Math.round(value*100); }

/**
 * Count "sent funnel" as current status enviada, aceptada or rechazada.
 * This is an approximation based on current status, NOT historical delivery evidence.
 * Total quoted includes drafts. Accepted is NOT paid revenue.
 */
export function buildCommercialReport(data,options={}) {
  if(!data||!Array.isArray(data.quotes)) throw new TypeError('Lista de cotizaciones no válida.');
  const from=isoDate(options.from,'Fecha inicial',{optional:true});
  const to=isoDate(options.to,'Fecha final',{optional:true});
  const today=isoDate(options.today??localDate(),'Fecha actual');
  if(from&&to&&from>to) throw new RangeError('Período invertido.');
  const clientId=options.clientId??'';
  if(typeof clientId!=='string') throw new TypeError('Filtro de cliente no válido.');
  const currency=data.settings?.currency||'CLP';
  if(!CURRENCIES.has(currency)) throw new Error('Moneda no válida.');
  const names=new Map((Array.isArray(data.clients)?data.clients:[])
    .filter(c=>c&&typeof c.id==='string')
    .map(c=>[c.id,typeof c.name==='string'?c.name:'']));
  const rows=[],seen=new Set();
  const counts={total:0,borrador:0,enviada:0,aceptada:0,rechazada:0,
    embudoEnviado:0,vencidas:0,seguimientosVencidos:0,seguimientosProximos:0};
  let totalCents=0,acceptedCents=0;
  for(const q of data.quotes) {
    if(!q||typeof q!=='object') throw new TypeError('Cotización no válida.');
    const date=isoDate(q.date,'Fecha de cotización');
    if((from&&date<from)||(to&&date>to)||(clientId&&q.clientId!==clientId)) continue;
    if(seen.has(q.id)) throw new Error('Cotizaciones duplicadas en el reporte.');
    seen.add(q.id);
    const total=checkedQuote(q,currency);
    const amountCents=cents(total);
    totalCents+=amountCents;
    if(q.status==='aceptada') acceptedCents+=amountCents;
    if(!Number.isSafeInteger(totalCents)||!Number.isSafeInteger(acceptedCents)) throw new RangeError('Total fuera de rango seguro.');
    counts.total++;
    counts[q.status]++;
    if(FUNNEL.has(q.status)) counts.embudoEnviado++;
    if(q.status==='enviada') {
      if(q.validUntil&&q.validUntil<today) counts.vencidas++;
      if(q.followUp&&q.followUp<=today) counts.seguimientosVencidos++;
      else if(q.followUp&&q.followUp>today) counts.seguimientosProximos++;
    }
    rows.push({id:q.id,number:q.number,clientId:q.clientId,clientName:names.get(q.clientId)||'',
      date:q.date,validUntil:q.validUntil||'',followUp:q.followUp||'',status:q.status,currency,total});
  }
  const acceptanceRate=counts.embudoEnviado
    ?Math.round(counts.aceptada/counts.embudoEnviado*10000)/100:0;
  return {currency,filters:{from,to,clientId,today},counts,
    totalQuoted:totalCents/100,acceptedValue:acceptedCents/100,acceptanceRate,rows,
    disclaimer:'Valores cotizados y aceptados; no representan pagos, ingresos cobrados ni facturación.'};
}

function csvCell(value) {
  let s=String(value??'');
  // Leading whitespace, BOM or zero-width marks can disguise spreadsheet formulas.
  if(/^[\s\uFEFF\u200B-\u200D]*[=+\-@]/u.test(s)) s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
/** Export only allowlisted report columns, with spreadsheet formula neutralization. */
export function commercialReportCsv(report) {
  if(!report||!Array.isArray(report.rows)) throw new TypeError('Reporte no válido.');
  const header=['numero','cliente','fecha','vigencia','seguimiento','estado','moneda','total_cotizado'];
  const lines=[header.map(csvCell).join(',')];
  for(const row of report.rows) {
    lines.push([row.number,row.clientName,row.date,row.validUntil,row.followUp,row.status,row.currency,row.total]
      .map(csvCell).join(','));
  }
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
