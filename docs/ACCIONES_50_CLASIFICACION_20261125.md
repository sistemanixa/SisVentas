> Estado final: integrado y publicado en v3.21.15. Los adjuntos se cerraron con b6ab8c5f y forman parte de la suite completa verde; la asignación pendiente que describe el inventario original quedó resuelta.

# Cierre de los 50 candidatos de acciones — 25/11/2026

Inventario estático completo de los 50 candidatos del análisis previo. No significa cobertura universal de los 1171 atributos ni de todos los callbacks: quedan alias dinámicos y eventos que el principal está adaptando. Las tres funciones de imágenes están asignadas al agente3, NO acreditadas por este bloque.

Composición: primero overlay63e0b9de `active-action-feedback-overlay.apply(source)`, después `active-action-feedback-remainder-overlay.apply(source)`, sobre NUEVA app. Son conjuntos disjuntos. El segundo permite aplicación idempotente exacta; cambios desconocidos fallan cerrados. `applyModule('js/modules/ot-workflow.js', source)` produce el módulo nuevo sin editarlo aquí. Ningún archivo inmutable, index/sw ni histórico de negocio modificado.

29 funciones app (28 candidatas y dependencia guardarGarantia), una función módulo. Contraste de hashes originales sobre app13 raíz: PASS. No cambia rutas, protocolos, CAS, permisos, journal ni escrituras; no elimina histórico. La limpieza Storage posterior a quitar firma sigue best-effort existente, independiente de confirmar la OT. GuardarNuevoGenerico conserva el cierre de modal que ya tenía: el cambio no lo adelanta ni lo retrasa; sólo devuelve el guardado real.

