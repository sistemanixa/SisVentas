# Reducir la transacción laboral sin perder coherencia

Continuación local13.4, posterior a la publicación13.3: se retira la migración pasiva de Comisiones y se conserva consulta explícita del histórico por empleado. No cambia las cuatro transacciones de raíz. Nueve pruebas de contrato privadas con el código real y datos ficticios confirman que devolver sólo un recibo o mezclar snapshots perdería validaciones de empleados inactivos, gastos ausentes/duplicados, solicitudes rechazadas, miembros y pagos concurrentes. No se aplicaron esos atajos, no se migraron registros ni se ejecutaron operaciones reales. El cierre de escritores y el corte descritos aquí siguen pendientes; el inventario que sigue corresponde a su fuente histórica.

Inventario local sobre la fuente `518425db`, aplicación activa `js/app.v3.13.0.js`, 18/10/2026. Complementa el pendiente de transacción raíz de [AUDITORIA_COHERENCIA.md](AUDITORIA_COHERENCIA.md) y [CONTROL_COSTOS.md](CONTROL_COSTOS.md). Es diseño previo al siguiente bloque: no crea servicios, no aplica reglas, no migra registros y no acredita el estado externo de una publicación en curso. Las búsquedas cubrieron aplicación activa, módulos cargados, Cotizador, funciones separadas y herramientas versionadas; las referencias de línea son orientativas de esa fuente. No es una declaración de exhaustividad de clientes instalados, código antiguo, herramientas privadas ni configuración remota.

## Resultado del inventario

Las cuatro operaciones del servidor comparten `createRootTransaction` de `cotizador/labor-transaction.js`, conectado en `cotizador/index.js:53`. La unidad condicional actual es `sisventas`: GET completo con ETag y PUT completo con `if-match`, hasta cinco intentos. Un conflicto devuelve datos y ETag vigentes que ya se reutilizan. El tamaño aproximado de 96 MB proviene del contexto previo; en este inventario no se descargó ni se volvió a medir la base.

`control.UNCHANGED` evita el PUT de tres reenvíos ya confirmados, después de sus comprobaciones existentes. No evita el GET ni reduce la unidad de las operaciones nuevas. Redistribuir conserva su escritura original. No debe estimarse ahorro monetario a partir de los PUT omitidos: la descarga inicial persiste y el cuerpo de éxito anterior ya se cancelaba.

