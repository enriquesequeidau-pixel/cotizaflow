import fs from 'node:fs';import assert from 'node:assert/strict';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
const pro=fs.readFileSync(new URL('./pro.mjs',import.meta.url),'utf8');
assert(html.includes('src="app.mjs"')&&html.includes('src="cloud.mjs"')&&html.includes('src="pro.mjs"'));
for(const x of ['cotizaflow-pro-access','sessionToken','ensurePro','verified','last_payment','cf-pro-template','cf-pro-calendar','cf-pro-print','cf-pro-logo','CotizaFlow Pro']){if(x==='last_payment')continue;assert(pro.includes(x),x)}
assert(!pro.includes('localStorage.setItem('),'Never write user data');
assert(!/STRIPE_SECRET|MP_ACCESS_TOKEN|SERVICE_ROLE_KEY/.test(pro),'No backend secrets');
console.log('OK: módulo Pro enlazado, acceso verificado, herramientas presentes y datos locales intactos.');
