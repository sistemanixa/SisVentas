# Auditoría de rendimiento de SisVentas v3.9.25

Fecha: 09/10/2026. Código base: `b88af8cfc1cea468dc0da59b85cfc1d91019725a`.

## Alcance y conclusión

Revisión del arranque, autenticación manual y restauración de sesión, carga y sincronización de datos, grillas, catálogo, proveedores, ventas/cobranzas, OT/agenda/soporte, gastos/empleados, compras y portales externos, chat/notificaciones, actualizaciones y caché PWA. Es una auditoría de código y estructura con pruebas existentes; no una certificación de tiempos de todas las pantallas en producción.

El principal riesgo de rendimiento es que el inicio sigue descargando y ejecutando casi todo el sistema, y después mantiene colecciones completas sincronizadas aunque sus pantallas no estén abiertas. La verificación de acceso agrega lecturas repetidas. Hay mejoras previas útiles, pero escalonar trabajo no reduce su volumen total.

No se modificó la aplicación ni se publicaron cambios. No se accedió a registros reales, no se inició sesión con una cuenta real y no se alteraron reglas de Firebase.

## Evidencia cuantitativa

Medición local de recursos referenciados por `index.html`, excluyendo importaciones transitivas de Firebase, fuentes, imágenes y recursos dinámicos:

| Medida | Resultado |
| --- | ---: |
| Scripts locales de entrada | 110 |
| Scripts clásicos sin `async`/`defer` | 109 |
| JavaScript referenciado, sin comprimir | 4.597.075 bytes |
| JavaScript comprimido con gzip local, suma por archivo | 1.177.552 bytes |
| Monolito activo `js/app.v3.9.25.js` | 3.131.638 bytes |
| Monolito con gzip local | 754.034 bytes |
| `index.html` | 461.523 bytes |
| `index.html` con gzip local | 84.747 bytes |

La compresión es una estimación de laboratorio, no una medición del tráfico del servidor. No todos los scripts bloquean el primer dibujo del login: muchos están al final del documento. Sí bloquean el avance del parser y agregan trabajo durante el arranque. El monolito representa aproximadamente el 68 % del JavaScript de entrada.

## Hallazgos y acciones

### P1 — Separar el inicio de sesión de la carga completa del sistema

Evidencia: `index.html:35`, `index.html:5712`, `index.html:6244` y bloques posteriores. Incluso usuarios de Compras Paraguay/Distribuidora descargan módulos generales. Sólo Órdenes de compra agrega 208.908 bytes; el planificador Paraguay, 92.403 bytes; el portal Paraguay, 87.575 bytes; las tablas redimensionables, 83.631 bytes.

Recomendación: entrada pequeña para Auth, identidad y pantalla de acceso; cargar la aplicación y sus dominios después de verificar la sesión y según rol/ruta. Mantener el orden de dependencias globales: agregar `async` indiscriminadamente rompería funciones y eventos. Minificar ayuda a transferencia y análisis, pero no reemplaza la separación.

Validación propuesta: comparar carga fría/caliente, tiempo hasta poder enviar credenciales, tiempo hasta pantalla utilizable y tareas largas; perfiles admin, vendedor, técnico y portales externos.

### P1 — Lecturas repetidas en la verificación de acceso

Evidencia: `js/core/firebase.js` (`fbOnAuth`), `js/modules/security-storage.js:8`, `js/app.v3.9.25.js:14148`.

Con almacenamiento protegido activo, `svPrepararRutasSeguridad` lee primero `sv_chat_roles/uid` y, para un rol interno, todo `sv_usuarios`, y abre una suscripción sobre ese nodo. El resolutor vuelve a preparar rutas y después vuelve a leer identidad y usuarios.

Para un rol interno:

- El resolutor manual ejecuta cuatro `fbGet` secuenciales: identidad, usuarios, identidad, usuarios. El observador de Auth puede además ejecutar su preparación en paralelo al login manual.
- Restaurar sesión pasa por la preparación de `fbOnAuth` y luego por el resolutor: seis invocaciones `fbGet` en esa cadena. Firebase puede reutilizar información en memoria; seis invocaciones no equivalen necesariamente a seis transferencias completas.
- `fbCargarUsuarios` vuelve a establecer la sincronización general después del ingreso. La lectura completa para verificar una sola identidad escala con la cantidad de usuarios.

Recomendación: compartir una promesa de preparación por UID y sesión; devolver identidad/ficha verificada desde esa preparación; consultar la ficha por UID con índice y reglas compatibles. Mantener la comprobación de activo, rol y coincidencia de ficha, la revocación y la invalidación al salir/cambiar de usuario. No acelerar el acceso omitiendo verificación.

El timeout de 15 s del resolutor comienza después de la preparación previa de `fbOnAuth` en restauración, por lo que no cubre por sí solo toda la cadena. Los otros timeouts de UI son mecanismos de recuperación, no tiempos de respuesta medidos.

