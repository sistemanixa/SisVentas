# Cobertura de escritores de las vistas de cuenta · v3.15.0

Auditoría local de fuentes del 25/10/2026. No consulta servicios, revisiones remotas, credenciales ni datos de negocio. No ejecuta preparación histórica, migración, despliegue ni cambios de reglas. Las referencias corresponden al checkout candidato; las funciones identifican el alcance si cambia su número de línea.

**Habilitar `sv_labor_config.employeeAccountViews` no demuestra cobertura de escritores.** Un Cotizador anterior que use un guard sin `employee-account-view-delta` puede seguir confirmando escrituras originales con un fence válido y dejar las vistas atrasadas. Un Cotizador con el circuito acotado apagado puede escribir mediante Admin SDK o la transacción raíz anterior. La frescura exige retirar o contener todos esos escritores antes de preparar y activar las vistas.

## Fuentes y contrato cubierto

| Fuente original | Vista derivada | Captura del cambio |
| --- | --- | --- |
| `sisventas/ctaemp/{empleado}/{movimiento}` | `employees/{empleado}/ctaemp` y metadata de cuenta | Punto/campo; también reemplazo de una cuenta concreta, expandiendo sólo sus claves anteriores/posteriores. |
| `sisventas/gastos/{gasto}` | `globalExpenses/rows/{gasto}` y `employees/{propietario}/gastos` | `changes` del guard. Movimiento de propietario retira la copia anterior. |
| `sisventas/pagos_realizados/{lote}` | `globalPaymentBatches/rows/{lote}` | Registro o campo; referencias puntuales a Gastos, con caché de la misma operación. |
| `sisventas/auditoria_pagos/{auditoria}` | `globalPaymentAudit/rows/{auditoria}` | Registro/campo y snapshots anteriores tipados. |
| `sisventas/empleados/{empleado}` | `globalEmployeeDirectory/rows/{empleado}` | Registro/campo; alta vacía de cuenta sólo con las precondiciones documentadas abajo. |
| `sisventas/config/cargos/{cargo}` | `globalCargoDirectory/rows/{cargo}` | Registro/campo, nunca una lectura incidental de toda Configuración. |

Todas las vistas están bajo `sv_employee_account_views/v1`. Sus revisiones son UUID técnicos, independientes de importes; un cambio original oculto también rota la revisión aunque el DTO resulte idéntico. `ready:true` previo se conserva sólo con proyección completa. Ausencia, ambigüedad o historia parcial produce cuarentena; no convierte un saldo desconocido en cero. El cambio original legítimo no se transforma para que pase la proyección.

El gancho está en `cotizador/labor-guard.js`, `execute`, después de los validadores y los deltas de índices y antes del recibo/commit (`AccountViews.prepareDelta`, línea158 al revisar). No hay un segundo PATCH ni un trabajo posterior. `cotizador/employee-account-view-delta.js:32` toma el estado posterior de `raw/get` del scope. Los scopes amplios `sisventas`, `sisventas/config`, `sisventas/ctaemp` y los padres completos de RR. HH./companions se rechazan, en lugar de descargar esas raíces como alternativa. Gastos se obtiene de los cambios ya inventariados por el guard.

El root derivado está reservado tanto en el gateway como en `scope.update`, incluso con la feature apagada. Un cliente no puede suministrar sus propias revisiones o `ready` dentro de un PATCH de negocio.

## Cotizador: vías de escritura y condiciones exactas

`cotizador/index.js:37-40` crea un único `laborRuntime` desde `admin.database()` y pasa `laborRuntime.db` a los servicios. `cotizador/labor-runtime.js:5-7` selecciona el proxy y la transacción por registros **únicamente** cuando `LABOR_SCOPED_ENABLED==='true'`. Ausente o cualquier otro texto conserva el Admin DB y `labor-transaction.js`, que usa GET/PUT de `sisventas`. La prueba nueva reproduce esa selección sin red.

