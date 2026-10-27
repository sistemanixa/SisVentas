# Plan de lecturas por pantalla · 27/10/2026

Estado: **auditoría estática y propuesta; sin implementación ni activación**.
Base publicada estudiada: e2f3b4324b26c6a748ec82f8f2bcecc18ecb3095/v3.15.6.
Candidata amplia contrastada:06cc63582f5ee59999f75171b97212f99420abf4/v3.15.7,
con privacidad fiscal preparada. Git, estado local y producción son distintos.
Este plan no modifica esa candidata ni autoriza un corte o una migración.

## Evidencia y límites

El inventario automático encontró 118 funciones superiores con referencias
directas a seis fuentes compartidas y 24 archivos core/módulos relacionados.
No constituye un grafo transitivo completo ni demuestra que todas las rutas
se carguen para todos los roles. Sus artefactos originales se conservan
privados en tmp, fuera de Git; aquí se incorporan las conclusiones de fuente.

El informe coordinado registra 63 pruebas existentes PASS de cuentas, cobros,
gastos, lector comercial y pertenencia de pagos, con datos ficticios. Ese log
se inspeccionó; no se repitieron aquí ni se presentan como pruebas de una
arquitectura que aún no existe. Dos comprobaciones de loopback necesitaron
permiso de red del sandbox, sin cambiar expectativas. No se consultaron
registros reales ni facturación para elaborar este plan.

Contrastado con el código de la base publicada:

-fbCargarVentas llama al origen sin período/cursor y procesa con
 filtrarPeriodo:false. _aplicarFiltrosVentas ordena/filtra la lista completa
 antes de aplicar slice para mostrar 50 filas.
-fbCargarPagos escucha sisventas/pagos y conserva el historial completo.
-commercial-ownership recordsContext/list lee la colección comercial,
 resuelve presupuestos vinculados y luego filtra por responsabilidad.
-commercial-collection-reader solicita la raíz con ETag; 304 evita transferir
 de nuevo un cuerpo idéntico, pero no prueba eliminación de lecturas RTDB ni
 limita la primera carga. Recortar la respuesta después en Cloud Run tampoco
 demuestra reducción de tráfico desde la base.

## Contratos que deben separarse

| Recurso | Alcance requerido | Lo que debe conservar |
| --- | --- | --- |
| Dashboard | Resúmenes de indicadores del mes actual/anterior y recursos propios por tarjeta | Deuda y presupuestos activos pueden ser antiguos; los conteos históricos/conversión mantienen su semántica mediante acumulados separados. No convertir todo el inicio en dos meses de ventas. |
| Ventas | Páginas de hasta 50 resúmenes desde la base, filtros antes del límite, cursor estable por fecha canónica+clave | Identidad, permiso, revisión, búsqueda y orden. Definir hasMore, empates e inserciones entre páginas; saltar a página arbitraria o contar todo tiene otro costo. |
| Detalle de venta | Lectura autorizada por clave técnica, versión y secciones solicitadas | Ítems, cobros/vínculos necesarios y costos/comisiones sólo con permiso. Un error o una venta fuera de página no es un vínculo roto. PDF sólo por acción fiscal autorizada. |
| Cuenta corriente | Saldos y obligaciones abiertas completas por cuenta/cliente unificado | Deudas antiguas, pagos actuales sobre ventas antiguas, arrastres, anulaciones y datos ambiguos. El estadoPago guardado solo no sustituye al resolvedor contable canónico. |
| Cobranzas | Página por fecha de cobro y resumen del período; deuda/pagos de la cuenta o venta exacta al operar | Pago parcial, cobros embebidos/globales, alias prioritarios, anulaciones y ediciones sobre ventas fuera de página. |
| Ficha de cliente | Resumen propio y páginas por solapa/cuenta/domicilio | Identidad unificada, domicilio elegido coherente y registros antiguos ambiguos sin domicilio inventado. |
| Nueva venta/Presupuesto | Búsquedas y originales puntuales; reserva de número | Editar/duplicar/convertir no depende de la primera página; costos, creador, comisionados y fecha originales se conservan. |
| Comisiones/Haberes | Empleado/período y acumulados autorizados; originales puntuales | Una venta antigua pagada ahora genera sobre su configuración/costo original, sin recalcular comisiones previas. |
| OT/Soporte/Garantías/Compras | Listas/resúmenes propios y origen por clave | No perder referencias antiguas ni reemplazar snapshots de costo/garantía con el maestro actual. |
| Productos/Reportes/Excel | Agregados por producto/período y exportación explícita de todo el conjunto solicitado | Ranking por ventas distintas sin mano de obra; referencias históricas para eliminar; exportación completa y precisión de datos crudos. |

Separar ventasPage, saleDetail y summaries como contratos explícitos, además de
los originales usados para autorizar/escribir. No reutilizar ventasList como
una página parcial mientras cuentas, deuda, numeración, comisiones o vínculos
sigan interpretándola como historia completa.

