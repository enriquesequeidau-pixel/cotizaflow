import {ORIGIN,headers,json,db,userFrom,reconcile} from './common.ts';
function safeCsv(v:unknown){let s=String(v??'').replace(/\r|\n/g,' ');if(/^[=+@\-\t]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json(405,{error:'method'});
 if(req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN)return json(403,{error:'origin'});
 try{
 const user=await userFrom(req),client=db();
 const {data:sub,error:e}=await client.from('cotizaflow_mp_subscriptions').select('*').eq('user_id',user.id).maybeSingle();if(e||!sub?.provider_subscription_id)return json(403,{error:'Necesitas Pro con un pago verificado.'});
 const status=await reconcile(client,sub,user.email);if(status.plan!=='pro')return json(403,{error:'Necesitas Pro con un pago verificado.'});
 const {data:saved,error:be}=await client.from('cotizaflow_user_data').select('data').eq('user_id',user.id).maybeSingle();if(be)throw Error('backup');
 const entries=Array.isArray(saved?.data?.quotes)?saved.data.quotes:[];if(entries.length>10000)throw Error('report_too_large');
 const lines=[['numero','estado','fecha','cliente_id','items','moneda'].map(safeCsv).join(',')];
 for(const q of entries){lines.push([q.number||'',q.status||'',q.date||'',q.clientId||'',Array.isArray(q.items)?q.items.length:0,saved?.data?.settings?.currency||'CLP'].map(safeCsv).join(','));}
 return new Response('\uFEFF'+lines.join('\r\n'),{status:200,headers:{...headers,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="cotizaflow-reporte-pro.csv"'}});
 }catch(e){console.error('report:',String(e).slice(0,130));return json(503,{error:'Reporte temporalmente no disponible.'})}
});
