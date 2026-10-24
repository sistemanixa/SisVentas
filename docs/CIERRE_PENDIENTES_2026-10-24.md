# Cierre de la tanda v3.14.16 · 24/10/2026

Este documento separa las mejoras implementadas y probadas localmente en la
candidata v3.14.16 de las lecturas que todavía requieren trabajo. El pedido
mantiene pagos, permisos, sincronización y comisiones, sin operaciones reales
como prueba. **La auditoría general sigue abierta.** El SHA y el estado efectivo
de Hosting, reglas y aviso de versión se registran en
[CONTEXTO_ACTUAL.md](CONTEXTO_ACTUAL.md); este cierre de código no acredita por sí
solo un despliegue.

## Alcances terminados en esta candidata

| Alcance | Cambio y comprobación | Límite conservado |
| --- | --- | --- |
| Configuración → Actividad | Filtro inicial explícito de 30 días con consulta por `fecha`, fechas visibles y acceso manual a Todo el historial. Se conserva la promesa pendiente compartida y el rechazo de respuestas de otro contexto. 63 pruebas de modelo/constructor, 7 pruebas efectivas en emulador RTDB y QA aislada de 320/390/768/1280 px. | Todo conserva el GET completo y la presentación anterior de hasta 300 filas. Los formatos antiguos no canónicos se consultan allí. El índice propuesto sólo añade metadatos; no concede permisos. Un error no provoca GET raíz de respaldo. Detalle en [ACTIVIDAD_LECTURA.md](ACTIVIDAD_LECTURA.md). |
| Cuenta del empleado en Dashboard | Tres renders simultáneos comparten un solo GET propio pendiente. La respuesta se entrega sin decodificar y el renderer valida el contexto antes de `val()`. Ocultar, salir, cambiar sesión/rol/revisión/vista/empleado retira la operación. | No se almacena un resultado resuelto para usarlo como fresco. La siguiente acción posterior al ACK hace un GET nuevo. Cálculos, selección, HTML e importes mantienen la paridad anterior; no se transformó CTA en un resumen incompleto. |
| Agenda | Los cambios síncronos de rango comparten una suscripción autorizada de origen; cada consumidor conserva su filtro. Error o retiro limpia datos/KPI, diferencia carga de vacío y exige una acción explícita para leer de nuevo. | La primera suscripción todavía descarga la raíz. El rango se filtra en memoria con la semántica previa. El Dashboard conserva su GET separado por entrada/acción, con TTL de 30 segundos; no se lo presenta como polling ni como una fuente ya unificada. |
| Impresiones y exportaciones | Paginación compartida para documentos integrados, retiro de mínimos de pantalla al exportar y espera limitada de fuentes/imágenes. Bloques grandes pueden continuar en otra hoja; botones y foco se liberan al terminar o fallar. QA con PDFs y personas ficticias, formatos cortos/largos y logo proporcionado. | No se emitieron documentos financieros reales ni se probó una impresora física o el envío externo por WhatsApp. El PDF fiscal original y la hoja de garantía intencional se conservan. El inventario y la cobertura por familia están en [IMPRESIONES_INVENTARIO.md](IMPRESIONES_INVENTARIO.md). |
| Diálogo de bloqueo de Hs.extra | Diálogo nombrado, foco inicial, recorrido de Tab, Escape con un solo dueño, retorno del foco y liberación del scroll. Cambios de contexto retiran diálogo y listeners; Ver OT pendientes conserva la navegación normal. | No cambia la regla funcional ni guarda solicitudes. No incorpora consultas, tareas por reloj o escrituras. Las OT sin fecha siguen sin bloquear y el criterio de fecha programada vencida permanece separado de esta mejora de foco. |

En CTA se aprobaron 64 pruebas puras, 28 de integración y 84 de regresión
focalizada. Verifican tres renders → un GET, GET nuevo después del resultado,
retiro antes de decodificar, respuestas inversas y paridad de cálculos/HTML con
la versión anterior, incluidas operaciones con números decimales. En Agenda hay
50 casos focales de fuente, consumidores y estados. Agenda y el diálogo de
Hs.extra pasaron también QA aislada en 320, 390, 768 y 1280 px.

