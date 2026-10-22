/* CotizaFlow cloud backup encryption.
 * WebCrypto only; the separate backup passphrase never leaves the browser.
 * The empty settings/arrays preserve the existing RPC's structural checks while
 * intentionally making old clients reject encrypted backups instead of restoring
 * an empty data set.
 */
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const ITERATIONS=310000;
const BINDING='cotizaflow-cloud-backup-v1:';
const from64=value=>{
 if(typeof value!=='string'||!value||!/^[a-zA-Z0-9+/]+={0,2}$/.test(value)||value.length%4!==0)throw Error('Formato cifrado inválido.');
 try{return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}catch{throw Error('Formato cifrado inválido.');}
};
const to64=value=>{
 let output='';
 for(let i=0;i<value.length;i+=16384)output+=String.fromCharCode(...value.subarray(i,i+16384));
 return btoa(output);
};
const password=value=>{
 if(typeof value!=='string'||value.length<16||value.length>256)throw Error('La clave del respaldo debe tener entre 16 y 256 caracteres.');
 return value;
};
const owner=value=>{
 if(typeof value!=='string'||!/^[a-f0-9-]{36}$/i.test(value))throw Error('La sesión no tiene un identificador válido.');
 return value;
};
const derive=async(value,salt)=>{
 const material=await crypto.subtle.importKey('raw',enc.encode(password(value)),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
};
export const isEncryptedBackup=data=>Boolean(data&&typeof data==='object'&&!Array.isArray(data)&&Object.prototype.hasOwnProperty.call(data,'_cf_encrypted'));
export async function encryptCloudBackup(data,passphrase,userId){
 owner(userId);password(passphrase);
 if(!data||typeof data!=='object'||Array.isArray(data)||isEncryptedBackup(data))throw Error('El respaldo local no es válido.');
 const plaintext=enc.encode(JSON.stringify(data));
 if(plaintext.length>1300000)throw Error('El respaldo supera el tamaño máximo permitido para cifrado seguro.');
 const salt=crypto.getRandomValues(new Uint8Array(16));
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await derive(passphrase,salt);
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(BINDING+userId)},key,plaintext));
 // Shape required by the existing server-side validator. Old client validators
 // reject the empty settings object; they never overwrite local data with [].
 return {settings:{},clients:[],services:[],quotes:[],_cf_encrypted:{
  version:1,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:ITERATIONS,
  salt:to64(salt),iv:to64(iv),ciphertext:to64(ciphertext)
 }};
}
export async function decryptCloudBackup(data,passphrase,userId){
 owner(userId);password(passphrase);
 if(!isEncryptedBackup(data))throw Error('Este respaldo no está cifrado en el formato compatible.');
 const metadata=data._cf_encrypted;
 if(!metadata||typeof metadata!=='object'||Array.isArray(metadata)||
 metadata.version!==1||metadata.algorithm!=='AES-256-GCM'||metadata.kdf!=='PBKDF2-SHA256'||metadata.iterations!==ITERATIONS)throw Error('Formato cifrado no compatible.');
 const salt=from64(metadata.salt),iv=from64(metadata.iv),ciphertext=from64(metadata.ciphertext);
 if(salt.length!==16||iv.length!==12||ciphertext.length<17||ciphertext.length>1900000)throw Error('Tamaño del respaldo cifrado inválido.');
 try{
  const key=await derive(passphrase,salt);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:enc.encode(BINDING+userId)},key,ciphertext);
  return JSON.parse(dec.decode(plain));
 }catch{throw Error('No se pudo descifrar el respaldo. Revisa la clave de respaldo y la cuenta.');}
}
