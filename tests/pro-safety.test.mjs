import test from 'node:test';
import assert from 'node:assert/strict';
import {safeBrandColor,safeBrandLogo} from '../pro-safety.mjs';

test('generated document accepts only six-digit CSS hex colors',()=>{
  assert.equal(safeBrandColor('#123a52'),'#123a52');
  assert.equal(safeBrandColor('#AABBCC'),'#AABBCC');
  for(const value of [null,42,'red','black;}</style><script>alert(1)</script>','var(--x)','#123','\u0000#000000']){
    assert.equal(safeBrandColor(value),'#123a52');
  }
});

test('printable logos are restricted to bounded PNG/JPEG base64 data',()=>{
  assert.equal(safeBrandLogo('data:image/png;base64,AAAA'),'data:image/png;base64,AAAA');
  assert.equal(safeBrandLogo('data:image/jpeg;base64,AAAA=='),'data:image/jpeg;base64,AAAA==');
  for(const value of [
    null,42,'javascript:alert(1)','https://attacker.invalid/collect',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/png;base64,AAAA" onerror="alert(1)',
    'data:image/png;base64,'+'A'.repeat(161000)
  ])assert.equal(safeBrandLogo(value),'');
});
