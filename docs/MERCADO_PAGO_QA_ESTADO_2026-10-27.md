# CotizaFlow — estado verificado de Mercado Pago (27 octubre 2026)

> Registro de auditoría READ-ONLY en Supabase y revisión del código actualmente
> desplegado. No representa un QA de pago exitoso, ni autorización para vender.

## Servicio

- Supabase proyecto `nrwbnjjaqilgreqhpcov` (CotizaFlow, región sa-east-1), estado ACTIVE_HEALTHY.
- Edge functions activas: `cotizaflow-mp-checkout` v19, `cotizaflow-mp-webhook` v17,
  `cotizaflow-pro-access` v15, `cotizaflow-mp-diagnostic` v15, `cotizaflow-sandbox-setup` v12.
- Catálogo `public.cotizaflow_mp_catalog`: CL, CLP 7.990 mensual, `checkout_enabled=false`; 
  MX, MXN 149 mensual, `checkout_enabled=false`. Ambos tienen `plan_id=null`.
- Tabla de suscripciones Mercado Pago: **cero registros** al verificar. No hay
  evidencia de suscripciones de prueba pagadas en esta tabla.
- `cotizaflow-mp-diagnostic` está desactivado explícitamente (`HTTP 410`),
  sin filtración pública de secretos o diagnósticos privados.

## Comprobado por lectura de código (NO equivale a QA E2E)

1. Checkout: usuario con JWT validado mediante `auth.getUser(token)`, correo confirmado,
   CORS por origen, presupuesto de rate limit, cuota por cuenta, `/preapproval`
   con `status: pending`, idempotencia y validación de HTTPS dominio Mercado Pago.
2. Sandbox: solo usuarios con `app_metadata.cotizaflow_sandbox === true`, email
   de test `@testuser.com`, comprador ficticio identificado en app_metadata;
   vendedor y comprador separados, ambos verificados como usuarios test Chile
   (`test_user`, MLC/CL) consultando la API proveedor. Un cliente no activa este
   modo alterando JSON de la solicitud.
3. Otorgamiento Pro: consulta `/preapproval/{id}`, valida usuario, correo,
   contrato CLP 7.990 mensual, busca `authorized_payments` aprobados y confirma
   `/v1/payments/{id}` antes de devolver `plan: pro`.
4. Webhook: comprueba firma HMAC `x-signature`, request ID, ventana temporal,
   correlación de evento, consulta estado de Mercado Pago y rehúsa activar Pro
   directamente desde el cuerpo del webhook sin conciliar en proveedor.
5. Cancelación: emite `PUT /preapproval/{id}` con estado canceled, exige confirmación
   proveedor y actualiza el registro a cancelled. **No se ha ejecutado E2E.**

## No afirmaciones

- No se ha demostrado que Mercado Pago acepte la creación de una suscripción
  bajo **vendedor/cliente de prueba chilenos** con la configuración actual.
- No se ha observado una transacción de prueba aprobada, su webhook, acceso Pro,
  reverso, cancelación o expiración; por tanto **NO marcar pagos 100% QA**.
- El checkout Live sigue apagado. **No activar** `checkout_enabled` sin E2E
  exitoso, autorización comercial y pruebas de integridad/seguridad.
- No se han leído ni deben volcarse claves MP_ACCESS_TOKEN, claves service_role,
  firmas ni datos privados de usuarios a repositorios o chats.

## Siguiente ruta de menor esfuerzo

1. Reutilizar `cotizaflow-sandbox-setup` para comprobar si existen vendedor y
   comprador ficticios compatibles, **sin crear nuevos usuarios ni hacer cobros**.
   Identificar por qué todavía no hay test E2E (credenciales de vendedor y/o
   habilitación app_metadata del usuario ficticio).
2. Crear solo las cuentas de prueba que falten, por canales oficiales de
   Mercado Pago, sin usar tarjetas reales. Mantener separado el email y
   credenciales sandbox de cuentas de clientes.
3. Ejecutar E2E una sola vez con evidencia permanente:
   checkout, pago ficticio aprobado, webhook firmado, validación de Pro,
   cancelación y estado posterior. Detenerse ante rechazo de proveedor,
   no reiterar intentos ni agotar presupuesto.
4. Preparar legal, backup, rollback, monitoreo. Activación Live solo con
   aprobación explícita del titular.

## Relación con la matriz 80/80

La matriz histórica de controles de seguridad NO autoriza cambiar
`cotizaflow_mp_catalog.checkout_enabled` a true, ni acredita un pago aprobado.
Usar este documento como punto de partida al retomar Mercado Pago, y no
repetir auditorías de código ya registradas sin cambios materiales.