### P1 — Las cargas diferidas siguen conectando datos de todo el sistema

Evidencia: `js/app.v3.9.25.js:5956` (`fbCargarTodo`). Se inician cuatro cargadores inmediatos y otros diecisiete distribuidos a 700, 1.800 y 3.800 ms, además de dependencias de ruta y configuraciones del login. Son cargadores, no un conteo exacto de conexiones: cada uno puede abrir varias suscripciones.

Recomendación: conservar datos comunes mínimos y conectar colecciones por necesidad de pantalla/rol. Para indicadores globales usar resúmenes pequeños. Definir qué listeners necesitan persistir al navegar y cancelar los demás; un rol sin acceso a una pantalla no debería pagar innecesariamente su carga.

### P1 — Históricos completos y reconstrucciones en cada snapshot

Evidencia: ventas en `js/app.v3.9.25.js:6572`, productos en `:6242`, OT en `:7730`, pagos en `:27134`. Se observan colecciones completas y se reconstruyen arrays, índices, métricas o vistas al recibir cambios. Pagos también crea el HTML de Cuenta corriente aunque esa pantalla no esté activa.

Importante: ventas carga todo el historial deliberadamente para conservar deuda antigua. Recortar a tres meses sin otra fuente de saldos sería una regresión financiera.

Recomendación: separar historial paginado de deuda/resúmenes completos; cambios incrementales e índices compartidos; procesar colecciones grandes por lotes o en un Worker cuando las funciones sean puras. Pintar sólo la pantalla visible y evitar reconstrucciones duplicadas entre ventas y pagos. Mantener exactitud de pagos parciales, anulaciones y saldos antiguos.

### P1 — Gastos y catálogo crean todas las filas/tarjetas filtradas

Evidencia: `renderTablaGastos` en `js/app.v3.9.25.js:42682` y `renderCatalogo` en `:22690`. Sus listas se convierten completas en HTML con `map().join('')`, sin límite de página dentro de esas rutinas. Filtrar puede reducir resultados, pero no impone un máximo. El gasto agrega múltiples controles por fila; el catálogo mantiene una tarjeta completa por producto.

Recomendación: paginación o ventana de render; búsqueda con agrupación de eventos; imágenes diferidas y dimensiones reservadas. Conservar totales calculados sobre el conjunto completo, y exportación/selección múltiple independientes de las filas visibles.

### P2 — Comparación de proveedores trabaja incluso con la vista oculta

Evidencia: el snapshot de productos llama `renderResumenPreciosProveedores` sin verificar visibilidad. La rutina en `js/app.v3.9.25.js:44446` recorre productos/ofertas y busca el grupo de proveedor mediante `grupos.find` por oferta, y reemplaza HTML.

Recomendación: marcar resumen sucio y calcular al abrir Proveedores; indexar proveedores por clave y nombre, reutilizar resultados por revisión de datos. Evitar sustituir la vista si el resultado no cambió.

### P2 — Chat descarga conversaciones completas para calcular novedades

Evidencia: `js/modules/chat-access.js:62` y `:84` suscriben `sv_chat/canal` completo para canales grupales y directos del directorio. Más conversaciones e historial aumentan carga aun con el chat cerrado. Hay guards y controles de acceso, pero no límites de consulta en esas suscripciones.

Recomendación: índice de conversaciones con último mensaje/contador por usuario, y páginas de mensajes al abrir una conversación. Preservar recepción de nuevos mensajes, permisos y semántica de no leídos.

### P2 — La caché PWA favorece frescura sobre velocidad en recargas

Evidencia: `sw.js`, handler de `fetch`. JavaScript, CSS y navegación se consultan primero en red con `cache: 'no-store'`; Firebase SDK también intenta red sin caché antes del respaldo. La caché se usa fundamentalmente si falla la red. Eso impide asumir que una recarga normal online aprovechará el código ya guardado.

También hay diferencias entre las query strings de `SHELL` y los recursos activos (por ejemplo Firebase y comisiones). Esas variantes pueden generar entradas y descargas adicionales. No se comprobó que impidan instalar el SW.

Recomendación: recursos inmutables versionados con caché prioritaria, manifiesto de release coherente y HTML con revalidación. Nunca mezclar versiones: probar actualización, recarga con red lenta, rollback y recuperación offline antes de cambiar estrategia.

### P2 — Presencia y medición de uso generan actividad periódica

Evidencia: presencia general y uso en `js/app.v3.9.25.js:14340` y `:14377`; presencia de chat en `js/modules/chat-presence.js`. Hay pulsos de 30 s en diferentes sistemas; el latido general no verifica visibilidad. `cargarMetricasUsoUsuarios` lee todo `sisventas/uso_usuarios` aunque se seleccionen sólo siete días.

