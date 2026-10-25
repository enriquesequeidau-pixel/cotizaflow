# CotizaFlow Pro v2 — plan de implementación y validación

**Aprobado para planificar/implementar y probar; no autorizado a cobrar dinero real.**
**Fuente de requisitos comerciales:** `COTIZAFLOW_PRO_V2_COMERCIAL_APROBADO.md`.
**Fecha:** 24 octubre 2026 (Chile).

## 0. Principio de no destrucción

Inspeccionar commits y versión efectivamente desplegada antes de cambios. Mantener formato de respaldo `cotizaflow-v1` migrable, archivos `app.mjs`, `core.mjs`, `backup.mjs`, `cloud.mjs`, `pro.mjs` y contratos previos. Trabajar en rama independiente, comparar diferencias y no fusionar/publicar sin QA. Mantener `public.cotizaflow_mp_catalog.checkout_enabled=false` y NO activar anuncios.

## 1. Inventario, backup y diseño (Gate 0)

1. Leer última versión operativa de GitHub, GitHub Actions, hosting y base Supabase actual; resolver discrepancias documentales. Registrar dependencias con identidad central y las otras MicroApps (PromoFlash y MisterioYa).
2. Crear respaldo independiente y cifrado de los datos relevantes con ensayo de restauración en copia de ensayo, sin sobrescribir producción.
3. Auditar esquema actual y políticas RLS de `cotizaflow_user_data`, `cotizaflow_mp_subscriptions`, `cotizaflow_mp_catalog` y funciones Edge; no ejecutar DDL hasta revisar el efecto en apps vecinas.
4. Diseñar modelo de datos con versionado de registros y logs mínimos para sincronización; plan de migración desde localStorage/JSON y rollback; resolver método de cifrado y recuperación de claves antes de comenzar la sincronización.
5. Evaluar costo y límites de almacenamiento y envíos de emails; política de retención de respaldos, documentos y aceptaciones.

**Gate 0 aprobado si:** inventario y backup-restauración probados, contratos de datos definidos y reversión reproducible.

## 2. Plataforma de sincronización (Gate 1)

- Modelar clientes, servicios, presupuestos, ítems, configuración comercial con ID estable, owner ID, revisión/version timestamp, marcas de borrado (tombstones) y validación de datos.
- Sincronizar cambios incrementales bajo sesión autenticada; cola local offline y conciliación al reconectar; deduplicar eventos.
- Conflictos: nunca «último en escribir gana» sin avisar para datos comerciales sensibles. Mostrar diferencias y permitir elegir o duplicar copia antes de resolver.
- Una cuenta = sus datos; RLS propietario en tablas expuestas, `USING` y `WITH CHECK`, controles de relación parent/child, no permitir reatribuir dueño, y evitar privilegios basados en user_metadata.
- Cifrado en tránsito, en reposo según amenaza, backup aislado y custodia de claves; no subir respaldos cifrados manuales y afirmar que ya se sincronizan.
- Separar Free local/backup manual de Pro sync. Si Pro vence, no borrar datos sin permiso y permitir exportación de datos Free.
- Interfaces y endpoints se diseñan en entorno de prueba, sin tocar producción.

**Prueba de aceptación:** dos dispositivos de misma cuenta; editar offline y recuperar red; cambios simultáneos muestran conflicto; no hay pérdida silenciosa; dos cuentas diferentes no comparten filas.

## 3. Cotizaciones recurrentes y documentos (Gate 2)

- Plantillas y duplicación de cotizaciones: nuevo ID/número/fechas, nuevo estado borrador, precios/condiciones revisables y referencias a clientes propias.
- Persistencia y recuperación de kit de marca (logo validado, colores, datos comerciales, condiciones). Límite de tamaño y formato para archivos; política Storage privada y RLS si hay cloud.
- PDF básico Free sin cambios funcionales; PDF Pro con Unicode/español y paginación reproducible, no inyectar HTML sin sanitizar. Archivos finales exportados manualmente por el usuario.
- Garantizar que reportes CSV no ejecuten fórmulas al abrirse en planillas.

**Aceptación:** duplicar sin modificar original; plantilla sobrevive a recarga y segundo dispositivo Pro; PDF con textos acentuados, tablas extensas y logos válido/incorrecto.

