# Lector autorizado de KPI, últimos cinco y badge de Presupuestos

Propuesta inactiva posterior a `2a5c756a763a0646de97d407510cb1678e65755d`. Sólo agrega archivos propios; no modifica aplicación, servidor activo, guard ni reglas; una corrección posterior coordina documentSort del modelo/planner/lector. No se habilitó ruta en `index.js` ni se publicaron activos. El centro de notificaciones permanece pendiente.

## Autoridad existente y consultas

`cotizador/dashboard-budget-reader-proposal.js` exporta `createDashboardBudgetReader`, `createIndexPorts` y la ruta propuesta GET `/commercial/dashboard/presupuestos`. La fábrica exige `enabled:true` explícito, SDK Admin/db, verificador Auth y proveedor de fecha de servidor `getAsOfDay`. Sin habilitación devuelve 503. No acepta cuerpo, filtros, UID, scope, cursores o Ver como enviados por cliente. No contiene caché, listeners, timer o sondeo.

Reutiliza `createBusinessAuth` para revocación/reset y `createCommercialOwnership.authorize` con `scopedReads:true`. El perfil se verifica con la consulta real `sv_usuarios.orderByChild('uid').equalTo(uid).limitToFirst(2)`; dos perfiles ya bastan para rechazar ambigüedad. Lee rol y permisos puntuales y exige versión/revisión de permisos válida, módulo Dashboard y elegibilidad de Presupuestos mediante las funciones existentes. El ámbito es `all` para el administrador real o `u_UID` para los demás; no hay resolver alternativo de propiedad. No habilita acciones del Dashboard ni cambia su visibilidad: el host futuro deberá respetar sus consumidores/acciones vigentes.

Cuatro verificaciones frescas de Auth/actor en la petición completa: inicial, dos del lector badge existente y final. Se fijan UID real/efectivo, rol, nombre, claims y revisión/digest de permisos; cualquier cambio descarta la respuesta. El verificador recibe siempre revocación habilitada. Revalidar el token no impone un nuevo requisito de antigüedad de login: conserva el contrato compartido actual.

La huella global de política del índice se contrasta entre coverage y `policy/hash`, sin recalcularla descargando directorios completos. La identidad y los permisos del actor se verifican independientemente por las lecturas anteriores. Esto depende del contrato ya pendiente de mantenimiento atómico por **todos** los escritores de autoridad; no detecta mágicamente escrituras que eludan ese contrato.

## Metadata y respuesta

Lee coverage, policy, stats y scopeProof del ámbito antes/después. `badgeCounts` reutiliza su validación de metadata, generation/revision y comparación **legacy-raw-lex/v1**, con páginas RTDB de hasta 50 desde hoy. Se verifica que su generación/revisión coincidan con las del resultado combinado. Metadata ausente, cobertura no ready, scope inexistente, drift o páginas agotadas producen error; no se sustituyen por cero. Un ámbito `all` vacío explícitamente certificado sí puede devolver cero.

La consulta de documentos es `orderByKey().limitToFirst(5)` desde el comienzo. Usa `DataSnapshot.forEach`, preservando el orden nativo, y exige exactamente min(5, records) filas. Valida clave/orden/fecha, campos ligeros acotados y propiedad en scope propio. Restaura sólo `amountCents:null`, eliminado por RTDB al persistir. Si unknownDates no es cero, rechaza el resultado combinado: no puede certificar los últimos cinco. No consulta originales ni fuentes/membresías históricas completas.

La respuesta contiene cuatro agregados del KPI, cinco filas como máximo, badge/próximos exactos, UID/rol/revisión de permisos y generation/revision. Últimos cinco significa **fecha comercial diaria y desempate de fuente**, bajo document-date-desc/budget-key-sha256-v1; no timestamp de creación/edición ni el recorte heredado de 60. No certifica actividad mixta global. El prefijo de transporte no lleva referencias locales auth/db; el host futuro deberá fijar su contexto vivo y grant antes de entregarlo al Core, y adaptar el nuevo contrato: Core v1 todavía lo rechaza explícitamente. No hay adaptación activa del navegador.

