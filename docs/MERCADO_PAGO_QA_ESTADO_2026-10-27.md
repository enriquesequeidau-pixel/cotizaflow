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
- `cotizaflow-sandbox-setup` v12 también responde **HTTP 410** con
  `sandbox_setup_closed`: no permite generar usuarios sandbox; indica que
  se requiere una cuenta desarrolladora matriz de Mercado Pago.

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

## Publicación del frontend y contrato con Mercado Pago (verificación 27-oct)

**Hallazgo reproducido en Render preview** `cotizaflow-comercial-preview`
(`srv-dbbtvp7avr4c73dkalr0`): los recursos
`/plan-checkout.mjs`, `/billing-return.mjs` y
`/auth-captcha.mjs` devolvían **HTTP 404**; el módulo `/pro.mjs`
sí estaba disponible. `index.html` importa `plan-checkout.mjs`,
`cloud.mjs` y `pro.mjs`, que a su vez importan otros módulos.
Por tanto, el **preview** no tiene un bundle completo para la
prueba de Checkout/Pro/Auth. El dominio comercial
`cotizaflow.sequeidaulabs.com` sí sirvió los dos módulos de
`plan-checkout.mjs` y `billing-return.mjs` consultados. **No
confundir** falla del preview con el estado del sitio comercial.

Se actualizó `render.yaml` con el grafo completo de dependencias
estáticas públicas, `brand-symbol.svg` y cabeceras CSP que admiten
Cloudflare Turnstile sin abrir scripts inline. La prueba
`tests/render-preview-dependency-parity.test.mjs` recorre
imports de `index.html`, `cloud.mjs`, `pro.mjs` y
`plan-checkout.mjs`, detectando archivos omitidos o filtraciones
accidentales. También se añadió al CI de publicación.

**Importante**: actualizar `render.yaml` en GitHub NO cambia por sí
solo el Build Command del servicio Render existente.
Su Build Command se debe actualizar específicamente en el servicio
`srv-dbbtvp7avr4c73dkalr0` antes de desplegar el preview.
No crear servicio nuevo ni mover DNS sin pruebas HTTP y visuales.

Referencia oficial MP Chile:
- Suscripciones sin plan son admitidas en `POST /preapproval`:
  https://www.mercadopago.cl/developers/es/reference/online-payments/subscriptions/create-preapproval/post
- La fuente para conciliar facturas y pagos es
  `/authorized_payments/search` y `/v1/payments/{id}`:
  https://www.mercadopago.cl/developers/es/reference/online-payments/subscriptions/overview
- La cancelación se solicita mediante `PUT /preapproval/{id}`
  con `status: canceled`:
  https://www.mercadopago.cl/developers/es/docs/subscriptions/subscription-management

La falta de un `plan_id` **no es por sí sola un defecto**:
el diseño actual usa suscripción sin plan asociado. No inventar
un identificador de plan para obligar al backend a cobrar.
La verificación completa del vendedor y comprador ficticios todavía
está pendiente; las fuentes oficiales no son prueba E2E.

## Fuente de verdad: origen CORS comercial

La revisión de los archivos realmente desplegados en Supabase
(`cotizaflow-mp-checkout` v19, `cotizaflow-mp-webhook` v17,
`cotizaflow-pro-access` v15) encontró `ORIGIN` configurado como
`https://cotizaflow.sequeidaulabs.com`. Sin embargo, el archivo
`common.ts` del repositorio todavía indicaba
`https://enriquesequeidau-pixel.github.io`. Un despliegue futuro
hecho desde esa fuente desactualizada habría denegado el origen
comercial por CORS. Se corrigió el repositorio para coincidir
con el valor **ya desplegado**, sin cambiar ni reiniciar las funciones.
La prueba `tests/mp-origin-parity.test.cjs` y el release-smoke de
GitHub vigilan esa configuración.

El código compartido desplegado era funcionalmente equivalente al
archivo del repo después de reemplazar el hostname (salvo un salto de
línea final en una de las tres copias). No reutilizar la URL antigua.
Esta corrección no es evidencia de checkout con Mercado Pago.

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

1. **Bloqueo externo confirmado:** `cotizaflow-sandbox-setup` está cerrado
   (`HTTP 410`) por requerir una cuenta desarrolladora matriz de Mercado Pago.
   Validar desde esa cuenta la existencia de vendedor y comprador ficticios
   chilenos; no reactivar el endpoint público ni crear cuentas duplicadas.
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