`cotizador/labor-db.js:33-70` intercepta `set`, `update`, `remove`, `push(value)` y `transaction`, también mediante `child`, `parent`, `root`, `ref`, `refFromURL` y el `ref` de un snapshot. Si algún path está protegido, no lo adelanta al Admin SDK: lo incorpora al scope actual o abre un guard interno. Rechaza transformaciones asíncronas y métodos no compatibles con el overlay. `labor-guard.affected` incluye las seis fuentes, sus campos y los padres pertinentes. Una creación de clave con `push()` sin valor no es una escritura de negocio.

| Entrada activa | Fuentes que puede escribir | Trayecto hasta el gancho |
| --- | --- | --- |
| `/laboral/escritura` y su compare/atomic/versionado | Las seis fuentes según ruta/permisos; companions y CTA/Gastos por sus contratos | `labor-write-gateway.js:64`, `labor-view-writes.write` → `guard.run`. |
| `/laboral/cuenta/comando` | CTA y espejo Gastos de aprobación/rechazo/materialización/corrección/entrega | `employee-account-commands.execute` → mismo guard; proof interno para sus excepciones finitas. |
| `/laboral/gastos/comando` | Gastos, CTA vinculada, lotes y auditoría | `employee-expense-commands.execute` → mismo guard; originales y pagos privados se conservan en servidor. |
| `/laboral/movimientos/comando` | CTA nueva o retirada; Gastos y regla periódica cuando corresponden | `employee-movement-create.execute` → guard con identidad `command`, binding/acciones/nonce y revalidación fresca. |
| `/laboral/empleados/comando` | Estado e historial/adjuntos tipados del empleado | `employee-directory-commands.execute` → mismo guard; no sustituye el empleado por un DTO. |
| `/laboral/haberes/comando` | Bonificación: CTA/Gastos; SAC: Gastos | `employee-payroll-commands.execute` → mismo guard y validadores previos. `sac-preview` sólo lee. |
| `/laboral/liquidacion/comando` | Registro mensual: CTA/Gastos/Haberes y compensaciones de adelantos; aplicación posterior: esos mismos registros vinculados | `employee-monthly-payroll.execute` → mismo guard. Cargo/empleado autoritarios, metadata HR o nonce de cuenta, hashes internos y revalidación fresca; `monthly-preview` sólo devuelve la preparación del sueldo y no escribe. No recibe originales ni hashes del cliente. |
| `/laboral/gastos/crear-administrativo` | Gasto y CTA espejo opcional | `admin-expense-create.js:50-86` → `guard.run`; no hace el set Admin original por delante. |
| Horas extra y gasto personal | Gastos, CTA/hsextra según operación | `index.js:58,62-75`: `laborRuntime.transaction` → `labor-scoped-transaction.js:179-190` → guard. |
| Redistribución de comisión | Gastos y CTA vinculada | `commission-operations` usa la misma transacción acotada. |
| Generación manual, evento, reintento de evento | CTA/Gastos y controles de generación | `index.js:76-85` envuelve `generate`, `systemGenerate`, `retryPending` y el evento en `laborRuntime.run`; `commission-generation.js:73-76` escribe mediante el DB envuelto. |
| Reparación/edición directa de empleado o cargo desde SDK/web | Empleado/cargo puntual | Las envolturas de la web envían al gateway; el proxy/guard central conserva el delta. Los cambios privados de historial usan su comando específico. |

Las nuevas rutas de comando heredan `laborWriteGateway.authorize`, que rechaza solicitudes si el circuito acotado no está habilitado (`labor-write-gateway.js:20-23`). No hay un endpoint libre de Admin que permita al navegador elegir `mode`, actor o un plan original.

Condiciones que deben comprobarse en **cada escritor alcanzable**, sin cambiar las preferencias funcionales existentes:

