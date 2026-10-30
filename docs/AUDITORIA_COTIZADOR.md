# Auditoría de uso del servidor · 30/10/2026 · v3.16.18

## Conclusión actual

Hay intermediación amplia que merece reducirse, pero la mera presencia de un servidor no demuestra un gasto indebido ni identifica el origen de toda la demora. Las prioridades comprobadas son lecturas globales para autorizar operaciones pequeñas, recargas de historiales y coordinación global de escrituras independientes. La conversión es candidata a simplificación; todavía no se ha demostrado que todas sus validaciones puedan sustituirse por reglas equivalentes sin rediseñar su contrato.

Este bloque es una auditoría, no una migración: no modifica cliente publicado, reglas, infraestructura, pagos, costos históricos, stock ni comisiones. No se activaron APIs deshabilitadas ni se concedieron permisos. Rama local codex/auditoria-uso-servidor-v31618. Base de código00e78903; la fuente publicada18 es2aceecff y el servidor publicado sigue0cde2e18.

## Cobertura y evidencia

- Inventario reproducible sin red: node scripts/audit-server-usage.cjs. Detectó187 scripts referenciados por las entradas HTML y47 rutas literales en el router de Cotizador; las familias dinámicas comerciales y de documentos requieren el mapa manual de abajo. Son referencias estáticas, no47 operaciones activas medidas.
- Revisión de transportes compartidos, router, proyecciones comerciales, guardado financiero, eventos y llamadas de los consumidores. Se distinguieron llamadas directas a Firebase, APIs de Cotizador y otros servicios. Las versiones históricas de app no se consideran aplicación activa.
- Una consulta de metadatos de servicios y otra de funciones, sin ejecutarlas ni leer datos comerciales:7 servicios Cloud Run y8 funciones devueltas. Los tres receptores antiguos de comisiones aparecen activos por eventos de escritura de RTDB; no son tareas por reloj.
- Cotizador confirmado en revisión ot31617-0cde2e18, mínimo0 y CPU por solicitud. Flags efectivos: observerfalse, eventtrue, laborScopedtrue, paymentScopedtrue, adminExpenseScopedfalse y otOfficeCounttrue. Un handler montado no implica que su flag esté habilitado.
- Scheduler devolvió403 en las dos regiones consultadas. El motivo comprobado fue SERVICE_DISABLED, no falta de acceso a la base. No se habilitó esa API. No se pudo enumerar su inventario; no se afirma una lista vacía ni ausencia de programadores externos.
- Trazas de ejecución de código real con datos ficticios: listar ventas propias hace GET de sv_usuarios, sv_chat_roles, sv_permisos, sisventas/ventas y el presupuesto vinculado. Devuelve sólo2 registros del fixture, después de haber leído la colección de ventas. Preparar presupuesto hace las mismas3 lecturas globales de identidad/configuración, una escucha inicial puntual y una transacción del presupuesto. La transacción puede no cambiar datos si ya están completos; su existencia no prueba una escritura efectiva.
- Los tiempos HTTP previamente observados en la franja de la conversión fueron preparar0,93s, guardado2,67s y consulta posterior de ventas3,25s. No son una medición completa de pantalla, un benchmark general ni una factura.
- Evidencia técnica y metadatos sanitizados privados: tmp/server-audit-20261030 y tmp/ot-office-count, fuera de Git. No se incorporan registros de clientes ni cuerpos de solicitudes al informe.

## Hallazgos comprobados y prioridades

