# CotizaFlow — continuación v1.2

Esta revisión parte exclusivamente del ZIP v1.1 adjunto. No incluye cambios de otros paquetes no disponibles. Estado vigente: `HANDOFF.md`.

Aplicación mobile-first en español para técnicos y pequeños negocios. No se ha desplegado ni habilitado ningún cobro.

## Ejecutar

Requiere Python 3 (o cualquier servidor HTTP estático). Desde esta carpeta:

```bash
python3 -m http.server 8765
```

Abre `http://localhost:8765` en tu navegador. No necesita instalar paquetes ni conexión a internet. Para pruebas automáticas se requiere Node.js 18+:

```bash
node --test tests/*.test.mjs
```

## Recorrido funcional

1. En **Ajustes**, introduce el nombre y datos de tu negocio, la moneda y el impuesto predeterminado.
2. Crea un **Cliente**, idealmente con número de WhatsApp en formato internacional, ej. `56912345678`.
3. En **Servicios**, crea el catálogo de precios habitual.
4. Crea una **Cotización**, selecciona el cliente, añade líneas, cantidades y precios, y guárdala.
5. Usa **PDF ↓** para descargar el presupuesto. Usa **WhatsApp ↗** para abrir un mensaje prellenado y **adjunta el PDF manualmente** desde WhatsApp.
6. Cambia el estado a **Enviada** y ajusta la fecha de seguimiento. En **Inicio** se verán las enviadas pendientes y sus vencimientos.
7. Usa **Ajustes → Exportar respaldo JSON** para guardar los datos; también puedes importar un respaldo.

## Arquitectura y límites

- App estática: `index.html`, `style.css`, `app.mjs`, `core.mjs`.
- Persistencia `localStorage` por origen/navegador; sin multiusuario, sincronización, servidor, autenticación ni base de datos remota.
- PDF 1.4 local generado sin dependencias, tipografías estándar y codificación WinAnsi (caracteres especiales fuera de Latin-1 se sustituyen). Documento informativo, no factura fiscal.
- `window.open` abre WhatsApp o su compositor público; nunca transmite automáticamente documentos ni marca como enviada. El PDF debe adjuntarse manualmente.
- Las fechas de seguimiento son **recordatorios visuales** al abrir el panel, no notificaciones automáticas.
- No incluir datos sensibles de terceros sin autorización. Almacenar datos en un dispositivo compartido expone contenido a otros usuarios del navegador.
- No apto para producción en su estado actual; pendiente migración a backend con autenticación, autorización, copias de seguridad, auditoría de privacidad, accesibilidad exhaustiva y tests E2E multiplataforma.

## Verificación v1.2

- 16 pruebas unitarias ejecutadas y aprobadas. Registro: `verification/unit-tests.txt`.
- Sintaxis JavaScript y Python comprobada.
- Suite E2E preparada para Chromium y WebKit en 320, 360, 375, 390, 430 y 1440 píxeles. **No ejecutada en esta revisión**. Los nombres móviles describen viewports, no dispositivos reales.
- El entorno administrado no tiene la capacidad de navegador requerida. GitHub no mostró repositorios accesibles. El workflow sigue preparado, sin ejecución verificada.
- Ejecutar fuera de este entorno administrado: `python -m pip install playwright==1.56.0`, `python -m playwright install --with-deps chromium webkit`, después `BROWSER=chromium python tests/e2e_playwright.py` y `BROWSER=webkit python tests/e2e_playwright.py`.
- La suite intercepta `window.open` para verificar el enlace WhatsApp sin abrir el servicio ni enviar mensajes. Conserva capturas, trazas, PDF, respaldo y resultados JSON.

## Cambios v1.2

Validación estricta de respaldos con rechazo de identificadores inseguros, registros duplicados, clientes inexistentes, fechas imposibles, importes no finitos y monedas no admitidas. Los archivos inválidos no reemplazan datos. Si los datos iniciales no se pueden leer, se bloquean escrituras y Ajustes permite exportar los bytes recuperables; el archivo exportado puede necesitar reparación antes de restaurarse. Si no existe acceso al almacenamiento, no se puede recuperar su contenido.

Los errores de guardado ya no anuncian éxito. Las cotizaciones conservan su moneda al cambiar Ajustes; las antiguas reciben la moneda configurada al migrar (no se puede reconstruir una moneda histórica nunca guardada). Fechas según el calendario local, números disponibles después de eliminaciones, búsqueda y estado combinados, etiquetas accesibles y ajustes CSS para pantallas estrechas. Los cambios visuales todavía requieren verificación en navegador.

Los respaldos importados admiten como máximo 2 MB. Exporta regularmente; no hay copias automáticas. No hay pagos, analítica remota ni anuncios activos.
