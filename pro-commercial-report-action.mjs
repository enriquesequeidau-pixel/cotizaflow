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

/** Compute a filtered report only after a current Pro entitlement check. */
export async function prepareProCommercialReport(options={}) {
  deps(options);
  if(await options.verifyPro()!==true)
    throw new Error('Acceso Pro no verificado.');
  const data=await options.readData();
  const report=buildCommercialReport(data,options.filters??{});
  // The plan can be cancelled while the local data is read/calculated.
  if(await options.verifyPro()!==true)
    throw new Error('Acceso Pro no verificado.');
  return report;
}

/** Rechecks Pro before converting private rows to CSV and downloading. */
export async function exportProCommercialReport(options={}) {
  deps(options);
  if(typeof options.downloadCsv!=='function')
    throw new TypeError('Integración de descarga CSV incompleta.');
  const report=await prepareProCommercialReport(options);
  // No async gap or private output before this final entitlement check.
  if(await options.verifyPro()!==true)
    throw new Error('Acceso Pro no verificado.');
  const csv=commercialReportCsv(report);
  await options.downloadCsv(csv,'cotizaflow-informe-comercial.csv');
  return Object.freeze({rows:report.rows.length,acceptanceRate:report.acceptanceRate});
}
