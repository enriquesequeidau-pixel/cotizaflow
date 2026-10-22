import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {encryptCloudBackup,decryptCloudBackup,isEncryptedBackup} from '../cloud-crypto.mjs';
globalThis.crypto=webcrypto;
globalThis.btoa=value=>Buffer.from(value,'binary').toString('base64');
globalThis.atob=value=>Buffer.from(value,'base64').toString('binary');
const uid='c1ad1a6d-926e-4f23-8b10-6247f630eaf1';
const pass='correct horse battery purple memories';
const data={settings:{business:'Negocio Secreto',phone:'987',email:'example@test.invalid',currency:'CLP',tax:19},clients:[],services:[],quotes:[]};
test('AES-GCM encrypts, authenticates, binds account and roundtrips',async()=>{
 const encrypted=await encryptCloudBackup(data,pass,uid);
 assert.ok(isEncryptedBackup(encrypted));
 assert.ok(!JSON.stringify(encrypted).includes('Negocio Secreto'));
 assert.deepEqual(await decryptCloudBackup(encrypted,pass,uid),data);
 await assert.rejects(decryptCloudBackup(encrypted,'invalid wrong password 321',uid));
 await assert.rejects(decryptCloudBackup(encrypted,pass,'f1ad1a6d-926e-4f23-8b10-6247f630eaf1'));
 const tampered=structuredClone(encrypted);
 tampered._cf_encrypted.ciphertext=tampered._cf_encrypted.ciphertext.replace(/^./,tampered._cf_encrypted.ciphertext[0]==='A'?'B':'A');
 await assert.rejects(decryptCloudBackup(tampered,pass,uid));
});
test('new encryption envelope fails existing plaintext validator closed',async()=>{
 const {validateBackup}=await import('../backup.mjs');
 const encrypted=await encryptCloudBackup(data,pass,uid);
 assert.throws(()=>validateBackup(encrypted));
 assert.deepEqual(validateBackup(data),data);
 assert.equal(encrypted.clients.length,0);
 assert.deepEqual(encrypted.settings,{});
});
test('reject weak keys and invalid account IDs',async()=>{
 await assert.rejects(encryptCloudBackup(data,'short',uid));
 await assert.rejects(encryptCloudBackup(data,pass,'not-an-owner'));
});
