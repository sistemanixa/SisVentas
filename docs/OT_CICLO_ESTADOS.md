# Cierre de OT y estado de instalación de la venta

## Falla identificada

El circuito anterior guardaba el cierre de la OT y luego intentaba actualizar la venta mediante otra escritura. Una falla de la segunda operación dejaba la OT cerrada y la venta en instalación. Además, la recepción de devoluciones y la corrección de rendiciones guardaban la OT sin actualizar la venta. La vista podía transformar `con_observaciones` en una etiqueta `Completada` sin persistir ese cambio, ocultando la diferencia.

Estas rutas reproducen la inconsistencia. No prueban qué despliegue específico originó cada registro histórico. Un botón de conciliación sirve como reparación puntual, no como prevención: se retiró del flujo normal del acta.

## Transiciones del circuito nuevo

| Evento autorizado | OT | Venta vinculada |
|---|---|---|
| Checklist completo, sin finalizar | Sigue abierta | No certifica instalación por sólo completar controles |
| Finalizar con pendientes o sin conformidad positiva | Cerrada con observaciones | En instalación |
| Finalizar con rendición resuelta y conformidad positiva | Completada | Instalada si no queda otra OT pendiente |
| Recibir la última devolución de una OT ya cerrada | Completa si no quedan incidencias | Instalada si no queda otra OT pendiente |
| Corregir la rendición de una OT cerrada | Reevalúa los pendientes actuales | Reevalúa todas las visitas vinculadas |
| Completar el stock pendiente desde la OT cerrada | Conserva pendientes reales o completa el cierre | Reevalúa el estado sin repetir el consumo |
| Fallar la escritura conjunta | No confirma parcialmente el cierre | No cambia aisladamente el estado |

El comando de servidor conserva firma, fecha original de cierre, productos, precios, pagos y comisiones. Genera su auditoría; el cliente no envía un historial que sustituya al anterior. Una asociación ambigua se rechaza en lugar de vincular por coincidencia de cliente.

## Consistencia y stock

La recepción vinculada deja de liberar primero stock desde el navegador. El comando recibe la devolución y actualiza inventario, OT y estado de venta en un solo PATCH protegido. Esto cubre también una devolución anterior a la instalación que aún no tiene comprobante de consumo. La repetición se resuelve mediante identidad de operación, recibo y comparación de la revisión original.

La instalación de materiales conserva su motor existente de consumo idempotente y sus comprobantes. Antes de consumir, la interfaz comprueba que el nuevo circuito está habilitado. Su posterior rendición guarda juntos los estados de OT y venta. Esto no significa que todo el inventario de SisVentas se haya convertido en una única transacción global.

## Autorización y costo

El técnico conserva el acceso a su OT asignada. La capacidad interna del servidor habilita únicamente los campos derivados de estado e historial de la venta concreta y se liga al actor, OT, venta y operación protegida. No concede al técnico lectura de importes ni escritura comercial libre. Las reglas previas de OT e inventario siguen controlando esas operaciones.

No hay sondeos periódicos, tareas programadas ni una infraestructura nueva. Se leen registros concretos y el índice preparado de OT al operar, con validación antes del commit. La rendición hace además una consulta de disponibilidad antes de mover stock. Estas verificaciones tienen costo por acción; no equivalen a prometer costo marginal cero.

## Validación y activación

Las pruebas usan datos ficticios. Incluyen ambos órdenes cierre/devolución, otras visitas pendientes, rechazo del PATCH sin cambios parciales, conservación de firma y finanzas, doble envío, sesión/revisión concurrente y rechazo de campos arbitrarios. El adaptador se prueba junto con el gateway/guard/proyecciones existentes; las reglas se verifican por separado en emulador.

La visita secundaria exige comprobar la OT primaria real, su vínculo con la misma venta y las filas/revisiones del índice listo. Conserva el enlace primario de la venta. Un checklist con índices faltantes no se considera completo.

El emulador aprobó cinco escenarios: técnico asignado sin lectura comercial, revocación antes del commit, devoluciones con y sin recibo previo con repetición, y cierre de visita secundaria. Se usó una base candidata privada revisada de reglas; esto no certifica que coincida con las reglas remotas vigentes al publicar. Debe reconstruirse y repetirse la comprobación contra esa base exacta antes del despliegue. La prueba opt-in es `test/ot-lifecycle.integration.cjs`, con `SV_SECURITY_TOOLS`, `SV_OT_LIFECYCLE_RULES` y `FIREBASE_DATABASE_EMULATOR_HOST` apuntando exclusivamente al emulador local y sus dependencias.

La propuesta no se activa por un commit. Antes de publicar: integrar sobre la versión vigente, comprobar el cambio exacto de reglas, desplegar servidor, verificar contrato y las proyecciones `labor`, `operational` y `record-list` listas con su esquema requerido; activar `otLifecycleVersion = 1` sólo tras esa verificación y publicar la web coherente. Sin marcador o servidor habilitado, el circuito debe fallar explícitamente antes de consumir stock. No ejecutar una migración histórica ni nuevas operaciones reales como prueba de publicación.

## Compatibilidad con páginas comerciales

Con la paginación activa, el preflight exige configuración y cobertura listas de la misma generación. El guard conserva sus proyecciones comerciales y la actualización derivada va en el mismo PATCH. La comparación de imágenes completas permite al proyector reutilizar totales ante un cambio exclusivamente de estado/auditoría: las pruebas con1/50/500cobros no descargan pagos y mantienen saldos. Esto no sustituye la validación exacta del despliegue ni acredita una factura mensual.

## Productos nuevos en una OT cerrada

Se encontró una segunda secuencia parcial: las altas comerciales en una OT ya cerrada guardaban productos/venta primero y completaban stock después. Si fallaba el segundo paso, la OT y la venta podían seguir apareciendo completas. Para preservar el cierre firmado, las OT cerradas no admiten nuevas altas, eliminaciones ni cambios comerciales de productos: se debe usar una nueva OT. La interfaz rechaza antes de abrir el alta/reservar un identificador y el guard de servidor rechaza antes del PATCH, incluso desde clientes anteriores. Acta, rendición y recuperación histórica canónica siguen disponibles. No se reabren órdenes ni se cambian precios/históricos como parte de la publicación. Esta política sustituye expresamente la antigua corrección comercial libre de productos sobre una OT cerrada; las correcciones comerciales de una OT abierta mantienen sus cálculos previos.