| # | Función / fuente | Estado | Evidencia / decisión |
|---|---|---|---|
| 1 | volverAtrasSisVentas (js/app.v3.21.12.js:24688) | Navegación síncrona | Cierra/retorna vistas y estado local; no esperar presencia ni toda la vida de la pantalla. |
| 2 | actualizarValoresPpto (js/app.v3.21.12.js:49174) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 3 | imprimirPresupuestoActual (js/app.v3.21.12.js:35188) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 4 | otCredencialBasicaGuardar (js/app.v3.21.12.js:51596) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 5 | toggleChecklistFase (js/app.v3.21.12.js:52519) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 6 | firmaLimpiar (js/app.v3.21.12.js:51149) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 7 | firmaTecnicoLimpiar (js/app.v3.21.12.js:51439) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 8 | guardarLogoEmpresa (js/app.v3.21.12.js:31987) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 9 | cambiarUsoLogoImpresion (js/app.v3.21.12.js:31503) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 10 | guardarDatosEmpresa (js/app.v3.21.12.js:32101) | Parche 63e0b9de | Retorna cadena existente; impuestos incluyen SET interno. DatosEmpresa elimina Guardado anterior a ACK. |
| 11 | guardarTipoCambio (js/app.v3.21.12.js:31154) | Tercer parche: retorno pendiente | Devuelve SET; elimina marca visual de éxito disparada antes de ACK. Payload y autorización intactos. |
| 12 | guardarPreferenciasSistema (js/app.v3.21.12.js:31282) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 13 | cargosGuardar (js/app.v3.21.12.js:26605) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 14 | guardarMaxComisionPct (js/app.v3.21.12.js:57217) | Parche 63e0b9de | Retorna cadena existente; impuestos incluyen SET interno. DatosEmpresa elimina Guardado anterior a ACK. |
| 15 | guardarAlicuotaIVA (js/app.v3.21.12.js:31339) | Parche 63e0b9de | Retorna cadena existente; impuestos incluyen SET interno. DatosEmpresa elimina Guardado anterior a ACK. |
| 16 | guardarImpuestosGenerales (js/app.v3.21.12.js:31351) | Parche 63e0b9de | Retorna cadena existente; impuestos incluyen SET interno. DatosEmpresa elimina Guardado anterior a ACK. |
| 17 | guardarConfigTFApp (js/app.v3.21.12.js:10588) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 18 | abrirModalComunicado (js/app.v3.21.12.js:55992) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 19 | spAgregarNota (js/app.v3.21.12.js:37913) | Parche 63e0b9de | Promise deduplicada por input/clave, captura reclamo, preserva borrador nuevo e historial previo. |
| 20 | abrirScannerSerie (js/app.v3.21.12.js:32837) | Permiso/cámara nativa | getUserMedia abre permiso y transmite cámara; no bloquear todo el uso de la cámara. Rechazo conserva cerrarScanner/capturarManual. |
| 21 | agregarFotosEquipo (js/core/image-attachment-standard.js:269) | Asignado agente3; entrega pendiente | image-attachment-standard: Promise.all no retornada. No modificado aquí; requiere entrega e integración del propietario antes de afirmar cobertura. |
| 22 | agregarFotosRel (js/core/image-attachment-standard.js:303) | Asignado agente3; entrega pendiente | image-attachment-standard: Promise.all no retornada. No modificado aquí; requiere entrega e integración del propietario antes de afirmar cobertura. |
| 23 | guardarRelevamiento (js/core/image-attachment-standard.js:320) | Asignado agente3; entrega pendiente | image-attachment-standard: Promise.all no retornada. No modificado aquí; requiere entrega e integración del propietario antes de afirmar cobertura. |
| 24 | eliminarClienteDesdeHistorial (js/app.v3.21.12.js:43359) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 25 | credGuardar (js/app.v3.21.12.js:54968) | Parche 63e0b9de | Retorna cadena existente; impuestos incluyen SET interno. DatosEmpresa elimina Guardado anterior a ACK. |
| 26 | cerrarDetalleProducto (js/app.v3.21.12.js:24581) | Navegación y retorno | Restaura vista/origen; consultas de los destinos conservan sus indicadores propios. |
| 27 | eliminarProductoDesdeDetalle (js/app.v3.21.12.js:24677) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 28 | guardarKit (js/app.v3.21.12.js:1388) | Parche 63e0b9de | Retorna cadena existente; impuestos incluyen SET interno. DatosEmpresa elimina Guardado anterior a ACK. |
| 29 | abrirModalHsExtra (js/app.v3.21.12.js:4698) | Selector de vista | Sólo delega navegación por permiso a panel/formulario; no escribe. |
| 30 | abrirFormGasto (js/app.v3.21.12.js:45228) | Carga propia de adjunto | Formulario se presenta inmediatamente; rama fotoAdjunta ya dice Cargando comprobante y valida gastoActualFbKey antes de pintar. No guardar/reembolsar. |
| 31 | confirmarPagoGasto (js/app.v3.21.12.js:46374) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 32 | asistGenerarPresupuesto (js/app.v3.21.12.js:42166) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 33 | guardarMovEmp (js/app.v3.21.12.js:34484) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 34 | registrarMovCaja (js/app.v3.21.12.js:32957) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 35 | guardarGastoRapido (js/app.v3.21.12.js:33063) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 36 | guardarNuevoGenerico (js/app.v3.21.12.js:30787) | Tercer parche: retorno pendiente | Captura Promise de ramas producto/empleado/gasto/proveedor/usuario/garantía sin saltar acciones posteriores; dependencia guardarGarantia también retorna escritura. |
| 37 | chatCerrar (js/app.v3.21.12.js:2989) | Presencia best-effort | Cierra ahora y elimina typing best-effort con catch; esperar esa limpieza bloquearía el cierre por presencia. |
| 38 | chatAbrirDirectos (js/app.v3.21.12.js:3506) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 39 | chatInputCambio (js/app.v3.21.12.js:2810) | Presencia best-effort | Actualiza botones y typing; timer2200ms elimina presencia, no es guardado del mensaje ni debe bloquear edición. |
| 40 | chatEnviar (js/app.v3.21.12.js:3479) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 41 | iaSugerencia (js/app.v3.21.12.js:2529) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 42 | chatAudioReproducir (js/app.v3.21.12.js:3253) | Reproducción local | play/pause con catch visible; no guardado ni espera por duración de audio. |
| 43 | abrirVisorComprobanteSistema (js/app.v3.21.12.js:46695) | Visor con indicador propio | PDF muestra Cargando PDF antes de import/mount; imagen y archivo ya presentes. Error del visor visible. No escritura. |
| 44 | spPasarAVisitaYGenerarOT (js/app.v3.21.12.js:38161) | Ya devuelve Promise + dedupe + progreso | Retorna _spOTGeneracionPorReclamo[rKey], progresoVisita hasta finally y recupera tarea previa; falso positivo de heurística. |
| 45 | guardarPeriodoVac (js/app.v3.21.12.js:42632) | Parche 63e0b9de | Retorna cadena existente; impuestos incluyen SET interno. DatosEmpresa elimina Guardado anterior a ACK. |
| 46 | otCargarCredenciales (js/app.v3.21.12.js:51628) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 47 | imprimirComprobanteVentaActual (js/app.v3.21.12.js:30097) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 48 | guardarFilaConfig (js/app.v3.21.12.js:56995) | Tercer parche: retorno pendiente | Devuelve SET; elimina marca visual de éxito disparada antes de ACK. Payload y autorización intactos. |
| 49 | guardarConfigComisionEmpleado (js/app.v3.21.12.js:57017) | Tercer parche: retorno pendiente | Devuelve operación existente, conserva validaciones, argumentos, catches, finally y rollback. |
| 50 | otWizardIniciar (js/modules/ot-workflow.js:251) | Tercer parche: módulo | applyModule sobre ot-workflow añade return a prom.then; conserva estado/audit anterior y rollback. |

Validación focal: 51/51 PASS,0skip,0cancel (15 anteriores+36 nuevas). Incluye comparación exacta de operaciones/argumentos, rechazo de fuente alterada, devolución delegada, checklist pendiente/rollback/historia/doble activación, tipoCambio hasta ACK y módulo wizard sin alterar rollback. No equivale a probar las 50 pantallas completas ni a una puerta global. El principal ejecuta composición, UI y suite total.