## 4. Seguimientos y dashboard (Gate 3)

- Convertir actual seguimiento/ICS y panel Pro parcial en panel consistente de próximas, vencidas, rechazadas, aceptadas; contadores y filtros.
- Resumen diario de pendientes por email **opt-in**, configuración de preferencia, unsubscribe/desactivación y envío limitado. Excluir nombres/valores sensibles si no hay autorización.
- Sin envío automático a WhatsApp. Guardar auditoría mínima de recordatorio y no duplicar emails por reintento.
- Calcular tasas evitando división por cero y separando status «aceptada» de pagos reales.
- Cubrir fechas locales y cambios DST/Chile.

**Aceptación:** indicadores coinciden con registros, email solo por opt-in, usuario puede revocar preferencia, ICS válido y estados correctos en huso horario Chile.

## 5. Aceptación digital segura (Gate 4)

- Modelo de propuesta inmutable/versionada, URL con token aleatorio de alta entropía y hash de token en servidor, expiración/revocación y controles anti-replay.
- Destinatario verifica email mediante código de un solo uso con TTL y tasa limitada, vinculado a propuesta específica; no se permite que el propietario la acepte en nombre de cliente sin evidencia.
- El cliente revisa texto, condiciones, monto y validez antes de aceptar o rechazar; registrar versión exacta, timestamp UTC, método verificado y consentimientos mínimos. Generar constancia descargable.
- No crear un enlace indexable públicamente; exigir controles contra enumeración, IDOR, reuso, manipulación de estados y XSS.
- Se requiere revisión jurídica de promesa y nivel probatorio; no llamar «firma avanzada» o «certificada» sin proveedor autorizado.

**Aceptación:** enlace expirado/revocado o código ajeno da 403/410; doble aceptación no duplica registros; nueva versión invalida la anterior; cliente no accede a otras cotizaciones; registro auditable.

## 6. Entitlements, pagos sandbox y QA final (Gate 5)

- El Pro necesita pago `approved` verificado por proveedor en backend; revisar origen, monto CLP 7990, merchant, idempotencia y webhook firmado. `authorized` no basta.
- Estado Free: conservar editor actual y PDF básico sin registro obligatorio; acceso a datos locales, backups JSON y manual cloud sin pago; negar solo beneficios premium nuevos.
- Pro: permisos server-side en sincronización, aceptación, marca premium, plantillas y reportes cuando aplique; no fiarse de `localStorage` como prueba del plan.
- Cancelación/expiración/reembolso/fallo de cuota: probar revocación efectiva y mantenimiento de exportación de datos, sin borrado automático.
- Pruebas automatizadas unitarias, integración y E2E móvil/desktop; Edge Functions negativas, RLS adversarial, XSS, entradas y archivos hostiles, concurrencia, antispam, seguimiento de errores/alertas, import-export y rollbacks.
- Probar compra ficticia, fallos de cobro, webhook duplicado, pago rechazado, recuperación de sesión y cancelación en Sandbox.
- Revisar legal SII/privacidad, política de retención, soporte y obligación de información al consumidor.

**Gate 5 aprobado si:** suite verde con resultados de pruebas verificables, backup-restauración en copia, casos negativos, sandbox, revisión manual de móvil y evidencias de permisos.

## 7. Separación de entornos y acciones prohibidas

- Probar primero en rama/entorno aislado y base de pruebas sin datos personales reales.
- No aplicar migraciones SQL en la base compartida, no cambiar policies/productos/proveedores ni modificar servicios vinculados a otras apps como parte de preparar este plan.
- No activar `checkout_enabled`, campañas pagadas, llaves Live, ni tocar configuración bancaria y tributaria.
- La auditoría histórica «80/80» certificaba otros controles, NO los módulos de CotizaFlow que todavía no se han desarrollado.
- Gate final de producción requiere **autorización expresa separada** del propietario, pasarela verificada, cumplimiento legal, pruebas de resiliencia y QA satisfactorio.

## 8. Estado

**Documentación escrita, no implementación ni pruebas nuevas ejecutadas.** Los números de Gates expresan secuencia de trabajo, no hitos terminados.
