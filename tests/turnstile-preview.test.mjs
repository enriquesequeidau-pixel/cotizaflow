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
test('normal sign-in remains unchanged while CAPTCHA backend is disabled',()=>{
 assert.equal(AUTH_CAPTCHA_ENABLED,false);
 const env=setup('');
 const captcha=createAuthCaptcha(env.host);
 captcha.activate();
 assert.equal(env.host.hidden,true);
 assert.equal(env.scripts.length,0);
 assert.equal(captcha.requiredToken(),undefined);
});
test('opt-in QA visibly renders managed challenge but never enforces or transmits token',()=>{
 const env=setup('?turnstile_qa=1');
 const captcha=createAuthCaptcha(env.host);
 captcha.activate();
 assert.equal(env.host.hidden,false);
 assert.equal(env.scripts.length,1);
 assert.equal(env.scripts[0].src,'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
 env.scripts[0].onload();
 const options=env.getOptions();
 assert.equal(options.theme,'auto');
 assert.ok(options.sitekey.startsWith('0x'));
 options.callback('QA-only-token');
 assert.equal(env.host.dataset.qaStatus,'verified');
 assert.equal(captcha.requiredToken(),undefined,'QA token must NOT enable backend authentication enforcement');
 captcha.reset();
 assert.equal(env.getResetCount(),1);
});
test('arbitrary query value does not activate QA mode',()=>{
 const env=setup('?turnstile_qa=0');
 createAuthCaptcha(env.host).activate();
 assert.equal(env.scripts.length,0);
});