| Prioridad | Hallazgo | Implicación y siguiente prueba |
|---|---|---|
| P0 | commercial-ownership.context lee tres raíces globales para cada autorización comercial. | Sustituir el camino normal por perfil/rol/configuración puntuales o índices. Conservar la resolución histórica y el directorio completo sólo donde sean necesarios. Probar revocación, reasignación y Ver como. |
| P0 | El listado comercial lee ventas/presupuestos completos y filtra después. | Descargar únicamente registros autorizados por índice y paginar por el uso real. No ocultar deuda histórica ni dar al cliente acceso a ventas ajenas. |
| P0 | preparar mezcla uso normal con reparación de autoría/responsable históricos. | Un documento canónico no debería necesitar la misma reparación en cada edición/conversión. Probar camino puntual normal y mantenimiento histórico separado. No inferir autores por nombres ambiguos. |
| P0 | labor-writes intercepta dominios enteros, incluidas modificaciones pequeñas. | Identificar campos operativos que pueden escribirse con reglas acotadas, sin abrir escrituras monetarias o cambios de responsable. No basta quitar la envoltura del cliente: hoy las reglas exigen el transporte protegido. |
| P0 | labor-guard usa una cola por instancia y un lease global compartido. | Operaciones independientes pueden competir. Medir esperas y diseñar coordinación por agregado con pruebas de concurrencia e índices; no eliminar el bloqueo antes de tener un reemplazo. |
| P1 | Un304 de listado al navegador no evita necesariamente la consulta del servidor a RTDB. | Medir ambos tramos. commercial-collection-reader valida ETag contra RTDB en cada petición; la caché es por instancia y se pierde con instancias nuevas. No anunciar ahorro facturado sólo por304. |
| P1 | Los regresos de visibilidad refrescan todas las suscripciones comerciales abiertas. | Medir cuántas recargas produce cambiar de ventana. Conservar sincronización entre equipos mediante invalidaciones concretas; no suprimir retornos ni cachear permisos indefinidamente. |
| P1 | employee-directory puede escribir un vínculo de identidad al consultar. | Separar aprovisionamiento/reparación explícitos de la lectura normal. No modificar vínculos existentes durante esta auditoría. |
| P1 | Disponibilidad del personal consulta toda la raíz de vacaciones y después proyecta los campos. | Diseñar consulta por período solicitado e índice, conservando privacidad y la posibilidad de revisar fechas anteriores. |
| P1 | Los costos de red no se explican sólo por Cloud Run. | Separar invocaciones, lecturas/transferencia RTDB, Auth, almacenamiento y servicios externos. Firebase directo también consume recursos y necesita medición. |

Referencias: js/core/labor-writes.js:8; js/core/commercial-ownership.js:28,62,76; cotizador/commercial-ownership.js:65,74,107,109; cotizador/commercial-collection-reader.js:21; cotizador/labor-guard.js:36,48; cotizador/employee-directory.js:7.

## Mapa de decisiones por circuito

| Circuito actual | Qué aporta hoy el servidor | Evaluación de arquitectura |
|---|---|---|
| Conversión presupuesto→venta | Preparación de identidad, guardado financiero comparado y coordinación; el cliente también toma lock, reserva número y verifica vínculo. | Candidata prioritaria. Evitar preparar/reparar cuando no corresponde y reducir viajes. La alternativa directa debe probar aprobación, costos, autoría, numeración, no duplicación y venta/presupuesto atómicos. Sin secretos externos por el hecho de convertir. |
| Crear/editar venta y sus adicionales | Contrato común, costos originales, permisos, referencias y conflictos con pagos. | Separar campos operativos de cambios financieros. Mantener un contrato único aunque cambie el transporte. No volver a crear caminos incompatibles para soporte y OT. |
| Cobros, anulación de pagos y pagos de gastos | Saldo, idempotencia, movimientos vinculados, adjuntos e índices. | Mantener hasta demostrar un reemplazo equivalente. Una escritura directa aislada podría dejar cuentas distintas o permitir un doble cobro. |
| Bonificaciones, haberes y aguinaldos | Cálculos, acciones específicas y escritura vinculada sin exponer la ficha privada completa. | Auditar cálculos y lecturas repetidas; no conceder acceso a cuentas privadas para evitar una API. Estudiar comandos pequeños o registros separados con reglas expresables. |
| Solicitudes de horas extra y gastos del personal | Identidad propia, acciones por rol, detalle de días y escritura de solicitudes/movimientos. | Separar la carga de una solicitud de su aprobación/cálculo financiero. Probar fórmulas y límites expresables en reglas; conservar acceso exclusivo al empleado correspondiente. |
| Costos de compra guardados en ventas | Permiso específico, comparación del original, auditoría y preservación de precios/pagos. | Candidata condicionada al diseño de reglas por campo e impacto en comisiones. No equiparar este costo histórico con editar un texto del catálogo. |
| Conteo físico desde OT | Conteo posterior al uso y confirmación conjunta inventario+OT, con concurrencia e idempotencia. | Actualmente justificado por esa coordinación concreta. Contrastar si un agregado/rediseño de datos permite igual garantía con menos viajes. No duplicar consumo ni separar ambos guardados. |
| Listados comerciales y preparar documento | Filtrado por propietario y resolución de autoría histórica. | Principal candidato a reducir intermediación y lecturas amplias. Necesita índices y separación del camino histórico. |
| Proyectos | Filtra participación y elimina datos comerciales para técnicos. | La separación es necesaria. Firebase puede servir directo sólo si se separan datos operativos/comerciales y sus reglas; leer el nodo completo y ocultar campos en UI no protege datos. |
| Directorios de usuarios, empleados y proveedores | Proyección de campos y resolución de acceso; evita entregar datos privados/credenciales. | Se puede estudiar una proyección pública protegida por reglas. No sustituir por lectura directa de las raíces privadas. |
| Edición/eliminación/reacciones del chat | Autoría y controles de modificación del mensaje. | Candidata a reglas acotadas, con pruebas de mensajes propios/ajenos, lectura previa y concurrencia. El envío/presencia no debe confundirse con este endpoint. |
| Accesos, recuperación y administración de cuentas | Admin SDK, correo, revocación y cambios de identidad. | Mantener en entorno confiable. Las credenciales privilegiadas nunca van a la web. |
| Cotizaciones de proveedores, OAuth e imágenes intermediadas | Credenciales, navegación de proveedor, límites, cifrado y restricciones de destino. | Mantener los tramos que requieren secretos o acceso del servidor; auditar caché, lotes y duplicados. |
| IA, PDF privado, dictado y asistencia | Claves del proveedor, validación del titular, aislamiento y límites. | Mantener credenciales y privacidad en servidor; medir cada solicitud y cancelación. No abrir dominios privados a otros roles. |
| ARCA, emisión y comprobación fiscal | Credenciales fiscales, llamadas externas y protección del resultado emitido. | Mantener. Optimizar pasos repetidos sin exponer certificados ni repetir emisiones. |
| Catálogo público, promociones y solicitudes | Revalidación de precio/oferta, vigencia y límites frente a clientes anónimos. | Mantener validación confiable al confirmar. Presentación y cálculos orientativos pueden quedar en la web. |
| Comprobantes de Distribuidora | Precios/ofertas canónicos, moneda, numeración y documento propio con idempotencia. | La generación visual del PDF puede ser local; decidir aparte el guardado y sus validaciones. No confundir un comprobante comercial con una factura ARCA ni recalcular históricos. |
| Generación de comisiones por evento | Relee fuentes autorizadas, calcula sobre costos originales y evita duplicados. | Auditar si las tres señales producen entregas redundantes y cómo concentrarlas. No eliminar ninguna hasta cubrir pago, estado pagado y habilitación posterior. No modifica comisiones existentes. |
| Correos de solicitudes | Credenciales y envío tras un evento confirmado. | Mantener como efecto de un evento real, con idempotencia. No es sondeo de la base. |
| Control de costos | Reacciona a avisos de presupuesto para aplicar el límite autorizado. | Mantener. No es una tarea comercial prescindible ni garantiza corte sin demora de Billing. |

