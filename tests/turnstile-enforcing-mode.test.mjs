import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise both security modes of the identical module without changing the
// production flag: disabled is production today; enabled is a rollout rehearsal.
const original=fs.readFileSync(new URL('../auth-captcha.mjs',import.meta.url),'utf8');

function harness(enabled,search=''){
  const source=original
    .replace('export const AUTH_CAPTCHA_ENABLED=false;', 'const AUTH_CAPTCHA_ENABLED='+String(enabled)+';')
    .replace('export const AUTH_CAPTCHA_SITEKEY=', 'const AUTH_CAPTCHA_SITEKEY=')
    .replace('export function createAuthCaptcha(', 'function createAuthCaptcha(');
  assert.notEqual(source,original,'feature flag source must be recognizable');
  assert.ok(!source.includes('export '),'module must be evaluable in security harness');
  const scripts=[], ui=[], resetCalls=[];
  let options;
  const host={
    hidden:true,dataset:{},textContent:'',
    prepend(x){ui.unshift(x)}, append(x){ui.push(x)},
    querySelector(selector){return ui.find(x=>x.marker===selector)||null}
  };
  const document={
    querySelector(){return host},
    createElement(tag){
      return {tag,marker:'',textContent:'',setAttribute(name,value){if(name==='data-turnstile-qa-status')this.marker='[data-turnstile-qa-status]'}};
    },
    head:{appendChild(x){scripts.push(x)}}
  };
  const window={turnstile:{
    render(target,o){assert.equal(target,host); options=o; return 42},
    reset(handle){resetCalls.push(handle)}
  }};
  const sandbox={document,window,location:{search},URLSearchParams};
  vm.runInNewContext(source+'\nthis.moduleExports={createAuthCaptcha,AUTH_CAPTCHA_ENABLED};',sandbox,{timeout:1500});
  return { ...sandbox.moduleExports,host,scripts,ui,resetCalls,getOptions:()=>options};
}

test('production disabled mode does not add a widget or require an auth token',()=>{
  const h=harness(false),c=h.createAuthCaptcha(h.host);
  c.activate();assert.equal(h.scripts.length,0);
  assert.equal(c.requiredToken(),undefined);
  assert.equal(h.host.hidden,true);
});

test('future enforcing mode is fail closed, resets spent tokens and prevents double activation',()=>{
  const h=harness(true),c=h.createAuthCaptcha(h.host);
  assert.throws(()=>c.requiredToken(),/Completa la verificación/);
  c.activate();c.activate();
  assert.equal(h.scripts.length,1);
  assert.equal(h.host.hidden,false);
  assert.match(h.scripts[0].src,/^https:\/\/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  h.scripts[0].onload();
  assert.equal(h.getOptions().sitekey,'0x4AAAAAAFgm_-8sMbLzw3nP');
  assert.throws(()=>c.requiredToken(),/Completa la verificación/);
  h.getOptions().callback('synthetic-turnstile-token-1');
  assert.equal(c.requiredToken(),'synthetic-turnstile-token-1');
  h.getOptions()['expired-callback']();
  assert.throws(()=>c.requiredToken(),/Completa la verificación/);
  h.getOptions().callback('synthetic-turnstile-token-2');
  assert.equal(c.requiredToken(),'synthetic-turnstile-token-2');
  h.getOptions()['error-callback']();
  assert.throws(()=>c.requiredToken(),/Completa la verificación/);
  h.getOptions().callback('synthetic-turnstile-token-3');
  c.reset();
  assert.deepEqual(h.resetCalls,[42]);
  assert.throws(()=>c.requiredToken(),/Completa la verificación/);
});

test('script failure does not allow login and supports retry on next activation',()=>{
  const h=harness(true),c=h.createAuthCaptcha(h.host);
  c.activate();assert.equal(h.scripts.length,1);
  h.scripts[0].onerror();
  assert.match(h.host.textContent,/No se pudo cargar/);
  assert.throws(()=>c.requiredToken(),/Completa la verificación/);
  c.activate();assert.equal(h.scripts.length,2);
});

test('opt-in visual preview never sends the preview token to Supabase Auth',()=>{
  const h=harness(false,'?turnstile_qa=1'),c=h.createAuthCaptcha(h.host);
  c.activate();assert.equal(h.scripts.length,1);
  h.scripts[0].onload();
  h.getOptions().callback('preview-only-token');
  assert.equal(c.requiredToken(),undefined);
  assert.equal(h.host.dataset.qaStatus,'verified');
  c.reset();assert.equal(c.requiredToken(),undefined);
});

test('signup, login and recovery have CAPTCHA token and reset handling before rollout',()=>{
  const variants=[
    {file:'cuenta.js',token:'captcha.requiredToken()',reset:'captcha.reset()'},
    {file:'cloud.mjs',token:'captcha.requiredToken()',reset:'captcha.reset()'},
    {file:'premium.mjs',token:'authCaptcha.requiredToken()',reset:'authCaptcha.reset()'},
  ].filter(v=>fs.existsSync(v.file));
  assert.equal(variants.length,1,'expected exactly one app-specific auth module');
  const v=variants[0],source=fs.readFileSync(v.file,'utf8');
  const occurrences=source.split(v.token).length-1;
  assert.ok(occurrences>=3,v.file+' requires Turnstile for signup, login and recovery');
  assert.ok(source.includes(v.reset),v.file+' clears used tokens');
  if(v.file==='cloud.mjs'){
    assert.ok(source.includes('gotrue_meta_security'),'raw GoTrue API must pass captcha_token');
  }else{
    assert.ok(source.includes('captchaToken'),'Supabase SDK must pass captchaToken');
  }
});
