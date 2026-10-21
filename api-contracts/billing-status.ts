import {ORIGIN,headers,json,mp,db,userFrom,reconcile} from './common.ts';
import {sandboxAccess,safeCheckoutUrl} from './sandbox.mjs';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json(405,{error:'method'});
 if(req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN)return json(403,{error:'origin'});
 let user;try{user=await userFrom(req)}catch{return json(401,{error:'login_required'})}
 try{
 const {action}=await req.json();if(!['status','checkout','cancel'].includes(action))return json(400,{error:'action'});
 const client=db();
 const budget=action==='status'?60:action==='checkout'?5:6;
 const {data:allowed,error:quotaError}=await client.rpc('cotizaflow_consume_api_budget',{p_user:user.id,p_action:action,p_limit:budget});
 if(quotaError){console.error('quota_failed',quotaError.code);return json(503,{error:'rate_limit_unavailable'});}
 if(allowed!==true)return json(429,{error:'too_many_requests'});
 const {data:row,error:er}=await client.from('cotizaflow_mp_subscriptions').select('*').eq('user_id',user.id).maybeSingle();if(er)throw Error('db');
 const {data:catalog,error:ce}=await client.from('cotizaflow_mp_catalog').select('checkout_enabled,currency,monthly_amount').eq('market','CL').single();
 if(ce||!catalog||catalog.currency!=='CLP'||Number(catalog.monthly_amount)!==7990)throw Error('catalog');
 const sandbox=await sandboxAccess(user,mp);
 if(action==='status'){
  const s=row?.provider_subscription_id?await reconcile(client,row,user.email):{status:row?.status||'inactive',plan:'free',payment_verified:false};
  return json(200,{...s,checkout_enabled:catalog.checkout_enabled===true||sandbox,mode:sandbox?'sandbox':'standard',price_clp:7990});
 }
 if(action==='cancel'){
  if(!row?.provider_subscription_id)return json(409,{error:'no_subscription'});
  const current=await reconcile(client,row,user.email);
  if(['cancelled','expired'].includes(current.status))return json(200,{status:current.status,plan:'free'});
  const result=await mp('/preapproval/'+encodeURIComponent(row.provider_subscription_id),'PUT',{status:'canceled'});
  if(!['canceled','cancelled'].includes(String(result.status)))return json(502,{error:'cancel_not_confirmed'});
  const {error}=await client.from('cotizaflow_mp_subscriptions').update({status:'cancelled',last_verified_at:new Date().toISOString()}).eq('user_id',user.id).eq('provider_subscription_id',row.provider_subscription_id);
  if(error)throw Error('cancel_database_failed');
  return json(200,{status:'cancelled',plan:'free'});
 }
 if(!catalog.checkout_enabled&&!sandbox)return json(503,{error:'checkout_disabled'});
 if(!Deno.env.get('MP_ACCESS_TOKEN'))return json(503,{error:'provider_not_configured'});
 if(row?.provider_subscription_id){
  const current=await reconcile(client,row,user.email);
  if(current.plan==='pro')return json(409,{error:'already_subscribed'});
  if(current.status==='pending'&&row.checkout_url)return json(200,{checkout_url:safeCheckoutUrl(row.checkout_url),existing:true});
  if(current.status==='paused')return json(409,{error:'subscription_paused'});
 }
 const {data:reserved,error:re}=await client.rpc('cotizaflow_mp_reserve_checkout',{p_user:user.id});if(re||!reserved?.length)throw Error('reservation_failed');
 const r=reserved[0];
 if(r.reservation==='active')return json(409,{error:'already_subscribed'});
 if(r.reservation==='existing')return json(200,{checkout_url:safeCheckoutUrl(r.stored_url),existing:true});
 if(r.reservation==='in_progress')return json(409,{error:'checkout_in_progress'});
 const sub=await mp('/preapproval','POST',{reason:'CotizaFlow Pro',payer_email:user.email,external_reference:user.id,back_url:ORIGIN+'/',status:'pending',auto_recurring:{frequency:1,frequency_type:'months',transaction_amount:7990,currency_id:'CLP'}},'cotizaflow-'+r.request_id);
 if(!sub?.id||!sub?.init_point)throw Error('provider_checkout_failed');
 const checkoutUrl=safeCheckoutUrl(sub.init_point);
 const {data:saved,error:se}=await client.from('cotizaflow_mp_subscriptions').update({provider_subscription_id:String(sub.id),checkout_url:checkoutUrl,status:'pending'}).eq('user_id',user.id).eq('checkout_request_id',r.request_id).eq('status','creating').select('user_id');
 if(se||!saved?.length)throw Error('checkout_save_failed');
 return json(200,{checkout_url:checkoutUrl,mode:sandbox?'sandbox':'standard'});
 }catch(e){console.error('billing_error',String(e).slice(0,120));return json(503,{error:'checkout_unavailable'})}
});