## Qué ya trabaja directamente con Firebase

El transporte genérico no intercepta todo el sistema. El catálogo de productos, altas ordinarias de Agenda, vacaciones, muchas operaciones de Compras/inventario y los borradores conservan caminos directos según la ruta y sus reglas. Una operación compuesta que toca Ventas o Pagos puede terminar en el transporte protegido. Esto debe seguirse por llamada, no por el nombre visible del módulo. Tampoco lo directo está automáticamente libre de problemas: las escrituras separadas de OC/inventario merecen revisar atomicidad e idempotencia.

## Actividad automática y relojes

- Confirmado remotamente: COMMISSION_OBSERVER_ENABLED=false y COMMISSION_EVENT_ENABLED=true. El intervalo de60s existente en commission-generation.start no está activado por ese arranque. Su código no demuestra que esté consultando en reposo.
- Confirmados8 registros de funciones: emisión fiscal y test fiscal HTTP; dos correos por creación de eventos; control de costos por Pub/Sub; tres receptores de comisiones por cambios RTDB. Son disparadores distintos. Una escritura puede ocasionar más de una entrega legítima; falta medir su relación con cada operación.
- El refresco del dólar cada3h sigue siendo una excepción expresamente pedida: sesión visible y autorizada, lease compartido y pausa al ocultar. No debe confundirse con la comisión ni eliminarse por esta auditoría.
- El inventario encontró12 sitios setInterval en scripts referenciados: audio/progreso, espera limitada del login iniciado por el usuario, indicadores de sesión, propuestas/margen, borradores, estados de tarjeta privada, navegación desde push, monitor de recursos y cuenta regresiva del catálogo. Se revisaron sus callbacks: no son doce sondeos periódicos del servidor. Borradores detecta cambios de contenido y publica con debounce; la carga inicial de períodos del catálogo es un fetch separado de su reloj visual.
- Scheduler está deshabilitado para la API consultada y no se enumeraron sus trabajos. No se declara demostrado consumo cero ni ausencia de tareas externas. No se inició una nueva prueba nocturna ni un seguimiento programado.

