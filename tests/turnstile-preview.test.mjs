import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthCaptcha,AUTH_CAPTCHA_ENABLED} from '../auth-captcha.mjs';

function setup(search){
 const scripts=[];
 const elements=[];
 const host={hidden:true,dataset:{},prepend(el){elements.push(el)},append(el){elements.push(el)},querySelector(selector){return selector==='[data-turnstile-qa-status]'?elements.find(el=>el.attribute==='data-turnstile-qa-status'):null}};
 globalThis.location={search};
 globalThis.document={createElement(tag){return {tag,attribute:null,textContent:'',setAttribute(name){this.attribute=name}}},head:{appendChild(el){scripts.push(el)}}};
 let widgetOptions,resetCount=0;
 globalThis.window={turnstile:{render(_host,options){widgetOptions=options;return 42},reset(){resetCount++}}};
 return {host,scripts,elements,getOptions:()=>widgetOptions,getResetCount:()=>resetCount};
}
test('staged CAPTCHA requires completed challenge',()=>{
 assert.equal(AUTH_CAPTCHA_ENABLED,true);
 const env=setup('');
 const captcha=createAuthCaptcha(env.host);
 captcha.activate();
 assert.equal(env.host.hidden,false);
 assert.equal(env.scripts.length,1);
 assert.throws(()=>captcha.requiredToken(),/Completa la verificación/);
 env.scripts[0].onload();
 const options=env.getOptions();
 options.callback('staged-token');
 assert.equal(captcha.requiredToken(),'staged-token');
 captcha.reset();
 assert.equal(env.getResetCount(),1);
 assert.throws(()=>captcha.requiredToken(),/Completa la verificación/);
});
test('expired or errored Turnstile challenge fails closed',()=>{
 const env=setup('');
 const captcha=createAuthCaptcha(env.host);
 captcha.activate();
 env.scripts[0].onload();
 const options=env.getOptions();
 options.callback('one');
 options['expired-callback']();
 assert.throws(()=>captcha.requiredToken(),/Completa la verificación/);
 options.callback('two');
 options['error-callback']();
 assert.throws(()=>captcha.requiredToken(),/Completa la verificación/);
});
test('QA query cannot disable enforced CAPTCHA',()=>{
 const env=setup('?turnstile_qa=1');
 const captcha=createAuthCaptcha(env.host);
 captcha.activate();
 assert.equal(env.scripts.length,1);
 assert.throws(()=>captcha.requiredToken(),/Completa la verificación/);
});
