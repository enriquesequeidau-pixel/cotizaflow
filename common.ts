// CotizaFlow — Mercado Pago Chile, backend compartido. Credenciales SOLO en secretos de Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
export const ORIGIN='https://enriquesequeidau-pixel.github.io';
export const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type'};
export const json=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
export const secret=(n:string)=>Deno.env.get(n)||'';
export function db(){return createClient(secret('SUPABASE_URL'),secret('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})}
export async function userFrom(req:Request){const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!token)throw Error('auth_required');const c=createClient(secret('SUPABASE_URL'),secret('SUPABASE_ANON_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await c.auth.getUser(token);if(error||!data.user?.id||!data.user?.email||!data.user.email_confirmed_at)throw Error('auth_required');return data.user;}
export async function mp(path:string,method='GET',payload?:unknown,requestId?:string){if(!secret('MP_ACCESS_TOKEN'))throw Error('mp_not_configured');const r=await fetch('https://api.mercadopago.com'+path,{method,headers:{Authorization:'Bearer '+secret('MP_ACCESS_TOKEN'),Accept:'application/json',...(payload?{'Content-Type':'application/json'}:{}),...(requestId?{'X-Idempotency-Key':requestId}:{})},...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(11000)});if(!r.ok){console.error('mp_error_http',r.status);throw Error('mp_http_'+r.status)}return await r.json();}
export const goodStatus=(s:string)=>['pending','authorized','paused','cancelled','expired','inactive'].includes(s)?s:s==='canceled'?'cancelled':'inactive';
export function assertSubscription(sub:any,row:any,email:string){const a=sub?.auto_recurring||{};if(!sub||String(sub.id)!==String(row.provider_subscription_id)||String(sub.external_reference)!==String(row.user_id)||String(sub.payer_email||'').toLowerCase()!==String(email).toLowerCase()||a.currency_id!=='CLP'||Number(a.transaction_amount)!==7990||Number(a.frequency)!==1||a.frequency_type!=='months'||row.currency!=='CLP'||Number(row.amount)!==7990)throw Error('provider_data_mismatch');return goodStatus(String(sub.status));}
export async function validPaidInvoice(subId:string){
 const invoices=await mp('/authorized_payments/search?preapproval_id='+encodeURIComponent(subId)+'&limit=100');
 if(!Array.isArray(invoices.results))throw Error('payment_list_invalid');
 const now=Date.now();
 for(const inv of invoices.results){
  if(String(inv.preapproval_id)!==subId||inv.currency_id!=='CLP'||Number(inv.transaction_amount)!==7990||String(inv.payment?.status)!=='approved'||!inv.payment?.id)continue;
  const date=Date.parse(inv.debit_date||inv.date_created||'');if(!Number.isFinite(date)||date>now+86_400_000||now-date>34*86_400_000)continue;
  // A paid invoice is necessary, but verify the actual settled payment from the provider as well.
  const paid=await mp('/v1/payments/'+encodeURIComponent(String(inv.payment.id)));
  if(paid.status==='approved'&&paid.currency_id==='CLP'&&Number(paid.transaction_amount)===7990&&String(paid.id)===String(inv.payment.id))return true;
 }
 return false;
}
export async function reconcile(dbClient:any,row:any,email:string){
 if(!row?.provider_subscription_id)return {plan:'free',status:row?.status||'inactive'};
 const sub=await mp('/preapproval/'+encodeURIComponent(String(row.provider_subscription_id)));
 const status=assertSubscription(sub,row,email);
 const paid=status==='authorized'?await validPaidInvoice(String(row.provider_subscription_id)):false;
 const {error}=await dbClient.from('cotizaflow_mp_subscriptions').update({status,last_verified_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('user_id',row.user_id).eq('provider_subscription_id',row.provider_subscription_id);
 if(error)throw Error('reconcile_db_failed');
 return {plan:paid?'pro':'free',status,payment_verified:paid};
}
