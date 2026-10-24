// CotizaFlow — voluntary checkout return UI, NEVER a payment entitlement.
// Only the authenticated server response can grant access to Pro.
export const MP_RETURN_KEY = 'cotizaflow_mp_checkout_started_at';

export function rememberCheckoutRedirect(store, now = Date.now()) {
  try {
    if (!Number.isFinite(now)) return false;
    store?.setItem(MP_RETURN_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}

export function consumeCheckoutRedirect(store, now = Date.now()) {
  try {
    const started = store?.getItem(MP_RETURN_KEY);
    if (started !== null && started !== undefined) store?.removeItem(MP_RETURN_KEY);
    if (!/^[0-9]{13}$/.test(String(started ?? ''))) return false;
    const timestamp = Number(started);
    // Allow a minor local clock adjustment; expire stale abandoned checkouts.
    return Number.isFinite(now) && timestamp <= now + 300000 && now - timestamp <= 86400000;
  } catch {
    return false;
  }
}

export function subscriptionReturnMessage(status) {
  // A URL, an authorized preapproval, or a pending checkout cannot activate Pro.
  if (status?.plan === 'pro' && status?.payment_verified === true) {
    return '¡Pago confirmado! Tu plan Pro ya está activo.';
  }
  if (status?.status === 'cancelled' || status?.status === 'expired') {
    return 'La suscripción no está activa. Puedes continuar usando el plan gratuito.';
  }
  if (status?.status === 'paused') {
    return 'Tu suscripción está pausada. Aún no podemos habilitar Pro.';
  }
  return 'Volviste de Mercado Pago. Todavía no se confirma un pago aprobado. Puedes actualizar el estado más tarde sin repetir el cobro.';
}