## Criterio para dar por terminado el trabajo

La primera pasada de inventario y revisión de arquitectura queda documentada. La auditoría funcional completa sigue abierta: todavía faltan perfiles de duración/lecturas por cada operación crítica, una prueba de reposo controlada y pruebas de equivalencia de las alternativas directas. Los inventarios no prueban ahorro, facturación ni seguridad de una migración que aún no existe.

Cada propuesta deberá incluir: disparador real; trayecto web/API/RTDB; lecturas, bytes y escrituras por etapa; verificación de permisos/privacidad; concurrencia e idempotencia; comportamiento sin conexión, sesión revocada y reintento; comprobación de costos, pagos y comisiones con datos ficticios. Primero se mostrará local y sólo se cambiará producción con el alcance y costo correspondientes. No se desactivan alertas, facturación, validaciones o comisiones para simular una mejora.

---

# Registro histórico anterior de Cotizador

# Alcance de Cotizador

## Auditoría futura solicitada por el titular · 29/10/2026

Se conserva por ahora la corrección puntual de costo de venta a través del servidor, sólo al pulsar Guardar, con permiso, control de versión y auditoría. La aceptación del diseño no acredita su activación: el comando sigue preparado en local y requiere despliegue coordinado; no retirar el bloqueo de vista previa aisladamente.

Pendiente explícito: auditar el uso actual del servidor, sin asumir necesario todo lo que aloja Cotizador. Para cada circuito inventariar acción que lo dispara, consumidor web, ruta/servicio, lecturas y bytes, escrituras, duración y repeticiones; separar acción humana, evento real, reintento limitado, escucha y tarea por reloj. Identificar operaciones simples candidatas a navegador + reglas Firebase y justificar las que deban conservar validación privilegiada. Disparar desde la web no significa necesariamente escribir directo a la base: registrar ambas etapas.

Prioridad: evitar la repetición del consumo elevado. Medir reposo visible/oculto y dispositivo bloqueado; buscar descargas amplias, reconexiones, consultas duplicadas y servicios con reserva mínima. No añadir sondeos ni despliegues por registrar este pendiente. Toda propuesta conservará pagos, permisos, concurrencia, costos y comisiones; cambios de infraestructura llevarán estimación previa y evidencia de estado remoto. Alertas con demora no son un techo exacto. Este registro no confirma la configuración actual de alertas/corte ni demuestra consumo cero.


Publicación13.3 completada desde `e897dede350f1f56795c60d657bad994f6a395a3` el19/10/2026. Cotizador `cotizador-audit-e897dede`, mínimo0/CPU por solicitud,100% y14 accesos; web/aviso verificados. Ver CONTEXTO_ACTUAL para evidencia y límites. El estado de preparación que sigue conserva el registro de la auditoría, anterior a ese corte. La continuación13.4 está separada y no publicada.

## Continuación13.4: lecturas por registros, todavía local

- **Distribuidora, emitir:** reemplaza la repetición de `options()` por cotización de los IDs seleccionados: dos configuraciones y catálogo/producto por ID, máximo seis GET simultáneos en total. Conserva filtros de publicación, costos del momento, moneda/centavos, garantía, series, idempotencia y snapshots confirmados. Opciones del catálogo conserva su listado completo. Para `m` productos nuevos son `2m+3` GET auxiliares incluido el comprobante previo: menos bytes no necesariamente menos solicitudes. Fixture de dos seleccionados sobre300 productos:243.266 bytes JSON de las dos raíces frente a1.688 bytes de las respuestas necesarias; no son bytes facturados ni un ahorro mensual medido.
- **Proyectos, listar y guardar:** directorio sólo para crear/cambiar integrantes. Listado resuelve IDs vinculados únicos de proyectos visibles; respuesta de guardado deriva del snapshot confirmado. No descarga todo el historial de presupuestos en esos dos caminos. Contexto comercial fresco compartido dentro del conjunto, sin caché entre operaciones; máximo seis lecturas puntuales en vuelo, también con ownership ausente/false. No reutiliza la ficha validada antes del commit; una reasignación posterior deja el vínculo restringido. Datos ajenos/eliminados/ausentes no se muestran; errores de infraestructura se propagan y esperan lo enviado. El error posterior al commit puede informar fallo aunque el guardado haya confirmado: riesgo preexistente, no afirmar rollback. `options()` conserva la búsqueda de presupuestos disponibles.
- **Compatibilidad de claves:** se separan claves de registros heredados (espacios/Unicode, límite128, sin controles/rutas/propiedades especiales) de las identidades UID ASCII. La lectura puntual y el conjunto conservan presupuestos legítimos con esas claves. No se amplía el formato de UID ni se cambian asignaciones.
- **Comisiones, consultar:** el render ya no llama a `sincronizarComisionesLegacyConModulo()`. Antes podía leer todas las cuentas/gastos y crear/vincular gastos históricos al entrar. La generación de ventas y la gestión de comisiones modernas/migradas se conservan. Mantenimiento mantiene su incorporación explícita, sin ejecutarla aquí. Las comisiones sólo heredadas no se inventan en la lista moderna; su consulta se conserva en la cuenta autorizada del empleado, con historial completo y detalle de lectura de los valores guardados. No se migran, borran ni recalculan comisiones.

