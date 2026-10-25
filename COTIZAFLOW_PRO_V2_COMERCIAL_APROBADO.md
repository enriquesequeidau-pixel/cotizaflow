# CotizaFlow Pro v2 — alcance comercial aprobado

**Aprobación comercial:** 24 de octubre de 2026, zona horaria Chile.
**Comerciante previsto:** Sequeidau Labs SpA.
**Mercado inicial:** Chile. **Moneda:** CLP.
**Estado:** alcance comercial aprobado; mejoras nuevas pendientes de implementación, QA y comercialización. No se han autorizado cobros reales ni campañas pagadas.

## 1. Propuesta de valor

**«Cotiza profesionalmente, organiza tus oportunidades y no pierdas clientes por falta de seguimiento».**

Público inicial: técnicos, instaladores, contratistas, independientes y pequeños negocios que trabajan con presupuestos.

## 2. Precios y servicios

| Plan | Precio | Condición |
|---|---:|---|
| Free | $0 CLP | Gratis sin caducidad, sin recortar funciones existentes |
| Pro | $7.990 CLP/mes | Suscripción mensual; beneficios nuevos solo después de implementación y pruebas |

**No están aprobados:** Business, cobro anual, créditos, tarifas nuevas, pagos reales, anuncios pagados, facturación tributaria ni inventario.

**Free retiene, sin nuevos límites artificiales:** clientes, servicios, cotizaciones, cálculos, descuentos/impuestos configurables, PDF básico, enlace de WhatsApp con mensaje prearmado, estados, fechas, importación/exportación JSON y respaldo manual cifrado opcional en nube. La versión actual mantiene almacenamiento primario local; **el backup manual no equivale a sincronización automática**. No restringir el número de cotizaciones, clientes o descargas que hoy se permiten.

**Pro incluye Free + los 6 módulos aprobados**, con las condiciones definidas a continuación.

## 3. Funciones definitivas Pro

### Módulo 1 — Sincronización automática segura multidispositivo
- Tras iniciar sesión, mantener clientes, servicios, configuración y cotizaciones actualizados entre dispositivos.
- Modo sin conexión con cambios pendientes visibles y sincronización posterior.
- Detectar conflictos de edición concurrente, impedir sobrescrituras silenciosas y ofrecer resolución segura.
- Mantener respaldo independiente, recuperación y exportación de la información.
- No convertir directamente el respaldo manual cifrado en una falsa «sincronización»; seleccionar arquitectura de protección criptográfica y custodia de claves antes de desarrollar.

### Módulo 2 — Seguimientos y recordatorios inteligentes
- Panel con cotizaciones próximas a vencer, atrasadas y por contactar.
- Recordatorios dentro de la aplicación.
- Resumen diario opcional por correo con consentimiento explícito, preferencia de desactivación y controles antiabuso; no enviar emails hasta implementar consentimiento y sistema autorizado.
- Enlace para componer WhatsApp que envía el propio usuario, sin mensajería masiva.
- Exportación de calendario ICS conservando zona horaria y fechas.

### Módulo 3 — Aceptación digital de cotizaciones
- Enlaces privados, de un solo destinatario cuando corresponda, con vencimiento, revocación y validación de identidad mediante código al email indicado.
- Presentar la versión inmutable, precio, vigencia y términos de la propuesta; permitir aceptar/rechazar.
- Auditar respuesta, identificador de versión, fecha y prueba mínima de verificación; evitar almacenar excesivos datos personales y definir retención.
- Cualquier cambio posterior exige nueva versión y nueva aceptación; prevenir replays y acceso de destinatarios a otros clientes.
- Constancia PDF o descargable de aceptación/rechazo.
- **No comercializar como firma electrónica avanzada, firma certificada ni factura SII.** Validar aplicación de Ley 19.799 y normas pertinentes con asesoría legal antes del go-live.

### Módulo 4 — Cotizaciones reutilizables
- Duplicación de propuestas, modelos por tipo de trabajo, servicios/cantidades/notas precargadas.
- Nueva numeración y fechas, importes revisables y estados independientes, sin modificar el original.
- Evitar errores de copia de identidad/fecha y referencias rotas.

### Módulo 5 — PDF profesional con identidad persistente
- Logo, colores, teléfono/correo, condiciones, observaciones y pie de página guardados y editables.
- PDF profesional paginado, exportable, legible en celulares y con caracteres del español; validar imágenes y no incrustar HTML inseguro.
- Mantener PDF básico Free. Cotizaciones no son facturas tributarias.

### Módulo 6 — Indicadores comerciales y reportes
- Total cotizado, cotizaciones enviadas/aceptadas/rechazadas, tasa de aceptación de las enviadas, valor aceptado, vencidas y seguimientos.
- Filtros por período y cliente, gráficos sencillos y exportación CSV segura.
- **No confundir «cotizado» o «aceptado» con «ingreso cobrado», ventas facturadas ni dinero recibido.**

## 4. Cancelación y derechos del usuario

- La vigencia Pro depende de pago efectivamente verificado en servidor y período contratado. Una autorización de suscripción sin pago aprobado no debe activar Pro.
- Cancelar detiene renovaciones conforme a la pasarela y términos presentados; no elimina datos de clientes ni cotizaciones.
- Siempre conservar exportación de datos personales y PDF básicos para Free, incluso tras cancelar.
- Documentar el período de lectura, descarga, retención y eliminación de datos cloud tras expiración; **no prometer sincronización gratuita indefinida**.
- No prometer garantías de aumento de ventas, entrega garantizada de correos ni disponibilidad ininterrumpida.

## 5. Exclusiones expresas del lanzamiento

Factura electrónica SII, boleta, gestión contable, inventario, cobros de las cotizaciones al cliente final, conciliación bancaria, firma electrónica avanzada, WhatsApp automatizado y gestión multiusuario por empleados.

## 6. Qué existe y qué falta

**Código existente:** UI/editor Free, datos locales, CSV/reportes y estudio Pro parcial, seguimientos y ICS, personalización efímera de logo/color, Supabase Auth/respaldo manual cifrado, pasarela Mercado Pago bloqueada. Algunos textos/documentos antiguos describen entregas anteriores y no certifican despliegues en producción.

**Por implementar y probar:** sincronización en tiempo real/por cambios, conflictos/offline, correos de recordatorio opt-in, aceptación digital segura, plantillas reutilizables persistentes, ajustes de marca persistentes, panel completo y QA integrado; conservar funciones Free sin regresiones.

## 7. Estado de cobros y permiso de comercialización

El catálogo de Supabase indica **Chile $7.990 CLP/mes, `checkout_enabled=false`**; el estado fue verificado en conversación el 24 de octubre de 2026. México tiene una configuración separada no aprobada para el lanzamiento. No modificarla ni reutilizar webhooks de PromoFlash.

**Este documento aprueba el alcance para desarrollo y QA, NO el lanzamiento comercial.** Mantener checkout, anuncios pagados y dinero real desactivados. Solicitar autorización expresa y nueva cuando se hayan completado todos los controles. Plan técnico: `COTIZAFLOW_PRO_V2_PLAN_TECNICO_QA.md`.
