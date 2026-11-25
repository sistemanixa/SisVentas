# Lector aislado del historial de pagos

Cambio para integrar sobre fuente pública d4b14f791c2aa0bc36766b388ae91374ccc926c4. Sólo helper nuevo y pruebas: no cambia app, index, SW, lectores compartidos ni backend.

Crear una instancia por montaje con `SVSalePaymentHistory.create(window)`. API:

- `state(record)`: `{status:'idle'|'pending'|'error'|'ready',payments:null|DTO[],complete,...}`. Sólo ready acredita una lista vacía. Ready conserva source y paidAmount del servidor.
- `ensure(record,onReady,{retry:false})`: devuelve Promise del estado, deduplica por original/fresh y contexto. Error no reintenta desde render; usar `{retry:true}` explícito.
- `onReady(freshRecordOrNull,state)`: sólo contexto vigente; ready entrega original fresco con fbKey normalizada. En error entrega null y estado para renderizar mensaje/reintento. Root debe usar paymentHistory del estado; no revivir record.pagos si source global, ni sintetizar pagos desde totalPagado.
- `reset(record?)`: invalida toda esta instancia/apertura, aunque reciba record; `dispose()` también retira observadores/eventos. Root puede resetear explícitamente al cerrar detalle.

Un GET mediante `SVCommercialOwnership.request('ventas','registro/'+encodeURIComponent(record.fbKey)+'?para=pagos')`, sin body ni llamadas normales modificadas. Valida ok/record/clave coincidente, schema1/complete true, source global|embedded|legacy, importes numéricos finitos no negativos, fecha string o epoch finito, flags y metadatos DTO. No suma ni redondea importes; conserva anulado/estado/hasReceipt y descarta campos extras del DTO, incluidos binarios. No listener global de pagos, sondeo ni almacenamiento persistente.

Contexto: selección por objeto y fbKey, usuario/auth/db/rol/revisión permisos/epoch/ruta, detalle visible y permiso venta. Deniega viewAs sin GET. WeakMap alias original/fresh evita ciclo al aplicar freshRecord y volver a renderizar. Navegación/sesión/rol/ocultamiento invalidan; completado viejo sólo cancela su scope `salePaymentHistory`, nunca el loading nuevo ni la fuente global pagos. La request compartida no ofrece AbortSignal externo: cancelación individual es lógica y no aborta lecturas ajenas. No se cambió esa API.

Validación: 18 tests modelo PASS y 2 Chrome aislado 390/1280 PASS con lector comercial real + HTTP ficticio, sólo GET. Incluye pago global120 recién registrado con embedded vacío, no síntesis desde total, vacío confirmado, DTO inválidos, reintento, sesión/selección/permisos/ruta/db/auth/rol/hide, anulados, viewAs y scope viejo/nuevo. Un primer HTML ficticio omitía charset y falló la comparación de «Cargando pagos…»; corregido el fixture UTF-8, sin relajar expectativas. Syntax y diff check PASS. Backend C, montaje visual de Root y publicación18 pendientes; ninguna escritura ni anulación real ejecutada.

## Interoperabilidad de DTO históricos
Follow-up: source global exige fbKey de snapshot válida y única (id no sustituye fbKey); embedded conserva IDs opcionales string/número finito y entradas separadas por orden, incluso IDs repetidos/ausentes, sin crear id/fbKey. Fecha ausente/null se conserva tal cual en ambas fuentes; Root presenta — cuando corresponda. Flags/hasReceipt y montos siguen estrictos. Legacy exige payments vacío y conserva paidAmount autoritativo sin sintetizar filas. 25 modelo +2 Chrome reales GET ficticios=27PASS,0fail/skip. Se conserva rechazo viewAs/permisos/sesión y scopes loading independientes. Sin app/index/shared/backend ni datos reales modificados.