Esta continuación no cambia tráfico, reglas, IAM, capacidad ni datos reales. Puerta final2.499/2.499 y servidor94/94; sintaxis/coherencia correctas. Historial/aviso y detalle corto/largo comprobados en interfaz ficticia390/820/1440, con scroll del mensaje, cierre/foco y fondo quieto; detalle en CONTEXTO_ACTUAL. Permanecen amplios el ingreso de proyectos, opciones comerciales/catálogo y las cuatro transacciones laborales de raíz.

Auditoría local del 19/10/2026, base `98abeb60` y cliente publicado 13.2. El candidato 13.3 se prepara después de esa base y todavía no está publicado. Puerta vigente aprobada: 2.428/2.428 pruebas generales y 94/94 de backend. No se consultaron producción, credenciales ni datos de negocio para este inventario. El estado externo se toma de `CONTEXTO_ACTUAL.md`: servidor 13.1 `cotizador-projects-66a77036`, mínimo 0 y CPU por solicitud; 13.2 sólo actualizó cliente. Las pruebas locales no acreditan despliegue del servidor.

## Mapa de rutas y consumidores

El nombre Cotizador conserva el origen del servicio, pero hoy también aloja operaciones protegidas de negocio. `cotizador/package.json` inicia `index.js`; su único `http.createServer` está en `cotizador/index.js:1985`. No hay montajes adicionales. Se cuentan 51 patrones de ruta, incluidos alias y descarga dinámica, agrupados en 15 familias:

