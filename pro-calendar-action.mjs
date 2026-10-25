/*
 * CotizaFlow Pro v2 — local ICS export adapter.
 * Never call the exporter without a fresh server-side Pro verification.
 * No email, cloud write, or background reminder is performed.
 */
import {buildFollowupCalendar} from './followup-calendar.mjs';

const NAMESPACE_KEY='cotizaflow-pro-calendar-namespace-v2';
const STORED_NAMESPACE=/^cal_[0-9a-f]{32}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Stable per-browser opaque calendar namespace; never use email or auth token as UID. */
export function localCalendarNamespace(storage, randomUUID) {
  if(!storage || typeof storage.getItem!=='function' || typeof storage.setItem!=='function' ||
    typeof randomUUID!=='function') throw new TypeError('Almacenamiento seguro no disponible.');
  const saved=storage.getItem(NAMESPACE_KEY);
  if(STORED_NAMESPACE.test(saved??'')) return saved;
  const fresh=randomUUID();
  if(typeof fresh!=='string' || !UUID.test(fresh)) throw new Error('Identificador seguro no disponible.');
  const namespace='cal_'+fresh.replace(/-/g,'').toLowerCase();
  storage.setItem(NAMESPACE_KEY,namespace);
  return namespace;
}

/** Verifies Pro before reading private data, creating identifiers or downloading. */
export async function exportProFollowups({verifyPro,readData,namespace,downloadIcs,
  generatedAt=new Date()}={}) {
  if([verifyPro,readData,namespace,downloadIcs].some(fn=>typeof fn!=='function')) {
    throw new TypeError('Integración de calendario incompleta.');
  }
  if(await verifyPro()!==true) throw new Error('Acceso Pro no verificado.');
  const data=await readData();
  const ics=buildFollowupCalendar(data,{namespace:namespace(),generatedAt});
  await downloadIcs(ics,'cotizaflow-seguimientos.ics');
  return ics;
}
