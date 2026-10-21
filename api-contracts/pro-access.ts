import {ORIGIN,headers,json,db,userFrom,reconcile} from './common.ts';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return json(405,{error:'method'});
 if(req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN)return json(403,{error:'origin'});
 try{
  const user=await userFrom(req);
  const quotaClient=db();const {data:allowed,error:quotaError}=await quotaClient.rpc('cotizaflow_consume_aux_budget',{p_user:user.id,p_action:'plan_access',p_limit:60});if(quotaError)return json(503,{error:'rate_limit_unavailable'});if(allowed!==true)return json(429,{error:'too_many_requests'});
  const client=db();
  const {data:row,error}=await client.from('cotizaflow_mp_subscriptions').select('*').eq('user_id',user.id).maybeSingle();
  if(error)throw Error('database');
  if(!row?.provider_subscription_id)return json(200,{plan:'free',status:'inactive'});
  const state=await reconcile(client,row,user.email);
  return json(200,{plan:state.plan==='pro'?'pro':'free',status:state.status,payment_verified:state.payment_verified===true});
 }catch(e){const msg=String(e);
  if(msg.includes('auth_required'))return json(401,{error:'login_required'});
  console.error('pro_access:',msg.slice(0,120));
  return json(503,{error:'verification_unavailable'});
 }
});