| Familia y rutas | Datos y efecto | Consumidor/disparador | Router `cotizador/index.js` |
|---|---|---|---|
| Precios: `POST /cotizar`, `/cotizar-lote`, `/verificar-proveedor`, `/cotizacion-guarani`; alias `/`, `/biosegur` | Proveedor, web/API externa y conversión. Lote escribe progreso; verificar guarda estado de conexión y guaraní guarda cotización. Cotizar no guarda por sí solo el producto. | Actualizador, ficha/importación de URL y botones Verificar/Actualizar; `app.v3.13.2.js:8031,19687,21028`; `product-url-import.js:259`; `provider-verification.js:32`; `paraguay-config.js:81`. |2190–2194 |
| OAuth: `GET /mercadolibre/oauth/start`, `/callback`, `/status` | Estado de autorización, retorno y token cifrado de Mercado Libre. Renovación al usar precios, sin consulta periódica propia. | No se encontró UI activa para start/status. Callback corresponde al retorno OAuth. Montado no demuestra configuración vigente. |2036,2150,2156 |
| Imagen: `GET /imagen-producto` | Descarga imagen de dominios permitidos; límite y caché HTTP de 24 horas. | Preparación de documentos con imágenes; app:33756. |2161 |
| Catálogo público: `POST /catalogo/cotizar`, `/catalogo/solicitar` | Revalida producto/oferta; guarda solicitud e idempotencia/límites. | Aplicar oferta y Enviar lista; `public-catalog-cart.js:23,50`, enlazado por `catalogo.html`. |2136 |
| Comercial: `GET /comerciales/{ventas,presupuestos}` y `/opciones`; `POST .../preparar`, `.../reasignar` | Listados autorizados, personas elegibles y responsable con auditoría. Guardados ordinarios y cobros mantienen otros circuitos canónicos. | Login/navegación/sincronización/reconexión; preparar edición/conversión; diálogo Asignar. `core/commercial-ownership.js:16,27,37,38,40`; app:6566,7644,10522. |2004 |
| Usuarios: `GET /usuarios/perfil`, `/directorio`, `/administracion` | Perfil propio o directorio proyectado por permisos. | Login/restauración; señales RTDB del directorio, navegación, sincronización y acciones. `core/user-directory.js:28,33,34,47,78`; `security-storage.js:42`. |2049 |
| Gestión de acceso: `GET /usuarios/acceso/estado`; `POST .../temporal`, `.../correo`, `.../completar` | Diagnóstico; clave temporal/recuperación/cambio obligatorio, límites y auditoría. | Acciones explícitas y cambio requerido; `core/user-access.js:38,65,84,125`. Sin reintento automático de estas escrituras. |2086–2096 |
| Chat: `POST /chat/mensaje` | Editar, eliminar o reaccionar sobre un mensaje; valida autor/estado. | Acción del usuario; `core/chat-security.js:6`, app:3292,3332. Envío y lectura normales usan RTDB. |2042 |
| Proyectos: `GET /proyectos`, `/proyectos/opciones`; `POST /proyectos/guardar` | Listado autorizado, integrantes/clientes/presupuestos, comandos con revisiones transaccionales. | Entrar/Actualizar, editar/vincular/guardar y evento budget-saved; `modules/projects.js:48,54,64,177,204`. Sin sondeo de listado. |2060 |
| Comprobantes: `GET /distribuidora/comprobantes`, `/opciones`; `POST .../emitir`, `.../anular` | Documentos propios, catálogo/precios, número y emisión/anulación. No crea venta, cobro ni movimiento de stock. | Entrar, actualizar precios y acciones explícitas; `modules/distributor-documents.js:26,46,63,64,68`. |2073 |
| Privado: `GET /privado/finanzas/acceso`, `/privado/finanzas`; `POST .../guardar`, `.../documentos`; `GET .../documentos/HASH` | Acceso exclusivo, estado del titular, comandos y originales PDF privados. | Capacidad tras sesión/contexto en primer plano; datos al abrir; guardar/subir/descargar por acción. `private-finance-portal.js:53,85,105,107`; `private-finance-ui.js`. |2021 |
| Laboral: `GET /laboral/directorio`, `/disponibilidad`; `POST /laboral/solicitar-horas`, `/aprobar-horas`, `/solicitar-gasto` | Empleados/cargos reducidos, disponibilidad y operaciones laborales. Directorio puede actualizar la vinculación `sv_empleado_uid` si cambió. | Directorio al arrancar cuando no hay lectura completa; disponibilidad al programar OT; escrituras por botones. App:3977,4643,5000,31425,40683,49725. |2117–2134 |
| Proveedores: `GET /compras/proveedores` | Directorio completo reducido, sin credenciales de proveedor. | Arranque diferido para roles sin lectura completa, navegación/sincronización; app:44614,5951. |2129 |
| Comisiones: `POST /comisiones/generacion/generar`, `/revisar`, `/comisiones/redistribuir` | Cobros/costos/configuración canónicos; generación pendiente idempotente o distribución autorizada. | Venta pagada/Cobranzas/Cuenta corriente y distribución explícita. `core/commission-generation.js:37,48`; app:15808,28133,34267; `commissions.js:325`. No hay UI activa que llame revisar. |2102,2114 |
| Eventos internos: `POST /internal/commission-event`, `/internal/commission-event-probe` | Entrega autenticada/reserva y generación de la venta afectada. Probe requiere configuración específica. | Tres receptores RTDB para pago.monto y venta.estadoPago/comisionHabilitada; `cloud-functions/commission-events/forwarder.js:19`. La probeta fue retirada según CTX. |1990 |

OPTIONS se responde globalmente sin operación de negocio (`index.js:1997`). La sonda `GET /?sv_connection_probe=1` de `core/connection-monitor.js:7` se ejecuta tras sesión lista, regreso visible, online o fallo de lectura, sin credenciales/datos ni intervalo propio. El comentario del cliente dice 401, pero el router responde 405 a ese GET (`index.js:2169`); el monitor admite respuestas inferiores a 500 como prueba de transporte. No se verificó su respuesta remota en esta auditoría.

Los alias `POST /`, `/cotizar` y `/biosegur` llaman la misma función cotizar. No se encontró consumidor activo de POST raíz/biosegur ni de OAuth start/status; siguen siendo rutas implementadas en el servidor. El helper de comisiones expone request(action), pero la UI activa usa generar. La disponibilidad condicionada por variables del servidor no se deduce sólo de que exista la ruta.

## Motivos de la autoridad en servidor

Usuarios, propiedad comercial, Proyectos, Comprobantes, acceso y finanzas privadas requieren comprobar identidad y permisos sin confiar en importes, actor o propietario enviados por el navegador. `cotizador/user-access.js:10–21` valida revocación y el bloqueo/versionado de acceso por operación. Comisiones relee pagos/costos/configuración y conserva estados previos e idempotencia. El permiso de administrar Comisiones no es requisito para generar la comisión de una venta autorizada.

