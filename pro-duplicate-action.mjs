/*
 * CotizaFlow Pro v2 — verified UI-to-local-storage duplication.
 * Free editor, PDF, import/export and manual encrypted cloud backup unchanged.
 * Does not perform cloud writes, payments or network requests.
 * Not a cross-tab transaction: detect changed snapshots and fail closed.
 */
import {validateBackup} from './backup.mjs';
import {duplicateQuote} from './quote-duplicate.mjs';

const KEY='cotizaflow-v1';
const MAX_BYTES=2_000_000;
const ID=/^[A-Za-z0-9_-]{1,100}$/;

export async function duplicateProQuote({verifyPro,storage,sourceId,
  date,idFactory=()=>crypto.randomUUID(),locks=globalThis.navigator?.locks}={}){
  if(typeof verifyPro!=='function'||!storage||
      typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||
      typeof sourceId!=='string'||!ID.test(sourceId)||
      typeof idFactory!=='function')
    throw new TypeError('Integración de duplicación Pro incompleta.');
  // Serialize Pro duplication across same-origin tabs when Web Locks is available.
  // Other Free-editor writes do not participate: retain the snapshot check below.
  const operation=async()=>{
  // Never read local customer data before checking server-side entitlement.
  if(await verifyPro()!==true)throw new Error('Acceso Pro no verificado.');
  const previous=storage.getItem(KEY);
  if(typeof previous!=='string'||!previous||previous.length>MAX_BYTES)
    throw new Error('No hay datos locales válidos para duplicar.');
  let data;
  try{data=validateBackup(JSON.parse(previous));}
  catch{throw new Error('Los datos locales están dañados. Exporta un respaldo antes de continuar.');}
  const copy=duplicateQuote(data,sourceId,{date,idFactory});
  // Full validation before writing. The source remains untouched.
  const serialized=JSON.stringify(validateBackup({
    ...data,quotes:[copy,...data.quotes]
  }));
  if(serialized.length>MAX_BYTES)
    throw new Error('El almacenamiento local supera el límite seguro.');
  // Entitlement may have been cancelled while the quote was being prepared.
  if(await verifyPro()!==true)throw new Error('Acceso Pro no verificado.');
  if(storage.getItem(KEY)!==previous)
    throw new Error('Los datos cambiaron en otra pestaña. Recarga antes de duplicar.');
  storage.setItem(KEY,serialized);
  if(storage.getItem(KEY)!==serialized)
    throw new Error('No se pudo confirmar el guardado local.');
  return Object.freeze({id:copy.id,number:copy.number,status:'borrador'});
  };
  if(locks && typeof locks.request==='function')
    return locks.request('cotizaflow-v1-pro-duplicate',{mode:'exclusive'},operation);
  // Older/non-secure browsers keep the existing optimistic snapshot guard.
  return operation();
}
