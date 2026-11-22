# Consumidor real P→J y recarga confirmada — 22/11/2026

Entrega de pruebas/documentación exclusivamente. No se modifican archivos de E, consumidores de producto, SharedGuard/store ni wiring/runtime; tampoco el test durable-core reservado y corregido por root en c011fd8e. La fuente central congelada no se toca. No se activó ni publicó nada.

Se compone el listado actual de C con lookupInventory/resolve reales de E `61f0ef1065b4f28568dff07e321789d29f1349a6`, consumidor Stock detail/save/history real, command real de vínculo, createLaborGuard real, Operational.augment real, nativeGateway.resolve real y recuperación nativa de navegador real. Los datos y el almacén son ficticios en memoria; la UI se comunica por HTTP loopback y bloquea todo destino externo. No hay doble del resolver, de detalle, historial ni del escritor de cantidad.

El helper de módulos permite elegir revisión Git inmutable en este checkout aislado, sin copiar/cambiar el núcleo. Conserva su export load/revision anterior y agrega forRevision. En un checkout integrado usa require normal del propio árbol. Aquí el listado usa el archivo actual de C y detalle/save/history los de E; en central integrado ambos vienen del mismo servicio fusionado. No se reemplaza producto para hacer pasar las pruebas.

## Casos comprobados

- Vínculo real del producto canónico P (`product`, código actual NEW) al inventario físico J (`legacy`) con identidad histórica verificada. Listado y detalle devuelven la misma pareja; no se crea inventario bajo P ni se cambian cantidades/costos al vincular. Un par roto provoca rechazo, sin volver a alias aunque exista otra aproximación.
- Navegador 390/768/1280: listado resuelto sin «Producto por identificar»; filtro NEW conservado. Conteo 10→8, confirmación y recarga de primera página con foco restaurado en la acción correspondiente.
- Segundo conteo 8→7 pierde el ACK después de guardar en el almacén ficticio real del core. El panel nativo consulta la operación original, conserva id/digest de cuerpo (distinto del CAS) y la UI ejecuta confirmedChange readonly. Dos llamadas de save en total para dos conteos, una consulta de recuperación, tres commits totales (vínculo + dos conteos), y exactamente tres lecturas de lista (inicial + una por cada confirmación). Ningún reintento de escritura para recuperar presentación.
- Historial real consulta `sisventas/inventario_operativo/legacy/ajustesConteo`, conserva el ajuste antiguo y agrega cada conteo una sola vez. Se verifican tres entradas, cantidad final 7 y unidad/reservas/costos/asignaciones/rendiciones/confirmaciones/operaciones originales preservadas. No se crea una rama física `product`.
- Sin errores JS, conexiones externas ni desbordamiento horizontal en los tres tamaños.

## Preparación del orden y límites

La generación/rank/hash del resumen ordenado se prepara **sólo en la fixture**, a partir del único original físico local, antes de listar y al reconocer un recibo confirmado. Es un soporte de datos de lectura sintéticos y NO una integración atómica del mantenedor con política B/store/reglas. No se cuenta esa preparación local como un commit de negocio ni como evidencia de que estén cerrados todos los escritores. La atomicidad del orden, cohorte autoritativa y corte SDK corresponden a la composición conjunta pendiente; la prueba actual certifica el consumidor/resolver/confirmación e historial, no ese cierre productivo. No se consulta una colección de originales desde los endpoints de lectura.

Resultado final: **4 PASS / 0 FAIL / 0 SKIP**, código 0, 11,43 segundos. Log privado fuera de Git `C:/SisVentas/tmp/audit-20261122-C/stock-real-consumer-refresh-final.log`, SHA256 `c5eca1110f60929d8b36970f992c4c902cafa78e7ac300cfb2e1a6384140cf93`. Sintaxis de helpers/test y diff check correctos. Sin otra suite global, credenciales, datos reales, permisos remotos ni publicación. Siguiente paso: root revisa y repite la composición sobre el árbol integrado, conservando los flags OFF hasta completar la política y barrera reales.