Esto explica la autoridad actual; no demuestra que toda lectura tenga que ser amplia ni que cada formulario necesite todos los directorios. Facturación fiscal, IA/transcripción y análisis de PDF usan otros servicios, no estas rutas. La generación de PDF visual en el navegador tampoco es un endpoint de Cotizador.

## Problemas confirmados y estado

- En la base auditada, `commercial-ownership.js:95–96` validaba una venta puntual mediante visibleRecords, que leía todo el dominio, directorios/permisos y, para ventas, presupuestos completos (`:49,66`). El candidato 13.3 lee el registro exacto y su eventual presupuesto de origen conservando controles; no confundir preparación/pruebas locales con servidor publicado.
- `projects.js:25` descarga todos los proyectos antes de filtrar. Sus opciones leen directorio, clientes y presupuestos autorizados completos (`:33–37`); guardar vuelve a resolver presupuestos (`:40–56`). Un solo proyecto visible no prueba que sólo se lea ese registro.
- `distributor-documents.js:37–49` lee catálogo y productos maestros completos para opciones y repite opciones al emitir, aunque el documento seleccione pocos productos.
- El proveedor reducido mantiene las dos lecturas de rol/permisos: su autorizador valida el acceso inicial y `supplier-directory.js` comprueba otra vez cuenta activa, rol y módulos concedidos por el índice de permisos v2 (`employee-directory.js:7`, `supplier-directory.js:5–12`). No se reutilizó contexto ni se redujo ese número. El candidato 13.3 corrige la concesión indebida de módulos ausentes del índice; es una corrección de autorización, no un ahorro de lecturas.
- `fbCargarTodo` inicia Usuarios/Ventas, luego Empleados/Proveedores a 700 ms y Presupuestos a 1.800 ms (app 13.2:5879–5906), aun sin visitar sus pantallas. Dashboard/avisos/permisos usan parte de estas fuentes: no retirarlas sin comprobar dependencias y estados iniciales.
- Los listados comerciales calculan ETag después de leer/filtrar. Un 304 ahorra respuesta al navegador, pero por sí solo no evita esas lecturas de RTDB. `adminProfile(key)` también obtiene el directorio administrativo entero antes de seleccionar una ficha (`core/user-directory.js:78`).
- Defectos de continuación tardía reproducidos en VM: el timer de una OT podía pintar otra y escribir la primera con actor cambiado; Ofertas iniciaba 14 consultas nuevas después de desmontar una carga con 6 en vuelo. El candidato 13.3 invalida por contexto y elimina persistencia pasiva al leer una OT. Las ediciones/vinculaciones explícitas se conservan. Pruebas: `ot-data-sync-context.test.cjs` y `catalog-promotions-context.test.cjs`.

## Otras correcciones locales de 13.3

- Versión: `_chequearGitHub` comparte la solicitud HTTP pendiente cuando coinciden foco, visibilidad y red. Marcador y respaldo tienen un plazo conjunto de20s; validación completa,30s. Ambos comparan reloj real y descartan respuestas vencidas aunque el navegador demore los timers. La validación comprueba primer plano antes de cada GET, conserva control de operación crítica y máximo tres reintentos automáticos por señal visible. Una acción posterior puede reintentar sin navegar ni borrar datos (`version-http-single-flight.test.cjs`,23 casos). Consulta activos del sitio, no Cotizador.
- Dólar: `dolar-historico.js` comparte la lectura pendiente del histórico y descarta trabajo de otra sesión, rol, revisión o vista; espera primer plano antes de leer y aplicar resultados. Mantiene las acciones legítimas de guardar y actualizar (`:15–67,195–239`, `dolar-history-session.test.cjs`). Son lecturas RTDB/operaciones existentes, no rutas nuevas de Cotizador.
- Bitácora: se retiran envoltorios que podían anunciar éxitos por un temporizador sin confirmar la operación. En la publicación 13.2 esos envoltorios ya eran inertes por el orden real de scripts: `action-permissions.js` se ejecuta antes de que la aplicación declare las funciones. No se atribuyen escrituras activas de producción a esa reproducción de carga tardía artificial. La bitácora propia de las operaciones confirmadas se conserva (`index.html:5741,5762`, `action-permissions.js:360–368`, `audit-confirmed-operations.test.cjs`).
- Observador: `index.js:2213` exige ahora `COMMISSION_OBSERVER_ENABLED==='true'` para iniciar el observador continuo. Es una guarda preventiva ante configuración ausente; producción ya conservaba el valor explícito `false` y los eventos activos. No demuestra un observador accidental activo ni ahorro adicional de producción. La prueba específica es `commission-observer-startup.test.cjs`.
- Autenticación: omitir `REQUIRE_FIREBASE_AUTH` antes dejaba sin validación Firebase las rutas legacy de cotización. Ahora sólo el valor exacto `false` permite esa compatibilidad para pruebas aisladas. Producción ya exige autenticación según CTX; no se demostró exposición remota. Las rutas protegidas de los otros dominios conservan sus propios verificadores. Prueba real del bloque con SDK/red bloqueados: `cotizador-auth-default.test.cjs`.