`handle(req,res)` es el transporte HTTP propuesto, también inactivo: JSON, `Cache-Control:no-store` y errores sanitizados sin datos parciales. No retorna fotos, ítems, costos, auditorías, originales ni credenciales. Un servidor real deberá aplicar el montaje, límites y políticas de transporte existentes al integrar; aquí no se agrega un servicio separado.

## Evidencia real de emulador y límites

Pruebas unitarias: `node --test test/dashboard-budget-reader-proposal.test.cjs` (7 casos). Fixture de datos y trazador de rutas propio: `test/helpers/dashboard-budget-reader-fixture.cjs`.

Prueba nativa opt-in: `test/dashboard-budget-reader-emulator.integration.cjs`, únicamente `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9057`, `SV_BUDGET_READER_EMULATOR=1` y `SV_BUDGET_ADMIN_MODULE` apuntando a una instalación existente de firebase-admin. Usa un namespace propio `demo-budget-reader-PID`, credencial local owner sin ADC y lo elimina/verifica al finalizar. El emulador puede iniciarse con el jar RTDB instalado, `--host 127.0.0.1 --port 9057`. Ejecutar con Node; sin opt-in la integración se omite explícitamente.

Cinco casos nativos pasan sin omisiones. Un commit real de `createLaborGuard` + `createLaborRtdbStore` + planner/codec existentes persiste originales/derivados en RTDB ficticio. Después, el SDK Admin lee 5.001 vencidos y 50 futuros con **dos queries badge**, una query de cinco documentos y cero lecturas de originales del lector. El resultado JSON observado pesa 1.828 bytes; no mide tráfico físico, costo de Auth ni ahorro productivo. La comprobación anterior de origen usa datos de fixture, no una descarga cliente de originales.

También se prueban 100 empates, Unicode dentro del límite persistible, admin/propio, metadata ausente, fecha desconocida, cambios tardíos de permisos/reset/coverage/policy, rechazo de scope por HTTP y revocación simulada. Las consultas, persistencia, normalización de null y HTTP loopback son reales; el verificador externo de tokens es un fixture. Los componentes compartidos de autorización/reset/permisos sí son reales. Las reglas locales del namespace son deliberadamente permisivas para probar persistencia/consultas: **no** se certifican reglas de seguridad ni Auth del proveedor real.

La primera ejecución nativa detectó un digest incorrecto del fixture (corregido) y un path de documentos de 823 bytes con 128 caracteres 漢 (rechazado por SDK). El lector se congeló con ese hallazgo en 69b915d4 antes de corregirlo. La corrección separada reemplaza sólo el desempate de almacenamiento por SHA256(JSON.stringify(clave original)): clave de índice 73 bytes, path probado 118 bytes sin separador inicial. La prueba nativa ahora persiste y consulta el límite UTF-8 1/2/3/4 bytes y combinados; coteja orden contra un oráculo SHA independiente y conserva originales/huellas. Los logs fallidos anteriores siguen en tmp privado. No cambia fecha ni trunca identidad; sí cambia explícitamente el desempate del día.

Pendientes: adaptar el contrato SHA-256 en Core/host; cubrir todos los escritores/autoridades y gate; preparador/reconciliación/instalación; reglas y verificación de Auth real; montar handler; adaptación de contexto/consumidores del cliente; centro de notificaciones y actividad mixta. Un lector propuesto verificado no significa que estos pasos estén aplicados.

El lector exige coverage.documentOrder exacto antes de consultar documentos. Un índice anterior sin marca o con source-order-v1 requiere reconstrucción offline explícita con generación nueva; no se certifica como vacío, no se modifica in situ ni se agrega otra raíz.
