import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

test('Render preview ships all required modules with a static allowlist', () => {
  const yaml=readFileSync('render.yaml','utf8');
  assert.match(yaml,/autoDeployTrigger:\s*off/);
  const command=yaml.match(/^\s*buildCommand:\s*(.+)$/m)?.[1];
  assert.ok(command,'missing Render build command');
  assert.match(command,/^mkdir -p dist && cp [\w.\s-]+ dist\/$/);
  const files=command.split(' && cp ')[1].replace(/ dist\/$/,'').trim().split(/\s+/);
  assert.equal(new Set(files).size,files.length,'duplicate publication files');
  const expected=['index.html','app.mjs','pro.mjs','cloud.mjs','plan-checkout.mjs','billing-return.mjs','auth-captcha.mjs','cloud-crypto.mjs','pro-safety.mjs','pro-calendar-action.mjs','followup-calendar.mjs','pro-duplicate-action.mjs','quote-duplicate.mjs','pro-commercial-report-action.mjs','commercial-report.mjs'];
  for(const file of expected){
    assert.ok(files.includes(file),'missing from build: '+file);
    assert.ok(existsSync(file),'missing from repository: '+file);
  }
  for(const file of files) assert.ok(existsSync(file),'unresolvable publication file: '+file);
  assert.ok(!files.some(file=>/^(?:\.env|private|commerce)|secret|service.role/i.test(file)),'private assets must not be published');
});

test('Preview configuration does not enable payments',()=>{
  const yaml=readFileSync('render.yaml','utf8');
  assert.doesNotMatch(yaml,/checkout_enabled:\s*true|PAYMENTS_ENABLED:\s*true|autoDeployTrigger:\s*on/);
});
