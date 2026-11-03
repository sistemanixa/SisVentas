# Auditoría maestra · evidencia y cobertura

Estado: **en curso**. Base revisada `6e4f810b1e469d7c8750b3d36f8cc4893a2dad0b`, aplicación activa v3.18.12. No certifica versiones posteriores ni el despliegue remoto. No hubo cambios funcionales, publicación, modificaciones de reglas ni operaciones reales durante este bloque.

## Método y límites

La aplicación completa corre en loopback con SDK simulado, identidad ficticia y almacén en memoria. Los comandos de cobro, guardado laboral y propiedad comercial utilizan las fábricas reales del servidor. CSP y el conductor bloquean servicios externos. El fixture no aplica las reglas RTDB remotas: una aprobación local no certifica permisos de producción. Se conserva la pestaña real del titular.

Los niveles de cobertura son diferentes: apertura, formulario, persistencia nativa y circuito integrado. El recorrido de 43 pantallas no equivale a completar sus operaciones. Las pruebas unitarias complementan, no sustituyen, las pruebas de usuario. Tampoco una prueba de vista previa de Proyectos certifica su backend.

## Evidencia ejecutada

- 43 pantallas × 390/768/1280 = 129 aperturas; 27 diálogos ×3 =81; nueve editores ×3 =27. Sin excepciones JS ni desbordes en el fixture de navegación. Las escrituras de ese fixture no persisten y sus permisos son simulados: no usarlo para certificar CRUD/RBAC.
- Aplicación nativa completa: cliente ficticio → producto → cantidad2 ×$200 → descuento10% → IVA21% → PP-9001 $435,60 → PDF → venta V-009001 → cobro100 → recuperación del mismo comando → cobro335,60. Dos pagos, total435,60, saldo0; stock20 y autor original conservados. Ejecutado como administrador y administrativo autorizado en escritorio, y como administrador en390px. PDF A4 de una hoja, renderizado e inspeccionado visualmente.
- La generación posterior de comisiones todavía no está conectada al servidor RAM: su endpoint devuelve404. El PASS del cobro certifica persistencia financiera, no ese efecto posterior. No ocultar esta limitación ni simular una respuesta exitosa.
- Inventario: fotos, +/−, unidades/metros, cambios retenidos al buscar, guardado explícito, concurrencia, error/reintento, sesión y rechazo de administrativo no autorizado; tres anchos, cero red real.
- Proyectos:45 comprobaciones de ejecución en vista previa, notas/fotos/materiales en localStorage ficticio; privacidad del técnico en tres anchos, sin pestañas/importes comerciales ni escrituras.
- Buscador de clientes: ocho casos en venta/presupuesto, selección/scroll y tamaños extremos, sin escrituras financieras.
- Agenda: ocultar/restaurar, una reconexión por retorno, sin repintar DOM idéntico ni escuchas ocultas; cero red real.
- Relevamientos: resumen y fotos ficticias; corrección de costo de venta preserva total/pagos; Compras pagina123 órdenes y71 listas, busca fuera de la página; Comunicados excluye remitente/Distribuidora.
- Gastos: alta y edición nativas con admin/administrativo,390/1280; conserva pagos parciales y cuenta privada, rechaza edición después de revocar permiso:4PASS.
- Cobertura salarial: tres anchos,7 lecturas ficticias,0 escrituras, técnico rechazado. La prueba de caché fría/consulta mensual por índice requiere un caso separado.
- Suite vigente:7238 casos,7211PASS,27skip,0fallos, misma selección de `test-current.ps1` con concurrencia4 y Chrome/loopback permitidos. Los27skip no son aprobaciones. El primer intento dentro del sandbox produjo rechazos de navegador; las pruebas afectadas y la suite completa pasaron fuera de esa restricción.
- Aislamiento nuevo: verifica CSP, exclusión de SDK real/Service Worker/fuentes privadas, persistencia sólo RAM, rechazo de cobro sin identidad y centinelas conservados.

## Mediciones reproducibles

Un intento local de administrador: arranque483ms, abrir/seleccionar cliente516ms, producto/cálculo254ms, guardar presupuesto76ms, abrir guardado91ms, impresión224ms, convertir214ms, cobro parcial667ms. Son mediciones de un intento en HTTP local sin compresión, no SLA ni comparación con producción. El paso del último cobro incluye espera y tareas de impresión; no presentarlo como latencia exclusiva del comando.

En ese circuito se entregaron aproximadamente6,51MB de cuerpos HTTP sin compresión, principalmente estáticos; app activa3.550.176bytes, índice simulado486.007bytes y CSS285.644bytes. No son lecturas RTDB facturadas ni un costo en dólares. Para comparar ahorro real hacen falta medición comprimida/cacheada y consultas reales acotadas, autorizadas de sólo lectura. La muestra ficticia no mide el peso de datos históricos de producción.