| Control | Valor/condición requerida | Consecuencia |
| --- | --- | --- |
| `LABOR_SCOPED_ENABLED` | Texto exacto `true` para Cotizador. | Necesario para cubrir servicios heredados, DB y transacciones. Crear sólo el guard o habilitar sólo las vistas no basta. |
| Código del guard y closure | Incluye el hook, `employee-account-view-delta`, modelo, Directory y cálculos requeridos. | Modo acotado de una versión anterior sigue siendo insuficiente. |
| `COMMISSION_OBSERVER_ENABLED` | Apagado; con acotado `true` y observador `true` el arranque falla (`index.js:38`). | No sustituir eventos por escaneo por reloj. |
| `LABOR_SCOPED_READ_ONLY` | `true` durante contención autorizada; `false`/ausente sólo tras preparación verificada. | Bloquea guardados nuevos en esa revisión, permite resolver intentos. No contiene por sí solo instancias antiguas o solicitudes en curso de otro código. |
| `sv_labor_config.schema/ready` | Esquema1/listo, además del control propio de vistas. | Es la cobertura del circuito/índices; no prueba que exista la nueva proyección. |
| `employeeAccountViews` | `{schema:1,enabled:true}` sólo después de preparar y verificar cobertura completa. | Ausencia/deshabilitado añade cero I/O de proyecciones. No repara una historia previa. |
| `PAYMENT_SCOPED_ENABLED`, `ADMIN_EXPENSE_SCOPED_ENABLED` | Conservar lo autorizado; sus capacidades dependen además del flag acotado (`index.js:60-61`). | Son capacidades de sus comandos, no un mecanismo de frescura alternativo. Si apagados no habilitan escrituras Admin. |
| `COMMISSION_GENERATION_ENABLED/FROM`, `COMMISSION_EVENT_ENABLED` y su OIDC | Conservar configuración autorizada y destino actual bajo el runtime nuevo. | No es necesario habilitar generación para privacidad; si estaba activa, todo destino de eventos debe ser un escritor actualizado. |

ADC identifica a la cuenta de servicio, pero no acredita que una operación use el proxy. `labor-rtdb-store.js` confirma con `auth_variable_override`, fence, recibo y retirada del lease. Un Admin SDK anterior o un REST ADC sin ese override puede ignorar las reglas de clientes; por eso no se declara cerrado por inspeccionar únicamente `.write`.

## Web activa y clientes anteriores

`js/core/firebase.js:224-229` instala primero el adaptador de vistas y luego `SVLaborWrites`, antes de publicar `firebaseReady`. `js/core/labor-writes.js:8,24,127-218` intercepta las seis fuentes y ancestros en las cinco primitivas SDK de escritura. Lo hace también para helpers genéricos y para `SVGuardedWrites`, que llama a `fbRunTransaction` o delega al transporte laboral. El modo offline experimental conserva esas primitivas ya envueltas; Gastos y CTA están expresamente en su lista no encolable (`offline-core.js:21-23,179-206`).

Inventario de familias de la aplicación activa, con referencias de función para no confundir lectores con escritores:

| Familia | Funciones/puntos activos revisados |
| --- | --- |
| Empleados | `guardarNuevoGenerico` (30318), `confirmarEstadoEmpleado` (42332), `adjuntarDocumentoBajaEmpleado` (42377), `eliminarEmpleado` (42942); metadata por SDK/gateway e historial por comando. |
| Cargos | `_cargoGuardarSeguro` (26167), `cargosEliminar` (26306); transacción/retirada puntual. |
| Haberes/bonificación/adelantos | `_registrarHaberesAtomico`, `_aplicarAdelantosAlHaberAtomico`, `_guardarBonificacionEmpleadoAtomica`, `bonus-grant.js`, módulos `payroll*.js`. El nuevo servicio mensual conserva el registro delegado sin lectura de sueldos privados: Empleados + registrarHaberes para preparar/registrar y CTA + aplicarAdelantos para compensar. El bono inline conserva la autorización anterior de registrarHaberes. La integración cliente se valida aparte del delta. |
| Movimientos | `_guardarMovimientoVinculadoAtomico` (33992), `_guardarMovimientoEmpleado`, `guardarMovEmp`, `eliminarMovEmp`; los no financieros usan el comando de cuenta/movimiento. |
| Gastos | `_crearGastoSinDuplicar` (32563), `_guardarGastoCompletoAtomico` (44882), `_eliminarGastoAtomico` (44988), cambios de estado (44185), gastos fijos (43760), recurrencias (46412+). |
| Pagos/lotes/auditoría | `_registrarPagosGastosAtomico` (45753), `_svCargaOperacion__persistirAjustePagoGasto` (46017), sincronización CTA por pago (45724) y medio (44794). Lote/auditoría entran en el mismo guardado. |
| Comisiones/mantenimiento | `_generarComisionVentaAtomica` (45638), `commissions.js:450,489`, `_migrarPagablesLegacyAGastos` (43440), `maintenance.js` (330,395,426,532+). Son acciones explícitas; no se invocaron. |
| Helpers dinámicos/importación | Las primitivas de escritura anteriores y el detector de ancestros son la barrera común. Un reemplazo de `sisventas` no es una vía de importación admitida por el transporte. |

