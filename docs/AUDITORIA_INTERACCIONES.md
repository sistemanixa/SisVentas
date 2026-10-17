# Auditoría de carteles, clics y desplazamiento

17/10/2026. Candidata local v3.12.9, rama `codex/auditoria-interacciones` desde `918f0923`. Producción conserva v3.12.8. Sin cambios de datos, permisos, contraseñas ni servidor remoto.

## Criterio obligatorio

| Área | Condición que debe cumplirse |
| --- | --- |
| Clic | El control visible recibe el clic; ni una capa invisible ni el fondo ejecutan otra acción. |
| Teclado | Enter respeta el botón enfocado; Cancelar nunca confirma. Enter en un área multilínea sigue siendo salto de línea y la composición del teclado no confirma. |
| Foco | Tab y Shift+Tab permanecen en la confirmación. Al cerrar vuelve al control de origen si sigue conectado y visible. |
| Capas | Una confirmación superior no desactiva su propio botón. Los diálogos nativos conservan su capa superior. |
| Scroll | Desplazar una lista frontal no mueve el fondo. Cerrar o minimizar libera la página; restaurar recupera el bloqueo y el diseño. |
| Cabeceras | Fondo opaco y contenido vertical conservado. El gestor de ventanas no debe convertir todo un panel en cabecera. |
| Móvil | Controles dentro de pantalla, sin maximizar de escritorio; botones táctiles de confirmación y diálogos de Proyectos de al menos44px. |
| Reposo | Una pila sin cambios no vuelve a escribir clases ni realimenta su MutationObserver. |

Estos criterios se comprueban antes de afirmar que una corrección de interacción está terminada. No sustituyen pruebas funcionales de guardar, permisos o concurrencia.

## Fallas reproducidas y correcciones

- El listener de confirmaciones interceptaba Enter también sobre Cancelar y resolvía `true`. Ahora los botones conservan su acción nativa; el listener solo procesa teclas del propio diálogo, sin composición ni eventos ya consumidos.
- Tab podía salir de la confirmación y el cierre dejaba el foco sin restaurar. Se contiene el recorrido y se devuelve al control anterior sin desplazar la página. Escape consumido no cierra también el diálogo padre.
- La sincronización removía/reagregaba clases en cada ejecución. Veinte sincronizaciones sin cambios produjeron80 escrituras en la prueba anterior; ahora producen cero. Solo se escriben estados que cambiaron. El observador incluye `hidden`, `open` y flags de minimización/bloqueo.
- Un overlay con `role=dialog` era considerado directamente panel aunque tuviera una `.modal` interior; el gestor podía aplicar el formato de cabecera al panel entero. Ahora prioriza el panel hijo y conserva el caso de un panel que sea él mismo el diálogo.
- La regla móvil general `.btn{min-height:36px!important}` vencía a las reglas de44px. Se ajustó únicamente la prioridad de confirmaciones, Reintentar carga y botones de diálogos de Proyectos. Medición real posterior:44px en confirmación y diálogo nativo con estilos de Proyectos; tablas y demás botones no se ampliaron globalmente.

## Evidencia y alcance

- 1.878 pruebas vigentes aprobadas;27 complementarias de aviso/portal, acciones de notificaciones y menús también aprobadas. Ocho casos nuevos en la puerta vigente; las pruebas leen la aplicación activa y reprodujeron los fallos antes de corregirlos.
- Una primera ejecución concurrente falló por el plazo fijo de espera de una prueba existente de cola PDF (esperaba una lectura iniciada y obtuvo cero). Ese archivo pasó aisladamente y la suite completa repetida pasó. No se cambió la implementación PDF ni se alteró la expectativa; queda identificado como prueba sensible a carga para revisar su sincronización por condición.
- Navegador local aislado, sin Firebase: Cancelar con Enter resolvió `false`, Tab circuló en el diálogo y cerrar restauró el foco. Una lista desplazó651px con fondo en0; después del cierre el fondo pudo desplazarse624px. Confirmación sobre lista y dentro de `dialog.showModal()` recibió el clic mediante `elementFromPoint`, sin `inert`. Maximizar/restaurar/cerrar y liberación de clases verificados. En reposo: cero mutaciones de capas en500ms.
- A390×844: controles dentro de pantalla y cabecera opaca; maximizar oculto; confirmación y botón del diálogo nativo con44px. Es tamaño de navegador, no celular físico ni prueba de rueda/touch reales. El scroll se verificó con PageDown.
- Aplicación local completa con sesión existente: abrió sincronizada. Nuevo cliente abierto y cancelado sin escribir: panel vertical, cabecera opaca, un único Maximizar, bloqueo activo al abrir y liberado al cerrar. No se guardaron clientes ni operaciones de prueba.
- Inventario inicial del índice:43 pantallas y84 módulos importados. Revisión de infraestructura compartida y consumidores representativos; no se recorrieron todos los formularios ni cada combinación de datos/roles de esas pantallas. No declarar auditoría universal ni ausencia absoluta de fallos.

