# Auditoría integral de SisVentas — 27-08-2026

## Alcance

Auditoría de solo lectura ejecutada sobre la versión publicada `v2.3.2`, complementada con el recorrido de los módulos visibles y la suite automatizada local. No se modificaron registros de Firebase.

## Controles realizados

- Recorrido de las rutas comerciales, maestros, postventa, personal, finanzas, compras y configuración.
- Auditoría operativa de relaciones, permisos, tablas, credenciales e histórico del dólar.
- Auditoría V2 de claves técnicas, duplicados comerciales, vínculos débiles e integridad fiscal.
- Comparación sombra V3 de presupuestos, ventas/cobros, órdenes de trabajo y productos/proveedores.
- Suite automatizada completa: 480 pruebas aprobadas.

## Estado general

- 3.410 registros principales evaluados.
- 0 IDs comerciales duplicados en ventas, OT, clientes y productos.
- 0 ventas, OT, clientes o productos sin `fbKey`.
- 17 pagos históricos sin `fbKey`.
- 2 ventas sin `clienteFbKey`, aunque el cliente puede resolverse de forma única.
- 2 pagos sin `clienteFbKey`, aunque el cliente puede resolverse de forma única.
- 1 venta con estado fiscal contradictorio.
- 24 avisos de relaciones: 0 críticos, 12 normalizaciones automáticas seguras y 5 casos históricos/manuales activos.
- 3 credenciales sin cliente reconocible entre la ruta nueva y la estructura legacy.
- 75 de 75 tablas detectadas cuentan con ajuste o contenedor de desplazamiento; ninguna tabla quedó sin clave estable o sin scroll.
- Las acciones críticas conocidas están cubiertas por el módulo de permisos.
- Histórico del dólar: 47 puntos registrados; lectura correcta.

## Casos que requieren revisión humana

- Pago `-OwUOMCtpRj1Oh4YDBvA`: la referencia de venta no se pudo resolver.
- Presupuesto `-OvvPPc6rL5xSbg4b3KV`: convertido, pero sin vínculo técnico con la venta `#V-818382`.
- Presupuesto `-OvvPPKmldpt3jwO6VPs`: convertido, pero sin vínculo técnico con la venta `#V-222736`.
- Presupuesto `-OvvPPER0kzqSRlV2B_I`: convertido, pero sin vínculo técnico con la venta `#V-357963`.
- Presupuesto `-OvvPOzRAHw6QOrqnc1h`: convertido, pero sin vínculo técnico con la venta `#V-904325`.

Estos casos no deben repararse por coincidencia de número o nombre: primero hay que confirmar que el documento relacionado sea realmente el correcto.

## Normalizaciones seguras detectadas

- 2 OT pueden completar `clienteFbKey` con una coincidencia única.
- 2 ventas pueden completar `clienteFbKey` con una coincidencia única.
- 2 pagos pueden completar `clienteFbKey` con una coincidencia única.
- 6 productos pueden completar `categoriaFbKey` desde una categoría legacy inequívoca.

La herramienta informa 12 cambios seguros en total. Deben aplicarse como una única operación multipath auditable, con respaldo previo y una segunda auditoría posterior.

## Comparación sombra V3

- Presupuestos: 50 incidencias y 34 diferencias de cálculo o representación histórica.
- Ventas y cobros: 5 incidencias y 16 diferencias en la muestra comparada.
- Órdenes de trabajo: 4 incidencias y 3 diferencias.
- Productos y proveedores: 100 incidencias y 2 diferencias de resultado.
- Ninguno de los cuatro módulos está listo para activar V3 todavía.

Los grupos principales son totales históricos de presupuestos, relaciones ambiguas o faltantes, un pago huérfano y proveedores inexistentes, incompatibles o con nombre/URL que no coincide. La auditoría también contabiliza incidencias de identidad fuera de esos cuatro grupos, por eso el total general informado es 343.

## Recorrido visual y funcional

- Todas las rutas principales pudieron abrirse y mostrar sus controles propios.
- Productos y Cuentas de empleados requieren esperar la restauración de sesión cuando se abre una URL completa; mediante navegación interna abren correctamente.
- Las tablas visibles conservan contenedores de scroll y ajuste de columnas.
- Se detectó texto dañado en el resumen de Mantenimiento (`cr?ticos`, `autom?ticos`, `hu?rfanas`, entre otros). Se corrigió el archivo fuente y se agregó una prueba preventiva.

## Orden de trabajo recomendado

1. Publicar la corrección visual de Mantenimiento.
2. Generar respaldo de las ramas afectadas.
3. Aplicar únicamente las 12 normalizaciones inequívocas mediante actualización multipath.
4. Volver a ejecutar auditorías V2 y V3 y comparar los contadores.
5. Revisar manualmente el pago huérfano, los cuatro presupuestos convertidos y las tres credenciales sin cliente.
6. Clasificar las diferencias históricas de presupuestos y producto/proveedor antes de habilitar cualquier módulo V3.