La web anterior puede conservar SDK sin envoltura, hashes de originales o operaciones que ahora requieren comando. Las reglas fenced y las lecturas saneadas deben hacer que fallen cerradas, no que creen vistas falsas. Eso exige publicar web compatible y probar permisos/cancelaciones; **no** autoriza relajar reglas para que pase un cliente viejo. Una pestaña anterior no es un escritor ADC y su FCM o Service Worker no le concede el token del guard.

## Fiscal, `testTFApp`, Asistente y eventos

`cloud-functions/emitir-factura/labor-bridge.cjs:125-131` elige `vendor/labor` si existe su `manifest.json`; no usa `LABOR_SCOPED_ENABLED`. Siempre construye un guard y respeta `LABOR_SCOPED_READ_ONLY`. El closure empaquetado debe poder cargar todas sus dependencias. Tener un guard vendored antiguo no demuestra capacidad para mantener DTOs; en este caso se revisa además qué originales puede escribir el puente.

`begin` sólo lee la venta/job para preflight. `attachment` escribe únicamente campos bajo `sisventas/ventas/{venta}`: factura, nota de crédito, historial/audit y referencia de emisión (`labor-bridge.cjs:35-64`). Las reservas/resultados se guardan en `sv_fiscal_emissions/{id}` fuera de las seis fuentes. El handler añade actividad en `sisventas/log_actividad` (`index.js:549`). Ninguno modifica CTA, Gastos, empleados, cargos, lotes o auditoría de pagos.

Los validadores del guard no crean registros originales implícitos: `validateAdvanceDiscount`, SAC, bonus, eliminaciones y tope leen/validan el plan. El guard añade sólo deltas de sus índices, vistas derivadas, recibo y retirada del lease. En una escritura exclusiva de Ventas los arrays `changes` de Gastos/hsextra y las claves de pagos están vacíos; no hay proyección que calcular. La prueba VM con el flag de vistas habilitado confirma cero lecturas/escrituras de las seis fuentes y cero cambios de DTO al adjuntar un resultado fiscal ficticio. La VM comprueba selección del namespace vendor, no certifica una imagen fiscal desplegada ni su manifiesto remoto.

El closure candidato añade también `commercial-view-protocol` junto al hook de cuentas. Su flag independiente `commercialViews` apagado no lee ni prepara vistas comerciales; encendido observa Ventas/Presupuestos y añade sólo raíces derivadas reservadas. Esa extensión no convierte Fiscal en escritor de las seis fuentes laborales ni demuestra por sí sola que el vendor desplegado incluya el módulo. Se debe verificar la lista de empaquetado concreta antes de publicar.

`testTFApp` (`cloud-functions/emitir-factura/index.js:563-599`) autoriza y consulta `ENDPOINT_ESTADO`; no emite ni escribe esas fuentes. El resto del archivo tiene escrituras de notificaciones/push en sus propios roots, no las seis fuentes. Asistente (`cloud-functions/asistente/index.js`) consulta al proveedor y devuelve propuestas/importaciones; su única reserva RTDB identificada es `sv_server_ai_usage` (`usage-limit.cjs:8-10`). No aplica esas propuestas a Gastos ni empleados. Su autorización lee perfil/permisos/reset. No se necesita declarar a esos dos handlers escritores financieros para cubrir este delta.