No se propone separar servicios por defecto: primero acotar registros necesarios, reutilizar información sólo dentro de la petición autorizada y cancelar trabajo de vistas obsoletas. No cachear permisos entre operaciones ni omitir revocación para reducir lecturas.

## Temporizadores y ejecución fuera de una pantalla

Inventario estático adicional; no es una consulta a recursos remotos:

| Circuito | Disparador y alcance comprobados en fuente |
|---|---|
| Observador antiguo | `commission-generation.js:106–109`: escuchas y único intervalo de salud/reintentos de 60 s. `commission-job-events.js:11–17` agenda por ID, lease e intento, con límite de cinco. Sólo existe después de `start()`; CTX confirma observador apagado. |
| Eventos publicados | Tres funciones RTDB reenvían cambios pequeños. `forwarder.js` limita la antigüedad a 24 h y la petición a 20 s; no tiene bucle de reintento interno. La plataforma puede repetir entregas. No equivale a barrer ventas por reloj. |
| Cotización/lotes | Petición explícita, hasta dos trabajadores por lote y progreso ordenado. Timeout de imágenes/consultas externas y cierre del navegador o contexto liberan recursos; no inician cotizaciones nuevas por su cuenta. |
| Cachés y OAuth | TTL de precios/guaraní y renovación del token se comprueban al usar una operación; no tienen un reloj remoto de renovación. |
| Comandos transaccionales | Escuchas de apoyo se retiran en `finally`; `labor-transaction.js` admite hasta cinco intentos de conflicto dentro de un comando. Siguen siendo lecturas amplias, aunque no se ejecuten en reposo. |
| Control de costos | Receptor existente de avisos Pub/Sub, separado de las operaciones comerciales. No se creó un seguimiento nuevo en este bloque. |

No se encontró en fuente otro proceso remoto nuevo no declarado. Permanecen
riesgos de configuración: `DATABASE_URL` conserva por defecto el destino real;
una copia de prueba debe aislar explícitamente su destino y credenciales. El
arranque por eventos comprueba las banderas, pero todavía no valida de una vez
audiencia, identidad, instancia y fecha de corte. Una configuración incompleta
puede escuchar HTTP y después rechazar entregas con 503, sujetas a reentrega de
la plataforma. CTX registra configuración productiva previamente verificada;
estos riesgos preventivos no demuestran un incidente actual. No se cambiaron
esos destinos o parámetros durante esta auditoría.

## Pendiente prioritario: transacción laboral de raíz

Separado de los listados, las operaciones laborales nuevas y la redistribución de comisiones todavía usan `labor-transaction.js`: GET de `sisventas.json` con ETag y PUT condicional de la raíz comercial, con reintentos ante conflicto. Los reenvíos ya confirmados pueden omitir el PUT, pero no se resolvió el alcance de las operaciones nuevas. Éste sigue siendo un pendiente prioritario de lectura/transferencia y concurrencia; el mapa de endpoints o la lectura puntual comercial no lo corrigen. Su migración exige el plan de `PLAN_DOMINIO_LABORAL.md`, sin reemplazar datos ni recalcular históricos como efecto de esta auditoría.

## Límites y siguiente verificación

Este mapa prueba llamadas y alcance del código, no frecuencia, duración ni costo monetario actuales. No atribuye los arranques nocturnos al módulo Proyectos ni identifica al usuario físico. El observador continuo de comisiones permanece implementado, pero CTX confirma eventos activos y observador desactivado; sus temporizadores no deben contarse como sondeo productivo vigente sin comprobar configuración.

Las pruebas usan VM, memoria y datos ficticios; no crean operaciones reales ni acreditan permisos/configuración remotos. Antes de afirmar ahorro, medir por operación las rutas leídas, bytes y solicitudes en reposo, separando pruebas locales, fuente candidata y estado publicado. La puerta aprobada no equivale a publicar 13.3 ni a desplegar Cotizador. No ejecutar una migración ni reescribir históricos desde esta auditoría.