## Repetir las pruebas de interfaz sin datos reales

```powershell
node scripts/dev-interaction-audit.cjs
```

Abrir `http://127.0.0.1:8784/` en la misma pestaña de trabajo. La herramienta extrae los componentes compartidos de la aplicación activa y sirve solo la página ficticia y cuatro CSS permitidos. No carga Firebase, autenticaciones, documentos ni módulos financieros; no sirve el repositorio completo. `INTERACTION_AUDIT_PORT` permite otro puerto de loopback. No se incluye en Hosting.

Controles: Confirmación (Cancelar con Enter, Tab, Escape), Ventana con lista (scroll, confirmación anidada, maximizar/restaurar/cerrar), Diálogo nativo (confirmación interior) y Comprobar reposo. Restaurar el tamaño normal del navegador y volver a SisVentas al terminar. `test/fixtures/interactions.html` contiene solo datos ficticios.

## Cierre del bloque de recorridos por módulo ·17/10/2026

Se completó el bloque local acordado, después del commit inicial `cbe0968a8116572b0174d595f764dc89959a4bcf`, en la misma rama y candidata v3.12.9. Producción sigue v3.12.8. La aplicación completa se sirvió en un origen ficticio nuevo, sin SDK de Firebase, autenticaciones reales ni servicios externos. Las escrituras simuladas se registran solo en memoria; las peticiones externas se rechazan antes de enviarlas, HTTP no permite POST y CSP limita conexiones al mismo origen. Los servicios dedicados de Proyectos, finanzas y Distribuidora también usan identidades y almacenamiento ficticios en memoria. No se guardaron pruebas sobre datos reales.

### Cobertura observada

| Recorrido | Escritorio y390×844 | Resultado y alcance |
| --- | --- | --- |
|42 rutas activas del índice | Ambos | Apertura, contenido activo, ausencia de excepciones no controladas y de desborde horizontal del documento. No equivale a probar todas sus operaciones. |
|27 ventanas | Ambos | Abrir/cerrar, bloqueo/liberación del fondo, orden de capas y botones de cierre alcanzables cuando existen. Formularios genéricos de cliente, producto, empleado, usuario, proveedor, evento, ticket, garantía, servicio, remito, gasto y orden de compra; gasto rápido, bonificación, comisión manual, comunicado, categorías, revisión de mano de obra, Actualizador, vacaciones, adelanto, chat, asistente, impresión, visor, origen de OT y selector de kit. |
|9 vistas principales | Ambos | Venta, presupuesto, producto, kit, gasto, informe, equipo, historial de cliente y entrada a Relevamientos: abrir/retornar sin bloquear ni desbordar. Relevamientos se comprobó como entrada de módulo, sin afirmar un relevamiento completo. |
|Actualizador | Ambos | Minimizar libera; restaurar bloquea; cerrar libera. No se inició ningún lote ni se modificaron precios. |
|Chat | Ambos | Menú delante del mensaje; Responder primero; Escape cierra menú y devuelve foco sin navegar el fondo. Seis reacciones alcanzables y sin reaccionar a mensajes reales. |
|Selector de productos | Móvil con20 resultados ficticios | Lista larga dentro del viewport, contención del scroll del menú. No se modificó su posicionamiento porque no se reprodujo un desborde. |
|Proyectos | Ambos | Crear proyecto y necesidad ficticios en RAM; abrir/cancelar integrantes, preparar y vincular presupuesto. Diálogos centrados, dentro del ancho y con fondo bloqueado. |
|Gastos personales | Ambos | Ocho secciones; abrir/cancelar tarjeta, pago, seguro, cuota y gasto externo. Volver a SisVentas restaura interacción y scroll. |
|Visor PDF | Móvil | PDF sintético de tres páginas:1→2→3, Siguiente deshabilitado en la última; Anterior vuelve a2; cerrar y retornar sin bloqueo. Extracción simulada local; no se guardó el resumen ni se envió un PDF real. |
|Distribuidora | Móvil | Selector con tres imágenes cargadas; borrador, vista previa e informe de garantía ficticios; volver conserva serie; descartar solo el borrador ficticio. No se emitió comprobante. |
|Lector | Móvil, video simulado | Decoder real de QR y Code128 leyó dos ejemplos sintéticos, detuvo la cámara simulada y cerró. Escape restaura el overflow anterior. Sin abrir cámara física ni afirmar prueba de sonido en un dispositivo. |

