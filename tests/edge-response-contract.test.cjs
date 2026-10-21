const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function edge(filename,{allowed=true,hasSubscription=false,verifiedPro=false}={}){
  let handler,providerCalls=0,quotas=[];
  const source=fs.readFileSync('api-contracts/'+filename,'utf8')
    .replace(/^import .*;\s*$/gm,'')
    .replace('v:unknown','v');
  const u={id:'sandbox-user-id',email:'ficticio@example.test'};
  const json=(status,payload)=>new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});
  const headers={'content-type':'application/json','access-control-allow-origin':'https://cotizaflow.sequeidaulabs.com'};
  const db=()=>({
    rpc:async(name,parameters)=>{
      assert.ok(['cotizaflow_consume_api_budget','cotizaflow_consume_aux_budget'].includes(name),name);
      assert.equal(parameters.p_user,u.id);
      quotas.push(parameters);
      return {data:allowed,error:null};
    },
    from:table=>{
      if(table==='cotizaflow_mp_catalog')return {select:()=>({eq:()=>({single:async()=>({
        data:{checkout_enabled:false,currency:'CLP',monthly_amount:7990,internal_provider_secret:'never-return'},
        error:null
      })})})};
      if(table==='cotizaflow_mp_subscriptions')return {select:()=>({eq:()=>({maybeSingle:async()=>({
        data:hasSubscription?{user_id:u.id,provider_subscription_id:'PRIVATE-SUB-ID',status:'authorized',internal_secret:'MUST_NOT_LEAK'}:null,
        error:null
      })})})};
      if(table==='cotizaflow_user_data')return {select:field=>{
        assert.equal(field,'data');
        return {eq:()=>({maybeSingle:async()=>({data:{data:{settings:{currency:'CLP'},quotes:[{
          number:'Q001',status:'enviada',date:'2026-10-21',clientId:'client-1',items:[{name:'Service'}],internal_secret:'NOT_EXPORTED'
        }]}},error:null})})};
      }};
      throw Error('unexpected table '+table);
    }
  });
  const reconcile=async()=>({plan:verifiedPro?'pro':'free',status:'authorized',payment_verified:verifiedPro,providerToken:'SECRET_TO_HIDE'});
  const context={
    Deno:{serve:h=>{handler=h},env:{get:()=>''}},
    Response,Request,URL,TextEncoder,Date,console,db,
    json,headers,ORIGIN:'https://cotizaflow.sequeidaulabs.com',
    userFrom:async()=>u,
    reconcile,
    sandboxAccess:async()=>false,
    safeCheckoutUrl:()=>{throw Error('real checkout not tested')},
    mp:async()=>{providerCalls++;throw Error('provider must not be called')},
  };
  vm.runInNewContext(source,context);
  assert.equal(typeof handler,'function');
  const call=(body={})=>handler(new Request('https://localhost/'+filename,{
    method:'POST',headers:{origin:context.ORIGIN,authorization:'Bearer sandbox-token','content-type':'application/json'},
    body:JSON.stringify(body)
  }));
  return {call,quotas,get providerCalls(){return providerCalls}};
}

test('unauthenticated public access is separately covered in live CORS tests; authenticated plan APIs return minimal fields',async()=>{
  const billing=edge('billing-status.ts');
  const response=await billing.call({action:'status'});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.deepEqual(Object.keys(body).sort(),['status','plan','payment_verified','checkout_enabled','mode','price_clp'].sort());
  assert.equal(body.plan,'free');
  assert.equal(billing.quotas[0].p_action,'status');
  assert.equal(billing.providerCalls,0);

  const access=edge('pro-access.ts',{hasSubscription:true,verifiedPro:true});
  const r=await access.call();
  assert.equal(r.status,200);
  const payload=await r.json();
  assert.deepEqual(Object.keys(payload).sort(),['plan','status','payment_verified'].sort());
  assert.equal(payload.plan,'pro');
  assert.ok(!JSON.stringify(payload).includes('PRIVATE-SUB-ID'));
  assert.ok(!JSON.stringify(payload).includes('SECRET_TO_HIDE'));
});

test('limits are enforced before private queries or any payment provider call',async()=>{
  for(const [file,body] of [
    ['billing-status.ts',{action:'status'}],
    ['pro-access.ts',{}],
    ['pro-report.ts',{}]
  ]){
    const api=edge(file,{allowed:false});
    const r=await api.call(body);
    assert.equal(r.status,429,file);
    assert.deepEqual(await r.json(),{error:'too_many_requests'});
    assert.equal(api.quotas.length,1);
    assert.equal(api.providerCalls,0);
  }
});

test('verified report returns only fixed CSV fields, not internal subscription or quote metadata',async()=>{
  const api=edge('pro-report.ts',{hasSubscription:true,verifiedPro:true});
  const response=await api.call({});
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type'),/text\/csv/);
  const csv=await response.text();
  assert.ok(csv.includes('"numero","estado","fecha","cliente_id","items","moneda"'));
  assert.ok(csv.includes('"Q001"'));
  assert.ok(!csv.includes('PRIVATE-SUB-ID'));
  assert.ok(!csv.includes('NOT_EXPORTED'));
  assert.ok(!csv.includes('SECRET_TO_HIDE'));
  assert.equal(api.quotas[0].p_action,'report');
});