La prueba de red lenta usa1,6Mbps y150ms de latencia con el mismo servidor local: arranque34.214ms/228 solicitudes/6.433.126bytes; guardar670ms, convertir2.372ms y cobro parcial1.054ms. Completó el circuito sin errores JS y conservó importes/stock. El primer intento se detuvo por el límite de30s del conductor; se midió después hasta60s, sin cambiar la aplicación. Conservar resultados separados por perfil y no extrapolar tiempos sin compresión a la web comprimida. Esta señal justifica revisar dependencias y carga de estáticos iniciales; no demuestra un aumento del costo RTDB.

## Matriz de módulos: circuito que debe cerrar

Todos los siguientes tuvieron prueba de apertura en tres anchos. La columna indica lo adicional verificado en este bloque; **pendiente nativo** significa que todavía no se ejecutó el circuito completo como usuario, aunque existan pruebas de código en la suite.

| Módulo | Circuito funcional exigido | Cobertura adicional / pendiente |
|---|---|---|
| Dashboard | Inicio por rol, cifras del período, navegación, retorno y conexión lenta | Agenda aislada PASS; arranque completo ficticio PASS; cifras reales no medidas |
| Nueva venta | Cliente/domicilio, productos, costos, IVA, descuento, autor, guardado/recuperación | Creación desde presupuesto PASS; alta directa pendiente nativa |
| Ventas |50 iniciales, búsqueda histórica, detalle, edición, saldos | Detalle de venta convertida PASS; histórico/paginación pendiente nativa |
| Presupuestos | Alta, borrador, revisión/aprobación, envío, PDF, conversión única | Alta/aprobación/PDF/conversión PASS; envío externo y revisión por otro usuario pendientes |
| OT | Materiales, entrega/devolución, serie, garantía, firma, cierre y estado de venta | Pruebas de idempotencia/código PASS; circuito nativo completo pendiente |
| Cobranzas | Parcial/total, moneda, recibo, reintento, adjunto y anulación | Parcial/total/replay PASS en dos roles; USD/adjunto/anulación pendientes nativos |
| Cuenta corriente | Cliente/domicilio, deuda histórica, imputación y recibos | Suite canónica PASS; integración nueva del otro chat aún separada |
| Tesorería | Filtros/período, pago, anulación y conciliación | Pendiente nativa |
| Configuración | Guardar/releer, conflictos, permisos, dólar y costos | Pendiente nativa; sin cambios reales |
| Agenda | Alta/edición/cancelación, asignación, retorno | Retorno/reconexión PASS; CRUD pendiente nativo |
| Servicios | Alta, asignación, trabajo y cierre | Pendiente nativa |
| Remitos | Crear, entregar/devolver, imprimir y evitar duplicación | Suite de operaciones PASS; pendiente nativo |
| Proveedores | Alta/edición, contacto, costos por proveedor | Pendiente nativa |
| Compras exterior | Lista/venta/stock, costos por pedido, exportación, confirmación | Apertura/editor PASS; confirmación/recepción/lotes pendientes nativos |
| Órdenes de compra | Detalle, recepción parcial/total, stock/lote, retorno | Paginación y retorno/foco PASS; recepción integrada pendiente |
| Facturas | Receptor, letra/IVA, vista previa, autorización fiscal y error incierto | Suite de integridad PASS; emisión fiscal real excluida |
| Crédito fiscal | Período, saldos/IVA y conciliación | Pendiente nativa |
| Estadísticas | Período, exclusiones y cifras conciliadas | Pendiente nativa con conjunto conocido |
| Comunicados | Destinatarios válidos, privado, lectura, edición | Directorio/privacidad PASS; envío y acuse ficticio pendientes |
| Garantías | Equipo/serie, inicio/plazo, consulta y devolución | Suite de circuito PASS; integración nativa pendiente |
| Soporte | Reclamo → visita/OT → resolución, permisos técnicos | Pendiente nativa |
| Proyectos | Planificación, presupuesto, necesidades, ejecución/fotos, materiales, cierre | Vista previa/privacidad PASS; backend integrado pendiente |
| Relevamientos | Formulario, fotos, guardar/reabrir y resumen | Resumen PASS; guardado/reapertura pendientes nativos |
| Equipos | Alta, serie/ubicación, historial/garantía | Pendiente nativa |
| Historial cliente | Todas las solapas y domicilios sin inventar vínculos | Pendiente nativa |
| Clientes | Alta/edición, domicilio, duplicados, desactivar | Buscador PASS; CRUD y roles pendientes nativos; cascada real excluida |
| Catálogo interno | Buscar/filtrar, seleccionar, moneda y enlace | Selección de producto PASS; catálogo completo pendiente |
| Productos | Alta/editar, costo canónico, proveedores, garantía y variantes | Selección/costo conservado PASS; CRUD pendiente nativo |
| Kits | Alta, componentes, cantidades y precio | Pendiente nativa |
| Actualizador precios | Previsualizar, aplicar ficticio, conflicto, progreso | Pendiente nativa; no invocar cotizador real |
| Empleados | Alta/edición, rol, salario y privacidad | Pendiente nativa |
| Usuarios | Alta/desactivar, acciones por rol, sesión/revocación | Suite de permisos PASS; ciclo nativo multiusuario pendiente |
| Reportes | Período, empleado, exportar y cifras conocidas | Pendiente nativa |
| Comisiones | Evento real, pendiente, aprobación/pago, no duplicar | Pruebas de comandos/privacidad PASS; endpoint de generación RAM pendiente |
| Gastos | Alta/editar, pago parcial/total, reembolso, baja | Alta/editar nativos PASS; comandos laborales PASS; pago desde formulario completo pendiente |
| Asistente | Consulta y selección sin alterar datos | Pendiente de simulación de integración externa |
| Vacaciones | Solicitud/aprobar, período, solapamiento y saldo | Pendiente nativa |
| Cobertura salarial | Mes seleccionado, pagado/devengado, gastos y mano de obra | Vista con caché conocida PASS; carga fría por índice pendiente |
| Rentabilidad | Ventas/costos/gastos/ganancias por mes y conciliación | Pendiente nativa con dataset contable conocido |
| Cuenta empleado | Movimientos/haberes/adelantos/comisiones por mes y privacidad | Pruebas laborales PASS; circuito nativo completo pendiente |
| Informes | Alta, fotos, guardar, reabrir y PDF | Apertura/editor PASS; persistencia/PDF pendientes nativos |
| Caja | Apertura, movimientos, cierre y diferencias | Pendiente nativa |
| Tablero | Período, métricas y concordancia con reportes | Pendiente nativa con cifras conocidas |

