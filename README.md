# CotizaFlow Pro v5 — Entrega incremental no destructiva

## Incluye
- `index.html` actualizado: conserva la interfaz existente, añade `pro.mjs`.
- `pro.mjs`: estudio Pro independiente con estado verificado desde función Supabase `cotizaflow-pro-access`.
- Panel: totales cotizados y aceptados (no equivale a ventas cobradas), tasa de aceptación, seguimientos pendientes y vencidos.
- Exportación ICS de seguimiento, plantilla CSV reutilizable, propuesta personalizada imprimible con logo y color.
- Módulo no modifica el formato `cotizaflow-v1`, ni `app.mjs`, `cloud.mjs`, `backup.mjs`, ni los datos del usuario.

## Seguridad
- Cliente siempre solicita verificación en servidor de sesión y pago aprobado. Nunca guarda una variable de Pro en `localStorage`.
- Las funciones de valor adicional actuales se ejecutan en el navegador tras la verificación. No son contenido confidencial ni deben considerarse una barrera antifraude robusta; los beneficios que exijan cumplimiento comercial real deben validarse en servidor.
- No se altera `public.cotizaflow_mp_catalog.checkout_enabled=false`.
- Sin facturación activa ni promesas de sincronización automática. El módulo indica la limitación de respaldo manual.

## Cómo publicar
Subir a la raíz de `enriquesequeidau-pixel/cotizaflow` **dos archivos** `index.html` y `pro.mjs` simultáneamente. No subir carpetas ni sobrescribir módulos antiguos. Después verificar GitHub Actions, GitHub Pages y la interfaz gratuita.

## Bloqueos para lanzar ventas
El backend de checkout/webhook todavía requiere despliegue de las versiones verificadas, pruebas de pagos aprobados y cancelaciones con Mercado Pago, y el proveedor debe estar habilitado en `cotizaflow_mp_catalog`; de momento NO activar. También faltan sincronización automática, persistencia de la personalización Pro y legal/soporte. No confundir esta entrega Pro UI con SaaS comercial final.
