import assert from 'node:assert/strict';
import {test} from 'node:test';
import {rememberCheckoutRedirect,consumeCheckoutRedirect,subscriptionReturnMessage} from './billing-return.mjs';

test('marks and consumes a single short-lived checkout return',()=>{
 const map=new Map();
 const store={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 const now=1792811200000;
 assert.equal(rememberCheckoutRedirect(store,now),true);
 assert.equal(consumeCheckoutRedirect(store,now+60_000),true);
 assert.equal(consumeCheckoutRedirect(store,now+60_000),false);
});
test('stale and forged session markers are rejected',()=>{
 const map=new Map(),store={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
 rememberCheckoutRedirect(store,1792811200000);
 assert.equal(consumeCheckoutRedirect(store,1792901200000),false);
 map.set('cotizaflow_mp_checkout_started_at','javascript:alert(1)');
 assert.equal(consumeCheckoutRedirect(store,1792811200000),false);
});
test('only verified server payment can be described as Pro active',()=>{
 assert.match(subscriptionReturnMessage({status:'authorized',plan:'pro',payment_verified:false}),/Todavía no/);
 assert.match(subscriptionReturnMessage({status:'pending',plan:'pro',payment_verified:true}),/confirmado/);
 assert.match(subscriptionReturnMessage({status:'authorized',plan:'pro',payment_verified:true}),/activo/);
 assert.doesNotMatch(subscriptionReturnMessage({status:'pending'}),/activo/);
 assert.match(subscriptionReturnMessage({status:'cancelled'}),/no está activa/);
});
