# CotizaFlow — prueba de Mercado Pago, 19 de octubre de 2026

## Alcance
Solo cuentas ficticias de Chile y tarjetas de prueba. Ningún cargo real, ninguna
activación del catálogo público y ningún cambio a PromoFlash.

## Estado comprobado
- Repositorio: enriquesequeidau-pixel/cotizaflow. Base: f131866fcbd861d5989ba8e8f1009a77d8f0cc99.
- Supabase: nrwbnjjaqilgreqhpcov.
- Diagnóstico desplegado v4: seller_account=test, seller_country=CL,
  sandbox_seller_verified=true, checkout_enabled=false.
- La familia APP_USR no distingue por sí sola producción de pruebas. La cuenta
  vendedora fue verificada mediante /users/me y su etiqueta test_user.
- La base de datos tenía cero suscripciones antes de este trabajo.
- Mercado Pago Developers devolvió 403 Forbidden en el navegador.
- POST /users/test, solicitado al proveedor desde el servidor con el vendedor
  ficticio verificado, devolvió 403: "authorization: the caller.id must be a productive user".
  La cuenta principal debe crear el comprador ficticio. No se creó una cuenta ni
  un cargo; no se sustituyó este paso por una identidad inventada.
- El endpoint temporal de preparación fue cerrado y devuelve HTTP 410.

## Correcciones
- Diagnóstico sin claves ni datos personales; consulta el interruptor real en la
  base de datos en lugar de afirmar siempre que el cobro está deshabilitado.
- Checkout de prueba reservado a app_metadata administrada por servidor; verifica
  vendedor y comprador test_user, Chile, identidades distintas y correo ficticio.
  No permite que user_metadata o el cuerpo de la solicitud habiliten pruebas.
- Los checkout nuevos y reutilizados validan HTTPS y dominio permitido.
- Las acciones Pro revalidan el pago en servidor; se elimina la autorización en
  caché de tres minutos y se oculta el contenido si falla la verificación.
- Fuente real de las funciones desplegadas preservada en billing/.

## Pruebas y límites
`node --test tests/billing*.test.mjs`: 14/14 aprobadas inicialmente.
Son pruebas de contrato con Mercado Pago y Supabase simulados en memoria. Ejecutan
el código de las funciones, pero NO acreditan una transacción en el sandbox externo.
Cubren pago pendiente, aprobado, reembolsado, cancelación, reintentos, firma falsa,
webhooks duplicados, sesión inválida, origen ajeno y errores de verificación.

## Próxima operación exacta
1. En la cuenta principal de Mercado Pago Developers, crear o seleccionar un
   comprador ficticio de Chile, diferente del vendedor ya verificado.
2. Provisionar solo esa identidad en Supabase Auth, con app_metadata administrada:
   cotizaflow_sandbox=true y mp_test_buyer_id igual al ID del comprador verificado.
   No usar user_metadata ni enviar claves por chat.
3. Con su sesión, ejecutar cotizaflow-mp-checkout con action=checkout sin activar
   cotizaflow_mp_catalog.checkout_enabled. Completar el checkout con tarjeta oficial
   de prueba; verificar el pago recurrente aprobado y Pro mediante pro-access.
4. Ejecutar action=cancel y verificar estado cancelado en proveedor y base de datos,
   plan gratuito y bloqueo de acciones Pro. Registrar IDs ficticios y evidencia.
5. No activar ventas hasta completar la verificación externa. No equiparar una
   firma webhook generada por una prueba local con entrega real del proveedor.

## Fuentes oficiales consultadas
- https://www.mercadopago.cl/developers/es/reference/test_user/_users_test/post
- https://www.mercadopago.cl/developers/es/docs/your-integrations/test/cards
- https://developers.mercadolibre.cl/es_cl/servicios-consulta-usuarios
- https://supabase.com/docs/guides/functions/secrets
