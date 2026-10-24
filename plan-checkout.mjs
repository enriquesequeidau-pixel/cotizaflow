/* CotizaFlow — consulta de plan Mercado Pago Chile. Sin cobros hasta habilitación y validación en servidor. */
    const BASE = 'https://nrwbnjjaqilgreqhpcov.supabase.co';
    const PUBLIC_KEY = 'sb_publishable_7aOw4W695bp3CIMYTO9E6Q_5VChQ6so';
    const SESSION_KEY = 'cotizaflow-cloud-session-v1';
    const ENDPOINT = BASE + '/functions/v1/cotizaflow-mp-checkout';
    const css = document.createElement('style');
    css.textContent = `
      #cf-plan-open{position:fixed;bottom:16px;left:16px;z-index:1000;
        border:0;border-radius:28px;background:#123a52;color:white;padding:12px 16px;
        font:700 14px system-ui;box-shadow:0 5px 25px #1235;cursor:pointer}
      #cf-plan-dialog{border:0;border-radius:14px;padding:24px;max-width:min(92vw,460px);
        width:100%;color:#193a47;box-shadow:0 12px 55px #1238;font-family:system-ui}
      #cf-plan-dialog::backdrop{background:#0929369c}
      #cf-plan-dialog h2{margin:0 0 10px;font-size:22px}
      #cf-plan-dialog p{line-height:1.5;font-size:14px}
      #cf-plan-dialog button{padding:11px 16px;border:1px solid #a8b9bc;
        background:white;border-radius:9px;margin-right:7px;cursor:pointer}
      #cf-plan-dialog button.primary{background:#0b766a;color:white;border-color:#0b766a}
      #cf-plan-dialog button:disabled{opacity:.55;cursor:not-allowed}
      #cf-plan-state{min-height:24px;white-space:pre-wrap;font-size:14px}
      #cf-plan-dialog small{display:block;line-height:1.45;color:#536873;margin:12px 0}
    `;
    document.head.append(css);
    const openButton = document.createElement('button');
    openButton.id = 'cf-plan-open';
    openButton.type = 'button';
    openButton.textContent = '💳 Ver plan Pro';
    document.body.append(openButton);
    const dialog = document.createElement('dialog');
    dialog.id = 'cf-plan-dialog';
    dialog.innerHTML = `
      <h2>💳 CotizaFlow Pro</h2>
      <p><strong>$7.990 CLP/mes</strong> · Mercado Pago Chile</p>
      <p id="cf-plan-state" role="status" aria-live="polite"></p>
      <button type="button" id="cf-plan-refresh">Actualizar estado</button>
      <button type="button" class="primary" id="cf-plan-checkout" disabled>Continuar al pago</button>
      <button type="button" id="cf-plan-cancel" disabled>Cancelar suscripción</button>
      <button type="button" id="cf-plan-report" disabled>Descargar reporte Pro (CSV)</button>
      <button type="button" id="cf-plan-close">Cerrar</button>
      <small>Plan Pro: reporte comercial CSV protegido con verificación del cobro en el servidor. El editor, PDF y respaldo manual de la beta siguen disponibles. Los cobros continúan desactivados hasta pasar las pruebas de extremo a extremo.</small>
    `;
    document.body.append(dialog);
    const status = dialog.querySelector('#cf-plan-state');
    const subscribe = dialog.querySelector('#cf-plan-checkout');
    const cancel = dialog.querySelector('#cf-plan-cancel');
    const report = dialog.querySelector('#cf-plan-report');
    const setStatus = (message) => { status.textContent = message; };
    const readSession = () => {
      try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); }
      catch { return null; }
    };
    async function token() {
      // Centralizes refresh in cloud.mjs to avoid reusing rotating refresh tokens.
      if (!window.CotizaFlowSession?.token) {
        throw new Error('No fue posible cargar el respaldo en la nube. Recarga esta página.');
      }
      return window.CotizaFlowSession.token();
    }
    async function callBilling(action) {
      const access = await token();
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { apikey: PUBLIC_KEY, Authorization: 'Bearer ' + access, 'Content-Type': 'application/json' },
        body: JSON.stringify({action})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'No fue posible consultar la suscripción (' + response.status + ').');
      return payload;
    }
    async function refresh() {
      subscribe.disabled = true;
      cancel.disabled = true;
      report.disabled = true;
      setStatus('Consultando estado de la suscripción…');
      try {
        const result = await callBilling('status');
        const descriptions = {
          authorized: result.plan === 'pro' ? 'Pro activo: cuota aprobada y verificada en Mercado Pago.' : 'Suscripción autorizada. Aún no figura una cuota aprobada.',
          pending: 'Suscripción pendiente de completar o de pago aprobado.',
          creating: 'Preparando el enlace de pago.',
          cancelled: 'Suscripción cancelada.',
          paused: 'Suscripción pausada.',
          expired: 'Suscripción expirada.',
          inactive: 'Plan gratuito.'
        };
        setStatus(descriptions[result.status] || 'Estado: ' + String(result.status || 'gratuito') + '.');
        report.disabled = result.plan !== 'pro';
        cancel.disabled = !['authorized','pending','paused'].includes(result.status);
        if (result.checkout_enabled === true && ['inactive','cancelled','expired'].includes(result.status)) {
          subscribe.disabled = false;
        } else if (result.checkout_enabled !== true) {
          setStatus(status.textContent + '\nTodavía no es posible contratar Pro. Puedes seguir usando CotizaFlow gratis.');
        }
      } catch (error) {
        setStatus(error.message || 'No se pudo consultar el plan.');
      }
    }
    openButton.onclick = () => { dialog.showModal(); void refresh(); };
    dialog.querySelector('#cf-plan-refresh').onclick = () => { void refresh(); };
    dialog.querySelector('#cf-plan-close').onclick = () => dialog.close();
    cancel.onclick = async () => {
      if (cancel.disabled || !confirm('¿Confirmas que quieres CANCELAR tu suscripción de Mercado Pago? No se renovará.')) return;
      cancel.disabled = true;
      setStatus('Solicitando cancelación a Mercado Pago…');
      try { await callBilling('cancel'); setStatus('Mercado Pago confirmó la cancelación.'); await refresh(); }
      catch (error) { setStatus('No se pudo confirmar la cancelación: ' + error.message); await refresh(); }
    };
    report.onclick = async () => {
      if (report.disabled) return;
      report.disabled = true;
      setStatus('Preparando el reporte seguro…');
      try {
        const access = await token();
        const response = await fetch(BASE + '/functions/v1/cotizaflow-pro-report', {
          method: 'POST',
          headers: {apikey: PUBLIC_KEY, Authorization: 'Bearer ' + access, 'Content-Type': 'application/json'},
          body: '{}'
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || 'No se pudo generar el reporte.');
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'cotizaflow-reporte-pro.csv';
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        setStatus('Reporte generado. Revisa tus descargas.');
      } catch (error) { setStatus(error.message || 'No se pudo generar el reporte.'); }
      finally { report.disabled = false; }
    };
    subscribe.onclick = async () => {
      if (subscribe.disabled) return;
      if (!confirm('Mercado Pago te presentará una suscripción renovable de $7.990 CLP al mes. ¿Deseas continuar?')) return;
      subscribe.disabled = true;
      setStatus('Preparando Mercado Pago…');
      try {
        const result = await callBilling('checkout');
        const u = new URL(result.checkout_url);
        if (u.protocol !== 'https:' || !['mercadopago.cl','mercadopago.com'].some(host => u.hostname === host || u.hostname.endsWith('.' + host))) {
          throw new Error('Enlace de pago no permitido.');
        }
        location.assign(u.href);
      } catch (error) {
        setStatus(error.message || 'No se pudo crear el checkout.');
        await refresh();
      }
    };