El motivo de usar un ancestro común es comprobar y modificar registros en ramas distintas. Sustituirlo por lecturas puntuales y un PATCH conserva una escritura conjunta, pero pierde la condición sobre lo leído. RTDB no ofrece `if-match` con PATCH; véase la [referencia oficial REST](https://firebase.google.com/docs/reference/rest/database/#section-conditional-requests). Una reserva que sólo respetan estos cuatro endpoints tampoco excluye a los demás escritores inventariados.

## Lecturas y escrituras de las cuatro operaciones

Las rutas de esta tabla son relativas a `sisventas`, salvo las de autorización indicadas después.

| Archivo y función | Entrada | Lecturas que deciden el resultado | Escritura y condición que debe permanecer conjunta |
| --- | --- | --- | --- |
| `cotizador/labor-submissions.js`, `submit`, líneas 33–52 | `/laboral/solicitar-horas` | `empleados/{emp}`: existencia, activo y nombre. Todas las solicitudes: localizar cualquier `aportes/{aporteId}` y encontrar una pendiente del mismo empleado/mes. Se conservan aportes y detalles históricos. | Un solo grupo pendiente recibe el aporte, detalle consolidado, horas y observaciones. Repetir el ID exige mismo empleado, mes, UID cuando consta, detalle y observaciones. Dos aportes concurrentes no pueden perderse ni abrir dos grupos nuevos. |
| `cotizador/labor-operations.js`, `approve`, líneas 14–43 | `/laboral/aprobar-horas` | Solicitudes exactas, estado y vínculo; búsqueda histórica por `gastos/*/legacyKey` en aprobación individual; gasto de destino; empleado activo/cargo; `config/cargos/{cargo}/valorHoraExtra`. | Se crea el gasto y se aprueban todas las solicitudes seleccionadas con el mismo vínculo. Aprobaciones solapadas, cambio de tarifa o rechazo deben provocar conflicto. Repetir una aprobación completa conserva autor, instante e importes. |
| `cotizador/personal-expenses.js`, `submit`, línea 5 | `/laboral/solicitar-gasto` | Empleado activo/nombre y firma de TODOS los gastos, incluidos los históricos con claves aleatorias. | Alta determinista y comprobación de firma/UID. Un gasto de otro actor no se convierte en propio. La firma usa fecha, descripción, centavos, tipo, categoría, proveedor, `empleadoId`, medio, comprobante y vencimiento; no incluye estado de pago ni foto. Este flujo es un gasto laboral/reembolso, separado de las finanzas privadas del titular. |
| `cotizador/commission-operations.js`, `redistribute`, líneas 6–18 | `/comisiones/redistribuir` | TODOS los gastos de la clave de grupo, su comparación completa, estados/pagos, movimientos `ctaemp/{emp}/{mov}` vinculados por `legacyKey`, y `config/maxComisionPct`. | Actualiza porcentajes/importes y movimientos juntos. No altera participaciones pagadas/parciales. Un cambio de miembro, pago, rechazo, aprobación, movimiento o máximo no puede pasar inadvertido. La ganancia sale del gasto/movimiento vigente, no de un importe del navegador. |

La autorización se efectúa antes de esta transacción: `businessAuth` verifica token revocado y `sv_access_resets`; los servicios consultan `sv_chat_roles`, `sv_permisos` y, en cargas propias, `sv_usuarios` por UID. Estos nodos ya están fuera de `sisventas`: el PUT raíz actual **no** hace atómica la revocación de permisos con la operación. Una sustitución debe conservar esas comprobaciones y sus barreras de sesión, sin atribuirle una garantía de permisos que el circuito actual no tiene.

## Escritores que deben incorporarse al protocolo de concurrencia

Mapa de los puntos de persistencia identificados en la aplicación activa y en los módulos que carga `index.html`. Las funciones de presentación que sólo modifican memoria no son escritores. En Comisiones, construir un objeto `updates` no equivale a enviarlo: `guardarDistribucionComision` termina en el endpoint del servidor.

### Personal, cargos y solicitudes

| Archivo / función / referencia | Rama y mecanismo | Relación con la transacción |
| --- | --- | --- |
| `js/app.v3.13.0.js`, `guardarNuevoGenerico`, rama `empleado`, 29320/29331 | UPDATE de ficha existente o PUSH de `empleados`. Cambia nombre, cargoId y activo, entre otros datos. | Puede invalidar una carga/aprobación. Una copia diferida del estado activo/cargo en otro dominio permitiría aprobar con una versión vieja. |
| Mismo archivo, `confirmarEstadoEmpleado`, 40749/40777; `eliminarEmpleado`, 41321/41333 | Baja/reactivación de `empleados/{id}` con historial; eliminación de la ficha. | Deben coordinar existencia y habilitación del empleado. `adjuntarDocumentoBajaEmpleado`, 40791/40811, cambia historial de la misma ficha; el adjunto está en `sv_rrhh_adjuntos`, fuera de la raíz. |
| Mismo archivo, `_cargoGuardarSeguro`, 25263–25279; `cargosGuardar`, `cargosGuardarValoresAtomico`, `cargosEliminar`, 25402 | Transacción de `config/cargos/{id}`, con historial; eliminación del cargo. | La tarifa aplicada a la aprobación debe provenir de la misma revisión confirmada. `js/modules/configuration-mobile.js:102` delega en el mismo guardado; no es otra autoridad. |
| Mismo archivo, `guardarMaxComisionPct`, 53883 | SET de `config/maxComisionPct`. | Cambia el límite usado por redistribución. |
| Mismo archivo, `rechazarGrupoHsExtra`, 5020; `rechazarHsExtra`, 5059 | Transacción de toda `hsextra_solicitudes` para el grupo; UPDATE directo del registro individual. | Compiten con aprobación y aportes. El rechazo individual actual es una escritura directa, no una reserva compartida con el servidor. |

### Gastos, cuentas y generación de comisiones

| Archivo / función / referencia | Rama y mecanismo | Participación obligatoria en el corte |
| --- | --- | --- |
| `js/app.v3.13.0.js`, `confirmarRegistroHaberes` / `_svCargaOperacion_confirmarRegistroHaberes`, 4382–4536 | Lee haberes/cuentas y hace UPDATE multipath de `gastos`, `haberes`, `ctaemp`, adelantos y compensaciones. `_normalizarAdelantoLegacyAlAplicar`, 4316, también crea gasto/pago de adelanto. | El cierre del dominio incluye `haberes` y compensaciones, no sólo horas/comisiones. Claves deterministas evitan dos IDs nuevos; por sí solas no validan una base concurrente ni impiden sobrescribir un registro ya pagado. |
| Mismo archivo, `aplicarAdelantosAlHaberActual`, 32160–32219 | UPDATE multipath de sueldo en cuenta, gasto, haberes y adelantos compensados. | No separar la compensación del sueldo/gasto. Validar pago y saldo vigentes. |
| Mismo archivo, `_guardarAguinaldosAtomico`, 5341; `js/modules/payroll.js`, `confirmarRegistroAguinaldo` | Transacción de toda `gastos`, con claves de SAC y control de duplicado; lee `haberes` para el cálculo. | El módulo cargado al final llama al helper activo. Puede crear gasto laboral sin pasar por los cuatro endpoints. `payroll-duplicate-guard.js:33` contiene además una consulta de duplicados. |
| `js/app.v3.13.0.js`, `_crearGastoSinDuplicar`, 31349–31375 | Para no administradores usa el servidor; para administración lee todos los gastos y transacciona sólo `gastos/{hash}`. `guardarGastoRapido`, `guardarGastoCompleto` y la rama `gasto` de `guardarNuevoGenerico` lo llaman. | Todo alta/edición/baja que cambie la firma debe mantener el futuro índice, incluso si el gasto no se llama hora extra o comisión. El gasto completo puede además crear movimiento de cuenta. |
| Mismo archivo, `_guardarMovimientoEmpleado`, 32650; `guardarMovEmp`, 32704 | PUSH de `ctaemp/{emp}`, más creación posterior de gasto en las ramas adelanto/empresa. Puede guardar reglas en `gastos_periodicos_emp`. | No permitir que un escritor antiguo cree un movimiento/gasto fuera de la autoridad nueva. |
| Mismo archivo, `_crearGastoAdelantoDesdeMovimiento`, 32606; `_crearGastoEmpresaDesdeMovimiento`, 32667 | SET de gasto y UPDATE posterior de su movimiento. | Dos etapas actuales: la migración debe conservar/reconocer estados parciales, no presentar una proyección incompleta como confirmada. |
| Mismo archivo, `_crearGastoComisionDesdeMovimiento`, 32815; `sincronizarComisionesLegacyConModulo`, 32879 | Lee gastos y cuentas; crea gasto, vincula y marca movimiento migrado. | Puede añadir un miembro a un grupo mientras se redistribuye. También se invoca al entrar a Comisiones desde `js/modules/commissions.js:153`. No equivale a una consulta pura. |
| Mismo archivo, `aprobarComision`, 32906; `rechazarComision`, 32929; `aprobarMovEmp`, 32967; `confirmarAprobacionAdelanto`, 33000 | UPDATE de movimiento y, según rama, creación/sincronización posterior de gasto. | Los estados de ambas representaciones deben participar del control de conflictos. |
| Mismo archivo, `eliminarMovEmp`, 33064; `_guardarEdicionGastoAdelanto`, 43117; `_eliminarAdelantoGastoVinculado`, 43143 | Edición, traslado de cuenta o eliminación; operaciones vinculadas incluyen `auditoria_pagos`. | Mantener el vínculo y auditoría como parte de la operación; conservar pagos/compensaciones que impidan el cambio. |
| Mismo archivo, `guardarGastoCompleto`, 43155; `guardarNuevoGenerico`, rama `gasto`, 29340; `eliminarRegistro`, rama `gastos`, 41082 | UPDATE/alta de gasto, eliminación genérica o ruta vinculada; comprobantes en `gastos_adjuntos`. | La edición puede cambiar empleado, firma, vínculo y datos comparados por redistribución. No basta interceptar los botones del módulo Comisiones. |
| Mismo archivo, `_guardarBonificacionEmpleadoAtomica`, 43346; `_eliminarBonificacionGastoVinculada`, 41062 | UPDATE multipath de gasto y cuenta; usa clave de operación. | También ocupa las ramas canónicas aunque no invoque transacción REST raíz. UPDATE multipath por sí solo no es comparación de versión. |
| Mismo archivo, `aprobarGastoSolicitado`, 42473; `aprobarComisionDesdeGasto`, 42641; `rechazarComisionDesdeGasto`, 42657 | Gasto y movimiento se actualizan mediante promesas/etapas separadas. | Un pago/aprobación/rechazo concurrente debe invalidar el reparto pendiente; no copiar un estado antiguo sobre uno pagado. |
| `js/modules/commissions.js`, `agregarParticipanteComision`, 332; `rehabilitarComision`, 347 | Agregar delega en `_generarComisionVentaAtomica`; rehabilitar hace UPDATE multipath de gasto/cuenta. | La lista de miembros y su revisión deben cambiar en el mismo commit que estos registros. |
| `js/app.v3.13.0.js`, `guardarComisionManualVenta`, 43590; `_generarComisionVentaAtomica`, 43672 | Reserva en `comisiones_generacion/{movKey}` y UPDATE multipath de gasto/cuenta/control y `ventas/{id}/comisionesGeneradas`. | El control manual y el automático deben seguir excluyéndose. No reutilizar una reserva de servidor ni tratar un lease vencido como permiso para sobrescribir. |
| `cotizador/commission-generation.js`, `load`, `generate`, `ensure`, líneas 24–85 | Plan/lease en `sv_commission_generation`; controles en `comisiones_generacion`; transacciones create-only de gasto/cuenta; revisión de venta y auditoría. | Es otro escritor del grupo. Ya evita raíz; una migración debe adaptar sus destinos y registro de miembros sin volver a generar históricos. Su recuperación admite proyecciones parciales y no ofrece atomicidad global entre colecciones. |
| `cotizador/commission-event.js`, `handle`, 30–74; `commission-job-events.js` | Reserva/resultado de eventos en `sv_commission_events`; delega generación/reintento. | La entrega duplicada y el reintento deben mantener las mismas claves/planes. No hay que crear nuevos eventos por copiar históricos. |
| `js/app.v3.13.0.js`, `_registrarPagoGastoUnitario`, 43744; `_actualizarCtaEmpPorPagoGasto`, 43715 | Primero transacción del gasto/pago; luego UPDATE de la cuenta. `confirmarPagoGasto`, 43800, puede registrar varios y un lote en `pagos_realizados`. | Una comisión pagada/parcial deja de ser editable. Debe conservarse esa frontera con pagos concurrentes y detectar un movimiento que quedó pendiente de proyectar. El lote actual no es una transacción global de todos los pagos. |
| Mismo archivo, `_persistirAjustePagoGasto` / `_svCargaOperacion__persistirAjustePagoGasto`, 43975; `sincronizarMedioPagoCuentaEmpleado`, 43072 | Cambia historial/total/estado del gasto y la cuenta; crea `auditoria_pagos` y puede añadir ajustes a `pagos_realizados`. | Estos datos de auditoría/lote amplían el conjunto del commit cuando se muda la autoridad del pago. El resumen se prepara desde la vista actual: una migración debe comprobar su revisión, no sólo repetir el PATCH. |
| Mismo archivo, `generarGastosFijosMesSeguro`, 42112; `cambiarEstadoGastoRecurrente`, 44341; `editarReglaGastoRecurrente`, 44358; `eliminarReglaGastoRecurrente`, 44391 | Altas/ediciones de gastos y reglas `gastos_periodicos_emp`. | Puede crear gastos de personal y alterar registros completos comparados por otros flujos. Debe actualizar identidad/revisión al entrar al dominio. |

### Compatibilidad, mantenimiento y herramientas operativas

| Archivo / función | Lectura/escritura que afecta el dominio | Tratamiento necesario |
| --- | --- | --- |
| `js/app.v3.13.0.js`, `_migrarPagablesLegacyAGastos`, 41802 | Lee SAC, solicitudes y cuentas; crea/repara gastos y marca vínculos en dos etapas. | Mantener como migración explícita. No permitir que una sesión vieja vuelva a poblar la fuente heredada después del corte. |
| `js/modules/maintenance.js`, `mntMigrarLegacy`, 248; `mntLimpiarLegacy`, 456 | Ejecuta los migradores; limpia solicitudes aprobadas y movimientos antiguos de horas/SAC; escribe marcas de migración. | Conservar recibos de idempotencia y referencias aun si se archiva una vista antigua. El borrado de solicitudes no debe habilitar presentar de nuevo un aporte histórico. No ejecutar estas acciones como prueba. |
| Mismo módulo, `mntEliminarDuplicadosGastosFijos`, 356; `mntMigrarFechasGastos`, 429 | Eliminación de gastos y modificación de fecha/imputación con auditoría. | También alteran firmas, revisiones y referencias. No autoriza borrar históricos para simplificar la migración. |
| `js/modules/payroll-legacy-migration.js`, wrapper de `eliminarRegistro` | Sólo la rama sintética `aguinaldo_recuperado__...` borra `aguinaldos/{emp}/{sem}`; su wrapper de carga consulta SAC. | Diferenciar marca antigua de gasto real; `payroll.js` posterior reemplaza el filtrado de Gastos por gastos reales. No contar un registro sintético como gasto confirmado. |
| `scripts/migrar-adjuntos-gastos.ps1`, ramas `Apply`/`Restore` | Mueve/restaura fotografías y comprobantes entre `gastos` y `gastos_adjuntos`, mediante PATCH. | Es herramienta operativa con capacidad remota, no parte automática del arranque. No ejecutada aquí. Debe adaptarse o retirarse del protocolo de escritura antes de un corte. Mover adjuntos entre hijos de `sisventas` no reduce el GET de ese ancestro. |
| `js/modules/offline-core.js`, wrappers y `sync` | Modo opcional: bloquea cola offline de `gastos`, `ctaemp`, `hsextra_solicitudes`; online delega en las funciones originales. | No es otro generador financiero offline. Mantener bloqueo y barrera de sesión; no habilitar replay sobre la ruta canónica nueva por omisión. |

Las funciones heredadas todavía referenciadas por módulos/UI se incluyeron aunque no sean el camino normal de alta. No se presupone que una regla remota permita cada llamada: éste es un mapa de capacidades del código, sin inventario remoto nuevo. Herramientas privadas, revisiones antiguas accesibles por etiquetas, clientes instalados y scripts fuera de Git deben verificarse específicamente antes del corte; el código local no puede demostrar que ya dejaron de escribir.

## Lectores y consumidores a adaptar

Estos son los puntos de entrada de datos y sus consumidores que afectan la confirmación, deduplicación o presentación financiera. Cambiar sólo un render no sustituye la fuente.

| Archivo / función | Rama o fuente leída | Contrato que debe conservarse |
| --- | --- | --- |
| `js/app.v3.13.0.js`, `svEscucharDirectorioEmpleados`, 3975; `editarEmpleado`, 40885; `cargarCargos`, 25058 | Empleados/cargos directos con permiso; directorio protegido alternativo. | El usuario propio conserva su ficha/tarifa autorizada; otros reciben campos permitidos. `cotizador/employee-directory.js`, `read`, compone ambas ramas y el vínculo protegido del perfil. |
| Mismo archivo, `abrirPanelAprobacionHsExtra`, 4939; `aprobarHsExtra`, 5038; `actualizarBadgeHsExtraPendientes`, 5086 | Solicitudes completas o individual. | Mostrar pendientes y monto de revisión coherentes con el servidor; no convertir el badge en autoridad financiera. El panel legacy anterior conserva una consulta del mismo dominio. |
| Mismo archivo, `cargarCtaEmp`, 31694; `renderDashMiCuenta`, 50304 | Cuenta por empleado; solicitudes para historial propio; combina gastos de ese empleado. | Evitar duplicar una obligación al combinar cuenta y gasto. Mantener mes trabajado/imputado, saldo, permisos y contexto propio. |
| Mismo archivo, `_svSuscribirGastos`, 41977; `fbCargarGastos`, 41998 | Gastos globales por permiso o consultas `empleadoId`/`empleadoFbKey`. | Es el ingreso a `gastosData`: informa readiness, error y sesión; alimenta Gastos, Cuenta empleado, Dashboard, Reportes, Tesorería, Rentabilidad y tarjetas de comisionados. Una sustitución por API debe integrarse con `SVDataReadiness` y no volver a dibujar todo ante resultados iguales. |
| Mismo archivo, `_crearGastoSinDuplicar`, `_crearGastoComisionDesdeMovimiento`, `_ventaTieneComisionGenerada`, `_movimientosVinculadosGasto` | Gastos históricos y cuentas por empleado, controles/vínculos. | Las búsquedas de identidad/legacy no se sustituyen por memoria incompleta de pantalla. Resolver por índices canónicos comprobados. |
| `js/modules/commissions.js`, `grupos`, `cargarMovimiento`, `abrirDetalleComision`, `pintarDetalle`, `comprobarDetalleAbierto` | `gastosData`, movimiento puntual, venta de referencia, empleados/configuración. | Grupos y estados completos; impedir guardar una ficha vieja. La venta sirve para el detalle/base original y no autoriza recalcular una comisión histórica. |
| `cotizador/commission-generation.js`, `readEmployees`/`load`; `commission-event.js`, `handle` | Venta, cobros y configuración; gastos por venta/alias; cuentas y controles. | Generación nueva y recuperación sólo desde plan verificado; conservar aliases y costos originales. No copiar ventas/cobros completos al nuevo dominio sólo para el reparto. |
| `js/modules/treasury.js`, `_tesoreriaPagos` | `gastosData`, `movsEmpData`, historial de pagos y lotes. | Una sola fuente por gasto vinculado; misma suma/estado y comprobantes; no contar dos veces una proyección. |
| `js/modules/employee-cash-receipt.js`, `read`/`preview` | Gasto exacto/pago y empleado de directorio. | Recibo de efectivo basado en pago confirmado, con misma identidad y centavos. |
| `js/modules/payroll.js`, `confirmarRegistroAguinaldo`; `maintenance.js`, `mntAnalizarBase`, `mntVerificarIntegridad`, auditorías | Haberes, gastos, solicitudes, cuentas y marcas antiguas. | La vista de mantenimiento debe distinguir legado, datos canónicos y proyección. No declarar integridad por sólo existir una marca o un puntero. |
| `js/v3/domain-store.js`, `legacy-snapshot.js`; `js/modules/v2-audit.js` | Modelos/memoria de empleados y cuentas usados para relaciones e integridad. | Adaptar los adaptadores además del origen remoto; preservar claves existentes. |

## Conjunto canónico mínimo propuesto

Es un mínimo lógico de autoridad, no la instrucción de copiar una carpeta ni una autorización de migración. Las colecciones existentes mezclan conceptos y tienen relaciones hacia pagos/haberes; por eso hay dos perímetros distintos.

### 1. Datos necesarios para las cuatro decisiones actuales

| Pieza propuesta | Contenido mínimo / índice | Por qué debe ser autoritativa |
| --- | --- | --- |
| Empleado laboral | Clave original, existencia, activo, cargoId, nombre y revisión. Separar documentos/fotos/historial pesado. | Carga/aprobación comprueban el estado vigente, no una copia que puede llegar después. |
| Cargo/tope | Tarifa de hora extra y máximo de comisión, con revisión; valores/fallbacks actuales explícitos. | Un cambio concurrente debe invalidar el cálculo revisado. Cargos históricos aplicados se conservan en la operación y no se recalculan. |
| Solicitudes | Registros completos, aportes, estados, vínculos y revisiones. | La aprobación y el aporte concurrentes compiten sobre la misma autoridad. |
| Recibos de aporte | ID/digest normalizado, UID cuando consta, solicitud de destino y resultado. | Sustituye el barrido global por aporteId y sigue existiendo al archivar una solicitud. No atribuir UID nuevo a aportes antiguos sin autor. |
| Grupo abierto empleado/mes | Referencia a solicitud pendiente y revisión de membresía. | Hace condicional la creación de un nuevo grupo. Múltiples pendientes históricos se detectan para conciliación; no se suman automáticamente. |
| Gastos laborales y comisiones | Registros con todos los estados, importes, pagos, base original, aprobación y claves/vínculos; incluir comisiones sin empleado identificable y gastos/reembolsos de empleado aunque no tengan tipoPagable. | No filtrar sólo por empleado activo o por categorías modernas. `registroComparable` actual compara todo el registro salvo claves de vista: la revisión nueva debe reflejar cualquier edición relevante, incluidos vínculos/adjuntos. |
| Índice de identidad de gasto | Firma actual → clave(s) original(es), actor conocido y revisión. Debe cubrir el universo histórico que participa en la comparación, no sólo altas del endpoint. | Una creación/edición/baja desde administración debe mantenerlo en el mismo commit. Conservar colisiones/ambigüedades para revisión. |
| Índice legacy y de vínculos | `legacyKey` → gasto original; gasto → movimientos y viceversa; referencias de solicitud/grupo. | Evita barridos y conserva las claves históricas sin renombrarlas ni crear otro gasto. |
| Grupo de comisión | Clave canónica, aliases existentes, miembros y revisión. | Detecta altas/bajas concurrentes; leer sólo los gastos seleccionados no detecta un participante nuevo. No fusionar ventas históricas ambiguas. |
| Movimientos vinculados | Registro original, pagos/estado/base y revisión. | Reparto, aprobación y pago deben ver la misma versión. No reemplazar movimientos pagados para reparar una proyección. |

Un adjunto separado puede quedar fuera del conjunto financiero si su referencia/revisión se mantiene con la operación y la lectura sigue protegida. No basta moverlo de `gastos` a `gastos_adjuntos` dentro del mismo ancestro que se descarga. Las finanzas privadas del titular y los documentos RR. HH. privados permanecen en sus dominios propios.

### 2. Cierre necesario de los escritores que ya comparten esos registros

Si la nueva autoridad también reemplaza los destinos `gastos`/`ctaemp`, las operaciones de las tablas anteriores exigen incluir, o rediseñar explícitamente sin perder su confirmación, los siguientes datos:

- Haberes por empleado/mes y sus compensaciones, porque hoy se escriben juntos con gasto/cuenta.
- Recibos de operación y controles de generación manual/automática, para mantener exclusión, recuperación y no duplicación.
- Auditoría de cambios de pago/adelanto y referencias de lote: hoy hay escrituras multipath que los conservan junto al cambio financiero. No sustituirlas por una promesa posterior sin reconocer el cambio de garantía.
- Regla de recurrencia y estado de emisión cuando crean gastos de personal, o un comando autoritativo con recibo que incluya la creación.
- Referencia de generación en la venta y su auditoría: puede derivarse de un outbox confirmado, pero los lectores deben reconocer el estado pendiente de proyección. No llamar a esto una transacción global entre almacenes.

Catálogo, proveedores, fotos, documentos completos de ventas/presupuestos y chat no forman parte de las cuatro decisiones. La generación automática usa una venta/cobros y configuración original por separado: conservar su validación/plan/corte, sin convertir esa separación actual en una garantía global nueva ni hacer backfill.

## Alternativas y recursos

**Alternativa A, mantener RTDB:** crear un ancestro canónico laboral separado de `sisventas` que contenga el cierre financiero anterior, con índices y revisiones. Reutiliza RTDB/Cloud Run, pero exige schema, reglas y un corte de todos los escritores afectados; no se resuelve con cambiar la URL del helper. La transacción seguiría leyendo todo ese dominio y su historial. Antes de elegirla hacen falta distribución de bytes por rama, crecimiento y contención medidos de forma autorizada, sin registrar valores privados. Sin esos datos no se puede prometer una reducción suficiente ni un costo mensual.

**Alternativa B, transacciones por documento:** almacenar registros, recibos e índices de membresía en un almacén que permita una transacción del conjunto exacto. Por ejemplo, Firestore con documentos de empleado/configuración/solicitud/recibo/índice/gasto/movimiento/grupo. Leer también el documento de membresía evita altas que no estaban en la lista leída. Requiere acordar base/región/costo, permisos mínimos de la cuenta de servicio, bibliotecas y migración. La tarifa/estado de empleado no pueden seguir siendo una copia diferida de otra base; deben tener una autoridad y protocolo de cambio concretos. Ver [transacciones de Firestore](https://firebase.google.com/docs/firestore/manage-data/transactions).

Una tercera técnica, PATCH con reglas que validen versiones y guardas de todas las dependencias, requiere que **todos** los escritores mantengan revisiones y que la identidad del servicio no omita esas reglas. Admin SDK normalmente las omite. No se considera un reemplazo local seguro mientras haya escritores directos/administradores fuera de ese protocolo; además hay que cubrir borrados, membresía y fuentes que sólo se leen.

## Carreras que deben reproducirse antes del corte

| Caso ficticio | Resultado exigido |
| --- | --- |
| Dos aportes al mismo empleado/mes; repetición del mismo aporte; mismo ID con otro payload/actor | Conservar ambos aportes distintos; una sola confirmación del repetido; conflicto ante reutilización incompatible. |
| Aporte mientras se aprueba o rechaza el grupo; dos aprobaciones con claves superpuestas | Cada solicitud queda en un estado coherente, sin horas ni gastos perdidos; ningún gasto duplicado. |
| Baja/cambio de cargo/tarifa entre revisión y confirmación | Releer y rechazar el cálculo obsoleto; no confirmar por una copia atrasada. |
| Añadir/quitar/rehabilitar participante durante redistribución | Cambia la revisión de membresía; reparto antiguo rechazado, incluso si sus registros individuales siguen iguales. |
| Pago parcial/total, corrección/anulación de pago o aprobación durante redistribución | La parte ya pagada se conserva; ningún estado o total antiguo reemplaza la versión vigente. |
| Alta administrativa, edición de firma/empleado y migración legacy simultáneas con solicitar-gasto | Índice de identidad completo y condicional; sin doble registro ni apropiación de otro actor. |
| Generación manual, automática, evento repetido, lease vencido y reinicio entre destinos | Un único plan/recibo; misma identidad y costos originales; colisión ajena detiene para conciliación; nunca recalcular una comisión existente. |
| Pago/compensación de adelanto y registro de haber solapados | Sin doble compensación ni sobrescritura de sueldo ya abonado; gasto/cuenta/haber coherentes con su auditoría. |
| Cliente antiguo o mantenimiento intenta escribir en la rama heredada después del corte | Rechazo verificable o adaptación explícita; ninguna doble autoridad silenciosa. |
| Falla luego del commit y antes de la respuesta/proyección, reintento y cambio de usuario | Recibo estable; ningún duplicado; proyección pendiente identificada y recuperación acotada; actor/sesión conservados. |

Las ocho pruebas nuevas `test/labor-transaction-idempotent.test.cjs`, los tests de operaciones/submissions/gastos/comisiones y las cuatro integraciones `test/labor-server.integration.cjs` verifican el circuito actual y el PUT omitido. No verifican una migración todavía inexistente, el cierre de todos los escritores ni un costo aceptable.

## Siguiente bloque concreto, todavía sin ejecutar

1. Elegir una autoridad y validar con fixtures el conjunto exacto e índices anteriores. Resolver casos históricos ambiguos como revisión; no arreglarlos por aproximación.
2. Preparar adaptadores de lectura y comandos para **todos** los escritores de este mapa; integrar readiness/error/cancelación/sesión. Mantener las rutas viejas sólo como compatibilidad controlada. Inventariar clientes instalados, etiquetas y herramientas privadas antes de afirmar que no quedan escritores heredados.
3. Probar las carreras y cortes parciales en emuladores/datos ficticios; comprobar conservación de claves, autoría, fechas, precios/bases, pagos y comisiones. Medir bytes, reposo y reintentos sin sondeos de reloj nuevos.
4. Con autorización específica de infraestructura/reglas/migración: respaldo verificado, copia con comparación por claves/revisiones/hashes, ventana breve de exclusión de escrituras, activación y comprobación. Las proyecciones no son editables ni autoridad de confirmación. Un push o deploy de código no acredita ese corte.
5. Definir reversión de código/lecturas y recuperación de operaciones confirmadas. No restaurar toda la base, borrar comisiones ni permitir dos escritores autoritativos para volver atrás.

La preparación puede avanzar localmente. La eliminación del GET/PUT de raíz en operaciones nuevas sigue pendiente hasta completar y verificar ese corte.