Rutas: Dashboard, Venta, Detalle, Presupuesto, OT, Cobranzas, Cuenta corriente, Tesorería, Configuración, Agenda, Servicios, Remitos, Proveedores, Balance de compra, Órdenes, Facturas, Crédito fiscal, Estadísticas, Notificaciones, Garantías, Soporte, Proyectos, Relevamientos, Equipos, Historial cliente, Clientes, Catálogo, Productos, Kits, Actualizador, Empleados, Usuarios, Reportes, Comisiones, Gastos, Asistente, Vacaciones, Rentabilidad, Cuentas empleados, Informes, Caja y Tablero. El inventario anterior de43 IDs incluía un contenedor que no era una ruta `.page`; el recorrido efectivo corresponde a42, más el portal privado dedicado.

### Fallas adicionales reproducidas

1. Tablero no abría: `renderTablero` usaba `gastosList`, una variable inexistente. Se usa la colección canónica `gastosData` conservando sus filtros y cálculo. Prueba funcional con un gasto ficticio de125 verifica tarjeta y gráfico.
2. El recordatorio urgente del Dashboard cubría Guardar en móvil. Espera visualmente mientras hay una ventana modal y reaparece al cerrar, conservando nodo, estado y lectura pendiente. Se comprobó el punto del botón antes y después; no se descarta ni marca leído como arreglo.
3. Listas flotantes de productos/chat fuera de sus paneles no heredaban contención de scroll. Se aplica a esos menús, sin cambiar selección ni cálculos.
4. El lector dependía del bloqueo del monolito: abierto desde una página independiente dejaba el fondo desplazable. Ahora guarda/restaura su propio overflow, conserva el bloqueo del diálogo padre y no enfoca controles desconectados. Tres pruebas funcionales cubren estos casos.
5. Escape del menú del chat era interceptado por la navegación global: cambiaba la página de atrás y dejaba abierto el menú. Acciones y reacciones declaran cierre propio; Escape consume su evento y restaura el disparador conectado. La prueba ejecuta ambos listeners reales en orden, además de comprobarse en navegador.

La fixture de Proyectos tenía un `overflow:auto!important` que anulaba el bloqueo del módulo; se quitó esa prioridad solo en la herramienta de prueba y se repitió la comprobación. No era una modificación funcional de Proyectos.

### Repetir y límites

`node scripts/dev-module-audit.cjs` sirve la aplicación activa y los botones de recorridos en `http://127.0.0.1:8786/`. La herramienta no forma parte de Hosting. Usar la misma pestaña, abrir Resultado de auditoría y conservar el reporte; un resultado de ruta no implica guardar su formulario. Los helpers dedicados siguen siendo `dev-projects-flow.cjs`, `dev-private-finance.cjs` y `dev-distributor-documents.cjs`, siempre con fixtures, sin configurar PDF privados para esta auditoría.

Se aprobaron1.884 pruebas vigentes y la integración HTTP de aislamiento por separado; sintaxis, diff y coherencia local se verifican antes de entregar. Los reportes/capturas están en `C:/SisVentas/tmp/`, fuera de Git y Hosting.

Quedan fuera de este cierre: rueda/touch/rotación y teclado virtual en hardware físico, cámara y sonido físicos, todos los estados de datos/roles/concurrencia y todas las operaciones financieras. No se declara ausencia absoluta de microfallas ni se confunde este recorrido con una nueva auditoría de permisos. Próximo paso: revisión local del titular y, cuando lo indique, preparar la publicación desde un SHA limpio siguiendo Hosting seguro; no desplegar automáticamente por cerrar estas pruebas.

Publicar esta candidata requiere la autorización de su alcance y el proceso de Hosting habitual. Las correcciones comunes no cambian cálculos financieros ni amplían permisos.
