/*
 * CotizaFlow Pro v2 — browser-only report preparation and CSV download.
 * The caller is responsible for a fresh server-side entitlement verification.
 * Never exports personal client data after plan cancellation or stale reads.
 * Quotes and customer records remain unchanged in local storage.
 */
import {buildCommercialReport,commercialReportCsv} from './commercial-report.mjs';

function deps(options) {
  if(!options||typeof options.verifyPro!=='function'||
    typeof options.readData!=='function') {
    throw new TypeError('Integración de informe comercial incompleta.');
  }
}

// Optional in adapters, but supplied by the actual Pro UI. This is only a
// session-continuity check; it never grants entitlement (verifyPro does that).
function accountAt(options) {
  if(typeof options.accountIdentity!=='function') return null;
  const account=options.accountIdentity();
  if(typeof account!=='string'||!account.trim())
    throw new Error('La cuenta cambió durante la operación Pro.');
  return account;
}

/** Compute a filtered report only after a current Pro entitlement check. */
export async function prepareProCommercialReport(options={}) {
  deps(options);
  if(await options.verifyPro()!==true)
    throw new Error('Acceso Pro no verificado.');
  const account=accountAt(options);
  const data=await options.readData();
  const report=buildCommercialReport(data,options.filters??{});
  // The plan can be cancelled while the local data is read/calculated.
  if(await options.verifyPro()!==true)
    throw new Error('Acceso Pro no verificado.');
  if(account!==accountAt(options))
    throw new Error('La cuenta cambió durante la operación Pro.');
  return report;
}

/** Rechecks Pro before converting private rows to CSV and downloading. */
export async function exportProCommercialReport(options={}) {
  deps(options);
  if(typeof options.downloadCsv!=='function')
    throw new TypeError('Integración de descarga CSV incompleta.');
  const account=accountAt(options);
  const report=await prepareProCommercialReport(options);
  // No async gap or private output before this final entitlement check.
  if(await options.verifyPro()!==true)
    throw new Error('Acceso Pro no verificado.');
  if(account!==accountAt(options))
    throw new Error('La cuenta cambió durante la operación Pro.');
  const csv=commercialReportCsv(report);
  await options.downloadCsv(csv,'cotizaflow-informe-comercial.csv');
  return Object.freeze({rows:report.rows.length,acceptanceRate:report.acceptanceRate});
}