La puerta integrada final aprobó **5.292 pruebas, 27 opt-in omitidas y cero
fallos**, con 5.319 casos totales. Pasaron la sintaxis de 35 archivos JavaScript
y el script oficial de validación local de v3.14.16. Las siete pruebas del
emulador de Actividad se ejecutaron aparte y aprobaron; no se cuentan como
ejecutadas sólo por existir en la suite. El namespace ficticio quedó eliminado
y el emulador detenido, sin conexiones ni uso de Google o credenciales reales.

La QA visual de Actividad bloqueó conexiones mediante CSP y usó sólo SDK/DOM y
registros ficticios. Las pruebas de impresión emplearon documentos ficticios y
el motor local; la evidencia y sus capturas quedan fuera de Git. Ninguna de esas
comprobaciones demuestra por sí sola toda la aplicación financiera en producción.

## Lecturas que quedan por revisar

Una lectura completa no es automáticamente redundante. Los saldos acumulados,
la autorización y los registros antiguos requieren cobertura demostrable. Una
escucha `onValue` recibe cambios; su existencia no prueba que se esté consultando
por reloj. Una ETag puede reducir transferencias posteriores sin resolver el
tamaño de la primera carga.

| Raíz o familia | Lectura vigente y necesidad | Trabajo pendiente seguro |
| --- | --- | --- |
| Ventas y Presupuestos | Fuentes autorizadas de `SVCommercialOwnership` y contexto comercial. Cuentas, reportes y enlaces pueden requerir historia anterior al período visible. La ETag no evita la primera descarga. | Resúmenes e índices de pertenencia con cobertura de registros antiguos y escritores coordinados. No recortar por mes ni convertir el caché de presentación en evidencia para un guardado concurrente. |
| Pagos, Gastos, Haberes y CTA | Las vistas globales concilian saldos, anulaciones, arrastres y enlaces. Gastos propios ya usa consultas por empleado y CTA propia una sola rama de empleado. | Separar detalle y acumulados con proyecciones versionadas y cobertura verificada. Recién entonces reducir raíces globales. Mantener los controles financieros de lectura/modificación concurrente. |
| Inicio de datos compartidos (`fbCargarTodo`) | Inicia fuentes autorizadas compartidas; algunas se difieren una vez durante el arranque. No todas corresponden únicamente a la página visible. | Inventariar dependencias por consumidor antes de mover cada fuente a demanda. La prioridad visual o una demora de arranque no demuestra consultas periódicas. |
| Agenda y Agenda del Dashboard | Agenda elimina la recreación de origen durante el cambio de rango. La raíz inicial y el GET separado del Dashboard siguen completos; ese Dashboard cuenta eventos futuros además de mostrar una lista corta. | Consulta por rango sólo con índice y tratamiento explícito de fechas antiguas. Evaluar fuente compartida compatible entre ambas páginas, sin confundir el contador total con los ocho eventos visibles. |
| Relevamientos | El listado carga registros completos, incluidas fotos y el contenido necesario sólo al abrir el detalle. Es una oportunidad real de reducir el primer cuerpo descargado. | Índice de resúmenes compactos y lectura de detalle al abrir; coordinar todos los escritores y registros anteriores. No basta quitar campos después de recibirlos. |
| Chat y lecturas de canales | Fuentes por grupo/directo autorizado sostienen mensajes, no leídos, edición y recepción. La vista de un canal añade su consumo. | Diseñar paginación e índice de no leídos con recibos, pertenencia y edición antigua; probar empates y cambios de permisos. Un límite arbitrario pierde esos contratos. |
| Comunicados y confirmaciones | Historial, destinatarios válidos y lecturas se reconstruyen desde las fuentes correspondientes. | Separar bandeja activa y archivo con proyección de destinatarios/confirmaciones. No calcular completitud sólo con los últimos mensajes. |
| Compras, materiales e inventario operativo | El módulo activo reemplaza el cargador antiguo de Órdenes y comparte órdenes, listas de materiales, inventario y órdenes anteriores. No se deben contar ambas implementaciones como dos fuentes activas. | Proyección de lista/estado actual y detalle/historia a demanda, conservando referencias y órdenes anteriores. |
| Dólar histórico | Carga la raíz para paginar localmente y construir gráficos mensuales. Mostrar 20/50/100 filas no implica una consulta de ese tamaño. | Período inicial explícito y Todo el historial, con los contratos del gráfico conservados. Las claves por día permiten evaluar una consulta sin inventar fechas equivalentes. |
| Productos, clientes, empleados, proveedores y catálogos | Catálogos e identidades completos sirven búsquedas, referencias y registros históricos; no son listados de los últimos N. Hay endpoints limitados para roles sin acceso global. | Reducir duplicaciones únicamente cuando identidad, permisos, alcance y frescura coincidan. Una caché de otro rol/empleado no es intercambiable. |
| Equipos, garantías, tickets, remitos, informes y reclamos | Se cargan por destinos de la aplicación y alimentan también el historial de cliente. La página puede necesitar registros antiguos. | Resumen de lista y detalle a demanda donde el contrato lo permita; índice de pertenencia/domicilio sin atribuir domicilios a datos ambiguos. |
| Exterior y Distribuidora | Listas por UID y vistas administrativas agregadas; algunas bandejas/catálogos requieren varios estados auxiliares. | Proyecciones de bandeja activa y archivo con referencias completas. Compartir fuentes sólo con autorización y contexto equivalentes. |
| Finanzas privadas y Proyectos | Finanzas usa el estado privado del UID. Proyectos carga sus miembros y hace lecturas puntuales de presupuestos vinculados; vincular manualmente puede leer el conjunto autorizado. | Resumen de proyectos y detalle privado cuando exista cobertura. No afirmar que abrir un proyecto descarga siempre todos los presupuestos. |
| Vacaciones, Hs.extra, SAC y bonificaciones | Vacaciones necesita historia para sus saldos. Hs.extra ya tiene consultas por estado/empleado. SAC usa el módulo de Haberes activo, no las funciones antiguas reemplazadas. Conceptos de bono son un catálogo pequeño; sus usos requieren alcance claro. | Conservar las optimizaciones ya entregadas y revisar sólo lecturas activas. No contabilizar funciones históricas reemplazadas como consultas vigentes. |
| Caja, uso por día, identidad y configuración | Caja y uso ya tienen alcance por día/usuario o claves; identidad, revocación y roles son controles necesarios. | Verificar redundancias concretas y duración de fuentes, sin quitar autorizaciones ni denominarlas descargas de todo el historial. |
| Migraciones, verificaciones de duplicados y recuperación fiscal | Lecturas amplias de acciones manuales protegidas; algunas guardas dependen de índices con cobertura validada. | Menor prioridad operativa. Cambiar sólo con equivalencia, datos ficticios y controles de concurrencia; no sustituir una guarda de escritura por un resumen de interfaz. |

El análisis de CPU de Cobranzas queda separado: un prototipo tuvo una regresión
con alias adversos. Debe mejorar ese caso y conservar exactamente el orden de
las operaciones decimales antes de incorporarse; falta repetir la paridad y la
medición. No corresponde presentar un microbenchmark como ahorro de Google Cloud.

## Pendientes fuera de esta entrega

La candidata reservada v3.14.12 de OT/garantías **no se aplicó ni se publica con
esta tanda**. La revisión automática rechazó las acciones sensibles propuestas;
se preservó el trabajo y se detuvieron los reintentos. Eso no demuestra una brecha
ni autoriza rodear el control con otro método. No se creó una garantía ni se
modificaron datos reales para probarla.

No se añaden servicios ni consultas automáticas con estas mejoras. El cambio
propuesto de reglas para Actividad es sólo un índice y requiere su comprobación
remota exacta. Reducir el resto de primeras descargas exige diseño y pruebas de
cobertura; quedan identificadas aquí para continuar sin falsear saldos,
permisos, sincronización, comisiones o historia financiera.