Recomendación: consolidar pulsos cuando sea compatible, limitar frecuencia en segundo plano y consultar métricas por intervalo. Conservar `onDisconnect` y distinguir pestaña oculta de usuario desconectado. La frecuencia observada no permite calcular costo mensual sin conocer sesiones y volumen reales.

### P2 — Observadores y repintados globales

Evidencia: `js/modules/grid-default-order.js:96` observa todo el documento; tablas redimensionables observan todo el body aunque filtran la página activa. Hay agrupación de trabajo y prevención de realimentación, lo cual es positivo. Una actualización grande todavía puede activar varios recorridos y ordenamientos.

Recomendación: observar la vista activa/contenedores específicos y pasar las filas nuevas a la inicialización. Medir por separado inserción del HTML, ordenamiento, adaptación de columnas y layout; no atribuir toda demora al renderizador.

### P2 — La señal de datos listos no siempre implica procesamiento terminado

Evidencia: clientes marca listo antes del armado por lotes en `:6010`; ventas marca listo antes de procesar su snapshot en `:6581`; errores también marcan nodos listos. El overlay espera hasta 3.200 ms, además de un mínimo visual de 420/650 ms y su transición. No es una medición del tiempo de login.

Recomendación: distinguir recibido, procesado, disponible y error; marcar listo después del procesamiento necesario para la primera vista. Ofrecer estados parciales reales sin bloquear por módulos que esa vista no usa.

## Cobertura por dominio

| Área | Evaluación |
| --- | --- |
| Login y restauración | Lecturas repetidas y carga global; prioridad P1 |
| Clientes/productos | Clientes ya cede el hilo por lotes; productos reconstruye datos y activa resumen oculto |
| Ventas, cobranzas, facturas, cuenta corriente | Historial y conciliación completos; no recortar deuda para ganar velocidad |
| Presupuestos | Carga global diferida; revisar render y adjuntos con volumen real |
| OT, agenda, soporte, equipos, garantías, informes, remitos | Colecciones diferidas globales; hay guards de visibilidad en varias vistas |
| Gastos, empleados, vacaciones, haberes/comisiones | Gastos sin límite de filas; cargas y cálculos requieren perfil con historial grande |
| Proveedores/actualizador | Comparaciones globales; indexación y cálculo bajo demanda |
| Órdenes y portales exteriores | Datos de órdenes bajo demanda, pero código pesado se descarga al inicio |
| Chat/notificaciones | Historial de canales completo; notificaciones ya reduce trabajo con pestaña oculta |
| Dashboard | Hay cachés y agrupación de render; sigue dependiendo de colecciones voluminosas |
| Adjuntos, PDF, facturación remota y consultas de proveedores | No medidos extremo a extremo: requieren archivos, servicios y condiciones reales |
| PWA/actualizaciones | Frescura priorizada mediante red sin caché; requiere rediseño coherente de releases |

## Verificación y límites

Se ejecutó el conjunto de la versión activa siguiendo los mismos filtros de `scripts/test-current.ps1`, mediante Node en Linux: 356 pruebas, 356 aprobadas, 0 fallidas; aproximadamente 21,4 s. No se incluyeron instantáneas `incremental-*`, `release-*`, `v3-architecture.test.js` ni la prueba de navegador `catalogo-clientes-v330.test.js`, tal como establece la puerta habitual sin `IncludeBrowser`.

Se intentó una medición aislada con Chromium y datos sintéticos. El primer lanzamiento falló por una restricción de sockets del entorno; el segundo intento quedó interrumpido y no produjo resultados. No se informan tiempos de navegador, LCP, INP, memoria, bytes reales de Firebase ni duración real del login. Las pruebas aprobadas verifican comportamiento existente; no prueban ausencia de problemas de rendimiento.

## Orden de mejora recomendado

1. Resolver una sola vez identidad/rutas/ficha durante login y restauración, manteniendo las verificaciones de seguridad.
2. Separar entrada de login del monolito y cargar módulos por rol/ruta.
3. Evitar render de vistas ocultas; paginar Gastos y Catálogo.
4. Reducir suscripciones globales y separar históricos de resúmenes/saldos.
5. Limitar historial de chat y consultas de métricas de uso.
6. Rediseñar caché de recursos versionados y medir actualización/offline.

Antes y después de cada mejora: medir en móvil real y escritorio, sesiones frías/restauradas, red rápida/lenta, distintas cantidades de registros y cambios desde otro dispositivo. Reportar mediana y percentil 95 en múltiples repeticiones, tarea más larga, número de listeners, transferencia y memoria. Objetivos de referencia para la experiencia web: LCP <= 2,5 s e INP <= 200 ms; establecer el presupuesto de login verificado tras medir la latencia real de Auth y RTDB. Separar siempre demora de red, procesamiento y renderizado.