## Dependencias y diseño de consultas

Los lectores a adaptar incluyen el modelo canónico de ventas, Cuenta corriente,
conciliación, resolvedores legacy, domicilios, facturación, OT/garantías/compras,
ranking, reportes, comprobaciones de referencias y las huellas/cachés de vistas.
DataReadiness debe representar recurso+alcance+revisión: una página lista no
confirma un saldo completo. Desconocido/error no se muestra como cero.

La reserva definitiva de número ya tiene transacción de servidor. Antes de
quitar máximos locales hay que probar cobertura/continuidad del contador y
compatibilidad con clientes antiguos. Cincuenta registros no prueban el máximo.

Diseñar índices únicamente para filtros/órdenes usados: propietario+orden,
cuenta+orden, período+propietario, obligaciones abiertas y pagos por venta.
RTDB no combina filtros arbitrarios como SQL. Ni el navegador ni el endpoint
deben descargar una raíz para después simular la paginación. No crear todos
los índices posibles ni introducir un servicio fijo o un sondeo por reloj.

Cursor y caché ligados a identidad real, permiso/revisión, consulta y orden.
Reasignar retira el índice del dueño anterior y agrega el nuevo coherentemente;
Ver como conserva su proyección propia. Los resúmenes también pueden revelar
finanzas: necesitan permisos equivalentes aunque no incluyan ítems ni PDFs.

## Cobertura, escritores y consistencia

Cada agregado necesita esquema y calculador versionados, cobertura verificable
y revisión/secuencia que detecte desfase. Un índice sin cobertura no confirma
vacío y no habilita una descarga global automática para reparar cada inicio.

Inventariar todos los escritores actuales antes de retirar lectores: legacy,
V3, importaciones, pagos/anulaciones, reasignaciones, compras, facturación,
OT, correcciones e interfaces administrativas. Actualizar original y proyección
de forma coordinada con diferencias antes/después e idempotencia. Cambios
retroactivos afectan los períodos de origen y destino. Acuse perdido o doble
clic no debe duplicar pagos, saldos o comisiones. Evitar contención de raíz.

La candidata 15.7 tiene versiones opacas/proyecciones de privacidad y comandos
financieros preparados. commercial-view-protocol.envelope sólo produce metadata
de versión/cobertura; commercial-public-transport.list todavía recibe registros
del lector de colección. **No son páginas de 50 desde la base ni resúmenes mensuales de
Dashboard ya implementados.** No mezclar su activación pendiente con este plan.

## Puertas antes del cambio

1. Cerrar grafo lector/escritor y contratos por pantalla; clasificar legacy y
   filtros reales. Definir corpus ficticio, métricas y costo de población
   inicial antes de cualquier lectura productiva amplia.
2. Implementar índices/acumulados y escritores coordinados con cobertura
   verificable; probar paridad frente al resolvedor actual, sin migrar datos
   reales como prueba incidental.
3. Adaptar consumidores a página/detalle/resumen y readiness por alcance.
   Verificar cursor con empates, inserciones, filtros y resultados más allá
   de la primera página. No alterar numeración o exportaciones silenciosamente.
4. Preparar población inicial, respaldo privado, drenaje, fuente limpia y
   revisión exacta de reglas por un método permitido. El intento de emulador
   anterior sigue bloqueado: no repetirlo ni debilitar contención Java/AkkaUnsafe.
5. Antes de infraestructura, informar costo estimado, comprobar estado remoto
   y disponibilidad operativa, y concretar el corte autorizado. Esta auditoría
   no crea reglas, servicios, índices, flags ni presupuestos nuevos.
6. Reversión de lectores compatible con escritores/confirmaciones nuevos,
   manteniendo privacidad. No restaurar una base completa, deshacer pagos o
   reabrir concesiones de datos para revertir una pantalla.

Paridad obligatoria: deuda antigua con cobro actual, parciales/múltiples,
anulaciones/créditos, alias ambiguos/embebidos, clientes unificados/domicilios,
comisiones, diciembre/enero, fechas retroactivas, concurrencia, respuesta perdida,
proyección faltante y permiso revocado. Fallar cerrado en cada capa.

Medir por separado DB→servidor y servidor→navegador, solicitudes, primera carga,
CPU/latencia, tamaño de índices y amplificación de escrituras. Incluir caché
fría/caliente y reposo con condiciones reales del ensayo. No deducir factura
de bytes de fixtures ni prometer un límite exacto por alertas demoradas.

Criterio de salida: mismos saldos, totales, pagos, permisos y comisiones;
ninguna raíz histórica completa en el camino nuevo; siguiente lote acotado;
detalle aislado; exports completos; cero operaciones reales usadas como prueba;
sin polling ni costos fijos añadidos. Ahorro y plazo siguen sin cuantificar.
