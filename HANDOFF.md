# CotizaFlow — estado de continuación v1.2

Fecha: 2026-10-19 UTC / 2026-10-18 Chile.
Fuente canónica utilizada: cotizaflow-v1.1-playwright.zip adjunto en esta conversación.
No se recuperaron ni integraron cotizaflow-autopilot-continuacion.zip ni PILOTO_AUTOMATICO_REPORT.md de otra conversación. Evitar asumir que esta revisión contiene ese trabajo.

## Estado por fase
- A/B — Diseño previo conservado. No se repitió investigación ni cambió el producto.
- C — REALIZADO Y VERIFICADO: 16/16 pruebas unitarias; sintaxis de cuatro módulos JS y del script E2E. Fuente y evidencia incluidas.
- C — IMPLEMENTADO, VERIFICACIÓN UI PENDIENTE: errores de almacenamiento, recuperación, mejoras CSS, etiquetas accesibles, conservación de moneda en UI, filtros combinados y fechas locales.
- C — BLOQUEADO: E2E visual móvil/escritorio. SITES_MANAGED_LINUX_CONTAINER=1 y sin control-browser disponible; no se inició servidor ni se intentó eludir restricciones. Conector GitHub: listado y búsqueda sin repositorios; consulta al nombre supuesto enriquesequeidau-pixel/cotizaflow devolvió 404. Ese nombre NO es un repositorio confirmado.
- C — PENDIENTE: publicar únicamente después de E2E y revisión de capturas aprobadas. No hay URL, proyecto Site, commit remoto ni ejecución CI verificados.
- D — Local, sin cuentas ni nube. Persisten límites de PDF Latin-1, sincronización, backup manual y edición de datos comerciales. No hay monetización implementada o activada. Identidad legal y soporte para lanzamiento comercial siguen sin confirmar.
- E — PENDIENTE: adquisición comercial tras comprobar el producto y la URL. No se crearon ni activaron campañas o gastos.
- F — REALIZADO: estado y evidencia incluidos en este paquete. No hay procesos de trabajo en segundo plano.

## Próxima operación exacta
1. Obtener acceso a un repositorio propio de CotizaFlow con escritura y Actions, y conocer su URL. No tocar otros productos.
2. Comparar cualquier código remoto existente antes de incorporar esta revisión; preservar los cambios posteriores a v1.1 que no estén en este paquete.
3. Subir fuente y `.github/workflows/visual-e2e.yml` mediante rama de trabajo. Ejecutar los dos jobs de navegador. Leer resultados JSON, PDF, capturas y trazas; corregir y reejecutar fallos.
4. Solo después de aprobación real de QA, preparar despliegue y verificar los flujos sobre el destino. No interpretar el workflow escrito como ejecutado.
5. Continuar comercialización y pagos con las autorizaciones necesarias, sin inventar identidad ni presupuestos.

## Regresiones cubiertas por pruebas unitarias
Importación válida y migración de moneda; ida y vuelta JSON; identificadores hostiles; campos malformados; números/monedas/estados inválidos; referencias rotas; IDs y números duplicados; fechas imposibles; importes inseguros; claves desconocidas; numeración tras borrar; filtros combinados; día local de Santiago. Se mantienen seis pruebas previas de cálculos, validaciones, WhatsApp y estructura PDF.

## Casos preparados pero NO EJECUTADOS
12 combinaciones de viewport/motor. Clientes, catálogo, cotizaciones, recarga, estados, descarga PDF, enlace WhatsApp interceptado, ajustes, exportación/importación, rechazo de archivos inválidos, cuota de almacenamiento, recuperación de JSON roto y capturas por pantalla. No afirman Safari/iPhone físico ni apertura real de WhatsApp.