`cloud-functions/commission-events/forwarder.js:10-22` valida el evento y hace POST al receptor Cotizador; no usa Admin DB. Las únicas rutas de origen aceptadas son cambios concretos de pagos/venta y un probe. La posible escritura CTA/Gastos ocurre después, en el receptor coordinado nuevo. Es necesario que `COMMISSION_EVENT_DELIVERY_URL` y todos los destinos/tags alcanzables apunten a código actualizado; no basta revisar sólo la URL principal.

## Límites externos y condición para activar

Esta auditoría prueba fuentes locales, no demuestra qué revisión atiende tráfico, qué instancias ADC siguen ejecutándose ni que no haya herramientas externas usando credenciales. La revisión y el retiro de escritores de v3.13.19 documentados en `CORTE_CIRCUITO_LABORAL_V31319.md` son antecedentes, no evidencia fresca del corte15.

Antes de poner `enabled:true` con vistas listas, el responsable del corte debe acreditar:

1. Fuente/closure nuevos en todos los escritores Cotizador que reciban tráfico, tags, eventos o llamadas internas; flags exactos comprobados. Conservar la configuración funcional ajena.
2. Cierre o contención de revisiones/instancias anteriores y solicitudes en curso. Una distribución de tráfico al100%, mínimo0, retirar un tag o esperar un timeout no prueba por sí solo drenaje ni impide un Admin SDK ya en ejecución.
3. Ningún importador, script Admin, consola/manual o servicio externo escribe las seis fuentes fuera del guard durante preparación/uso. Los scripts locales encontrados de reglas son builders; `prepare-employee-links` sólo lee y prepara un archivo. No se ejecutaron. El inventario local no acredita ausencia de otros escritores externos.
4. Preparación histórica completa con roster privilegiado, las seis instantáneas, chunks acotados, pausa/fence y CAS técnico de las vistas; verificación de fuente oculta antes de finalizar. `employee-account-view-bootstrap.js` es un planner puro, **no** un endpoint/aplicador ni una automigración al importar. El guard público reserva el root derivado: no utilizarlo como payload de cliente para preparar.
5. Cobertura lista independiente de RR. HH./cargos y companions. Sólo un alta de empleado cuyo original, CTA y envelope anteriores sean nulos puede inicializar cuenta vacía usando cobertura global ya verificada; no se promueve una cuenta parcial/orfandad existente.
6. Reglas exactas de lectura y escritura probadas y web compatible. Una fila lista no sustituye cobertura global; el lector no debe llamar historia completa a una proyección parcial.

Si falta alguna prueba, las vistas permanecen en cuarentena/deshabilitadas. No se cambia el original financiero ni se regenera una comisión para completar el transporte.

## Evidencia local reproducible

- `node --test test/employee-account-writer-coverage.test.cjs`:11/11, sin red/ADC/proveedor. Incluye las seis fuentes en el mismo PATCH, selección insegura cuando falta el flag acotado, VM fiscal con flag activo, revisión estática de Asistente/testTFApp y enlace mensual al mismo guard.
- Bloque previo propio:471/471 sin skips; pruebas financieras, permisos, concurrencia, recuperación y lectores con DTO real. La evaluación de64 expresiones de reglas usó snapshots ficticios del respaldo exacto; no se presenta como emulador.
- `node --test test/employee-monthly-payroll.test.cjs`:35/35 al checkpoint mensual, con guard/modelo/delta reales. Incluye preview sin escritura, registro y bono inline, paridad con el cálculo activo de adelantos, pagos en cualquiera de los tres espejos, revisión/permiso/reset/lease, preservación de bonus e historia, rechazo de vínculos ajenos/colisiones y recuperación de ACK sin duplicación. El bloque focal ampliado de22 archivos dio533/533 sin skips; no valida operaciones reales ni reemplaza la puerta final.
- Este documento no acredita producción actual, factura, ausencia de todo automatismo, cierre de IAM ni migración aplicada. El manifiesto privado registra hashes del modelo/planner/guard y los límites de empaquetado.