No olvidar superficies que no son `.page` en este fixture: **Gastos personales**, **Distribuidora**, **catálogo público/pedidos**, **chat/presencia**, **inicio de sesión/recuperación** y ventanas compartidas. Requieren fixtures y permisos propios; quitarlas del arranque aislado no significa auditarlas. Gastos personales exige titular verificado y separación de finanzas laborales.

## Mantenimiento de pruebas y hallazgos descartados

- `purchase-order-back.cjs` no proporcionaba la nueva lectura puntual `sisventas/ordenes/test`, por lo que nunca abría el detalle. Se incorporó el lector ficticio exacto y espera de apertura asíncrona; conserva Escape, Volver, Atrás, foco/Tab y0red. PASS en tres anchos. No se alteró la aplicación.
- `salary-coverage.cjs` esperaba un aviso retirado. Se alineó con el texto actual; todas las verificaciones de importes, consultas, privacidad y retención se mantienen. PASS en tres anchos.
- El supuesto saldo viejo tras cobrar era un falso positivo del conductor: elegía la fila del historial en lugar del desplegable. Corregido el selector y la notificación RAM, el saldo335,60 se cobra correctamente. Se avisó al otro chat que descarte el candidato. **No hay corrección funcional que integrar por ese caso.**

## Reproducción y entrega

Con Node, Chrome y Playwright disponibles:

```powershell
$env:NODE_PATH='C:/SisVentas/cotizador/node_modules'
node scripts/audit-master-ui.cjs C:/SisVentas/tmp/auditoria-maestra-ui
node scripts/audit-master-commercial.cjs C:/SisVentas/tmp/auditoria-maestra-comercial
$env:SV_MASTER_ROLE='administrativo'
node scripts/audit-master-commercial.cjs C:/SisVentas/tmp/auditoria-maestra-administrativo
Remove-Item Env:SV_MASTER_ROLE
node scripts/audit-master-browser.cjs C:/SisVentas/tmp/auditoria-maestra-browser
node --test test/master-audit-isolation.integration.cjs
```

Evidencia privada de este bloque: `C:/SisVentas/tmp/auditoria-maestra-20261103-completa`, `auditoria-comercial-master10`, `auditoria-comercial-administrativo`, `auditoria-maestra-browser-final`, `auditoria-comercial-mobile2`, `auditoria-comercial-red-lenta2`, `auditoria-maestra-suite-permitida.log` y `auditoria-maestra-gastos-native.log`. No publicar perfiles, respaldos ni resultados con datos reales. Los JSON de este fixture contienen sólo datos ficticios; aun así se conservan fuera de Git.

Siguiente bloque: completar comisión posterior al cobro en el servidor ficticio y la cadena compra→recepción→lote→materiales→OT→garantía→cierre, después Caja/Tesorería y conciliación mensual. Ejecutar reglas en emulador con base revisada; Java no estaba disponible en PATH durante este bloque, por lo que no se afirma esa validación. No introducir cron, observadores periódicos de comisiones ni barridos históricos.
