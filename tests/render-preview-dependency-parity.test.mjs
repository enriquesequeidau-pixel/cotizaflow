import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {extname} from 'node:path';

const html=readFileSync('index.html','utf8');
const yaml=readFileSync('render.yaml','utf8');
const build=yaml.match(/^\s*buildCommand:\s*(.+)$/m)?.[1];
assert.ok(build,'Render blueprint must define a static build command');
const match=build.match(/\bcp\s+(.+?)\s+dist\/\s*$/);
assert.ok(match,'Render build must copy an explicit allowlist to dist/');
const allowlist=new Set(match[1].trim().split(/\s+/));

// Follow ALL local ES module imports transitively rather than keeping a hand-
// maintained list: prevents checkout, captcha and Pro imports silently going 404.
function localModules(filename,visited=new Set()){
 if(visited.has(filename))return visited;
 assert.ok(allowlist.has(filename),'Module omitted from Render static build: '+filename);
 assert.ok(existsSync(filename),'Missing repository module: '+filename);
 visited.add(filename);
 if(extname(filename)!=='.mjs')return visited;
 const source=readFileSync(filename,'utf8');
 for(const [,path] of source.matchAll(/\bfrom\s*['"]\.\/([^'"]+\.mjs)['"]/g)){
   localModules(path,visited);
 }
 for(const [,path] of source.matchAll(/\bimport\(\s*['"]\.\/([^'"]+\.mjs)['"]\s*\)/g)){
   localModules(path,visited);
 }
 return visited;
}

test('all loaded CSS/icons and public app module dependency graph exist in Render static allowlist',()=>{
 const refs=[
  ...html.matchAll(/<script\b[^>]*\bsrc=['"]([^'"]+)['"]/g),
  ...html.matchAll(/<link\b[^>]*\bhref=['"]([^'"]+)['"]/g)
 ].map(m=>m[1].split('?')[0]).filter(s=>!/^https?:|^data:/.test(s));
 assert.ok(refs.includes('plan-checkout.mjs'),'Visible plan CTA must load');
 assert.ok(refs.includes('cloud.mjs'),'Cloud session must load');
 assert.ok(refs.includes('pro.mjs'),'Server-verified Pro UI must load');
 for(const f of refs)localModules(f);
 const dependencies=localModules('plan-checkout.mjs');
 assert.ok(dependencies.has('billing-return.mjs'));
 assert.ok(localModules('cloud.mjs').has('auth-captcha.mjs'));
 assert.ok(localModules('cloud.mjs').has('cloud-crypto.mjs'));
 assert.ok(localModules('pro.mjs').has('commercial-report.mjs'));
 for(const filename of ['privacidad.html','terminos.html'])assert.ok(allowlist.has(filename));
 for(const candidate of allowlist)assert.ok(existsSync(candidate),'Missing file: '+candidate);
});

test('no secrets shipped and Turnstile CSP cannot block secure registration',()=>{
 for(const name of allowlist)assert.doesNotMatch(name,/^\.|(service|secret)[_-]?role|\.env|api-contracts|private|\.sql/i);
 assert.match(yaml,/script-src 'self' https:\/\/challenges\.cloudflare\.com/);
 assert.match(yaml,/frame-src https:\/\/challenges\.cloudflare\.com/);
 assert.match(yaml,/connect-src 'self' https:\/\/nrwbnjjaqilgreqhpcov\.supabase\.co https:\/\/challenges\.cloudflare\.com/);
 assert.doesNotMatch(yaml,/script-src[^;]*unsafe-inline/);
 assert.match(readFileSync('plan-checkout.mjs','utf8'),/checkout_enabled === true/);
});
