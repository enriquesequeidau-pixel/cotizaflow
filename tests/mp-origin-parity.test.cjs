const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const code=fs.readFileSync('common.ts','utf8');
const FRONTEND='https://cotizaflow.sequeidaulabs.com';
test('production Mercado Pago source uses exact commercial origin already deployed at Supabase',()=>{
 const match=code.match(/export const ORIGIN=['"]([^'"]+)['"]/);
 assert.ok(match,'Explicit single CORS origin missing');
 assert.equal(match[1],FRONTEND,'Do not deploy edge functions with old Pages origin');
 assert.doesNotMatch(code,/enriquesequeidau-pixel\.github\.io/);
 assert.match(code,/'Access-Control-Allow-Origin':ORIGIN/);
 assert.match(code,/req\.headers\.get\('authorization'\)/);
});
test('checkout, Pro access and Pro report enforce same allowlisted origin',()=>{
 for(const path of ['api-contracts/billing-status.ts','api-contracts/pro-access.ts','api-contracts/pro-report.ts']){
  const source=fs.readFileSync(path,'utf8');
  assert.match(source,/import \{ORIGIN,headers,json/);
  assert.match(source,/req\.headers\.get\('origin'\)!==ORIGIN/);
  assert.doesNotMatch(source,/enriquesequeidau-pixel\.github\.io/);
 }
});
