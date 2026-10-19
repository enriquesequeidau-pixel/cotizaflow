export const STATUSES = ['borrador','enviada','aceptada','rechazada'];
export const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const clean = v => String(v ?? '').trim();
export const cents = v => Math.round(Number(v || 0) * 100);
export const money = (v,currency='CLP') => new Intl.NumberFormat('es-CL',{style:'currency',currency,maximumFractionDigits:currency==='CLP'?0:2}).format(v);
export function calc(items, discount=0, tax=0) {
  const subtotal = items.reduce((sum,item)=>sum + Math.round(cents(item.price)*Number(item.qty||0)),0);
  const discountCents=Math.round(subtotal*Number(discount||0)/100);
  const taxCents=Math.round((subtotal-discountCents)*Number(tax||0)/100);
  return {subtotal:subtotal/100,discount:discountCents/100,tax:taxCents/100,total:(subtotal-discountCents+taxCents)/100};
}
export function validateQuote(q,clients){
  const errs=[];
  if(!clients.find(c=>c.id===q.clientId))errs.push('Selecciona un cliente válido.');
  if(!Array.isArray(q.items)||q.items.length===0)errs.push('Agrega al menos un servicio.');
  for(const it of q.items||[]){if(!clean(it.name))errs.push('Los servicios requieren descripción.');if(!Number.isFinite(Number(it.qty))||Number(it.qty)<=0)errs.push('La cantidad debe ser mayor a cero.');if(!Number.isFinite(Number(it.price))||Number(it.price)<0)errs.push('El precio no puede ser negativo.');}
  if(!Number.isFinite(Number(q.discount))||q.discount<0||q.discount>100)errs.push('Descuento fuera de rango.');
  if(!Number.isFinite(Number(q.tax))||q.tax<0||q.tax>100)errs.push('Impuesto fuera de rango.');
  if(!STATUSES.includes(q.status))errs.push('Estado no válido.');
  return [...new Set(errs)];
}
export const initialData=()=>({settings:{business:'Mi negocio',phone:'',email:'',currency:'CLP',tax:0},clients:[],services:[],quotes:[]});
export function normalize(data){const d=initialData();if(!data||typeof data!=='object')return d;return {settings:{...d.settings,...(data.settings||{})},clients:Array.isArray(data.clients)?data.clients:[],services:Array.isArray(data.services)?data.services:[],quotes:Array.isArray(data.quotes)?data.quotes:[]};}
export function makeWhatsAppLink(q,client,business,currency){
  const t=calc(q.items,q.discount,q.tax);const lines=[`Hola ${client.name}, te compartimos la cotización ${q.number} de ${business}.`,'',...q.items.map(i=>`• ${i.name}: ${i.qty} × ${money(i.price,currency)}`),`Total: ${money(t.total,currency)}`,`Válida hasta: ${q.validUntil||'a convenir'}`,q.notes?`Notas: ${q.notes}`:'','¿Tienes alguna consulta?'].filter(Boolean).join('\n');
  const phone=String(client.phone||'').replace(/\D/g,'');
  return `${phone?`https://wa.me/${phone}`:'https://api.whatsapp.com/send'}?text=${encodeURIComponent(lines)}`;
}
const latin=s=>String(s??'').replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2022]/g,'-').replace(/[^\x0a\x0d\x20-\x7e\u00a0-\u00ff]/g,'?');
const esc=s=>latin(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
function wrap(s,width=86){let lines=[];for(const para of String(s??'').split('\n')){let line='';for(const word of para.split(/\s+/)){if(!word)continue;if((line+' '+word).trim().length>width){if(line)lines.push(line);line=word;}else line=(line+' '+word).trim();}lines.push(line);}return lines;}
export function pdfBytes(q,client,settings){
  // Dependency-free PDF 1.4, with Latin-1 / WinAnsi text and automatic pagination.
  const currency=settings.currency||'CLP';const totals=calc(q.items,q.discount,q.tax);const pages=[];let ops=[],y=785;
  const page=()=>{if(ops.length)pages.push(ops.join('\n'));ops=[];y=785;};
  const line=(str,size=10,bold=false,x=46,step=16)=>{if(y<65)page();ops.push(`BT /${bold?'F2':'F1'} ${size} Tf 0.14 0.19 0.29 rg ${x} ${y} Td (${esc(str)}) Tj ET`);y-=step;};
  const rule=()=>{if(y<65)page();ops.push(`0.80 0.84 0.89 RG 0.8 w 46 ${y} m 549 ${y} l S`);y-=17;};
  line(settings.business||'Mi negocio',19,true,46,28);
  if(settings.phone)line(`Teléfono: ${settings.phone}`);if(settings.email)line(`Email: ${settings.email}`);
  y-=12;rule();line('COTIZACIÓN',18,true,46,29);line(`Número: ${q.number}      Fecha: ${q.date}      Estado: ${q.status.toUpperCase()}`,10,false,46,18);
  line(`Cliente: ${client.name}`,11,true);if(client.phone)line(`Teléfono del cliente: ${client.phone}`);if(client.email)line(`Email del cliente: ${client.email}`);
  line(`Vigencia: ${q.validUntil||'A convenir'}`);y-=8;rule();
  line('DESCRIPCIÓN / CANTIDAD / PRECIO / IMPORTE',10,true,46,20);
  for(const it of q.items){const amount=Number(it.qty)*Number(it.price);for(const [n,part] of wrap(it.name,65).entries())line(n===0?`${part}`:`  ${part}`,10,n===0,46,15);line(`${it.qty} x ${money(it.price,currency)}     =     ${money(amount,currency)}`,9,false,60,21);}
  rule();line(`Subtotal: ${money(totals.subtotal,currency)}`,11,false,46,18);
  if(q.discount)line(`Descuento (${q.discount}%): -${money(totals.discount,currency)}`,10);
  if(q.tax)line(`Impuesto (${q.tax}%): ${money(totals.tax,currency)}`,10);
  line(`TOTAL: ${money(totals.total,currency)}`,16,true,46,29);
  if(q.notes){line('OBSERVACIONES',10,true);for(const str of wrap(q.notes,82))line(str,9,false,46,14);}
  line('Documento informativo, no es factura tributaria.',8,false,46,14);
  page();
  const objs=[];const add=s=>{objs.push(s);return objs.length;};
  const catalog=add('');const pagesId=add('');const font1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');const font2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds=[];
  for(const commands of pages){const data=latin(commands)+'\n';const streamId=add(`<< /Length ${data.length} >>\nstream\n${data}endstream`);const pageId=add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> >> /Contents ${streamId} 0 R >>`);pageIds.push(pageId);}
  objs[catalog-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(i=>i+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
  // Byte offsets match Latin-1 encoded PDF strings.
  let out='%PDF-1.4\n%âãÏÓ\n';const offsets=[0];for(let i=0;i<objs.length;i++){offsets.push(out.length);out+=`${i+1} 0 obj\n${objs[i]}\nendobj\n`;}
  const start=out.length;out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;for(let i=1;i<offsets.length;i++)out+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  out+=`trailer\n<< /Size ${objs.length+1} /Root ${catalog} 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Uint8Array.from(out,c=>c.charCodeAt(0)&255);
}
