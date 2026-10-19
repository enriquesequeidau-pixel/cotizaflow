# CotizaFlow — Entrega integral Mercado Pago Chile

**Estado real:** paquete de implementación y pruebas locales, **no producto publicado ni cobros habilitados**.

## Cambios
- `index.html`: interfaz Plan Pro, consulta de estado, suscripción (solo cuando el backend permite checkout), cancelación confirmada y reporte comercial CSV.
- `supabase/functions/cotizaflow-mp-checkout`: verificación de identidad, suscripción, pago aprobado, checkout con control de idempotencia y cancelación.
- `supabase/functions/cotizaflow-mp-webhook`: firma HMAC, consulta de estado verdadero con Mercado Pago y conciliación.
- `supabase/functions/cotizaflow-pro-report`: reporte server-side solo con Pro verificado, genera CSV de cotizaciones con protección contra fórmulas.
- `supabase/functions/common.ts`: integración común con Mercado Pago.

## Seguridad / condiciones de producción
1. El estado `authorized` no concede Pro por sí solo. Se requiere pago `approved` de $7.990 CLP y comprobación en Mercado Pago.
2. No se confía en los mensajes de retorno del checkout para habilitar plan.
3. El bloqueo de pagos en base de datos `public.cotizaflow_mp_catalog.checkout_enabled = false` permanece encendido. **No cambiar antes de pruebas reales de extremo a extremo y verificación de cancelación.**
4. Se revocó el permiso de ejecución de `cotizaflow_mp_pro()` para usuarios autenticados porque su lógica antigua podía aceptar una autorización sin pago. El nuevo reporte comprueba el cobro directamente.
5. Faltan pruebas integración con cuentas sandbox de Mercado Pago, renovación, cancelación, reintentos, fallos de red y revisión tributaria/legal, soporte, políticas de privacidad y recuperación de datos.
6. Para subir las funciones en Supabase, incluir `index.ts` + `common.ts` para cada función, exigir tokens firmados de usuarios en el propio handler; webhooks verifican HMAC. Usar exclusivamente `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` en Secret Manager. **Nunca en GitHub.**
7. `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` deben estar disponibles en el runtime Supabase, típicamente secretos reservados del proyecto.
8. La rama GitHub actual usa `index.html`, `app.mjs`, `cloud.mjs`. Solo después de desplegar correctamente las funciones se puede reemplazar `index.html`. Los beneficios Pro adicionales requieren cambios en `app.mjs` y otras rutas protegidas.
9. No reutilizar el plan ni webhook de PromoFlash.

## Verificación local
`node tests/smoke.mjs`

## Secuencia de puesta en marcha
- Desplegar las tres funciones con `index.ts` y `common.ts`.
- Verificar consultas sin sesión => 401, checkout deshabilitado => 503, evento con firma inválida => 401, reporte sin Pro => 403.
- Probar creación de suscripción con comprador de prueba en proveedor, webhook, pago aprobado, acceso CSV, cancelación e imposibilidad de reactivar tras cancelación.
- Solo tras comprobar lo anterior y términos/soporte, activar `checkout_enabled` mediante una migración específica.
- Reemplazar `index.html` en GitHub y verificar Actions + Pages.

Precio CLP 7990 mensual; México se conserva como mercado futuro y NO está habilitado para cobros MXN con cuenta chilena.
