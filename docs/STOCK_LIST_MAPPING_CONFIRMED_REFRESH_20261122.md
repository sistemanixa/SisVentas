# Vínculo en listado y recarga tras confirmación — 22/11/2026

Cambios limitados a productFor/list y argumento opcional resolver de `cotizador/office-stock.js`, más el controlador de `js/modules/office-stock.js`. No se modificaron detail/save/history del backend, su resolver E, provenance adapter, SharedGuard, proyector, API/rutas, host, aplicación, índice ni Service Worker. La prueba durable-core reservada por root tampoco se tocó. Mantener orderedList/globalOrder/resolver OFF hasta la composición completa del coordinador.

## Resolución del producto físico

Cuando se inyecta resolver, productFor llama primero a `resolver.lookupInventory(inventoryKey,{read})`, contrato E `61f0ef1065b4f28568dff07e321789d29f1349a6`. Un resultado válido conserva el key físico de inventario y usa el producto canónico actual; no consulta primero alias heredados ni permite que un catálogo con clave antigua o contradictoria sustituya la asociación verificada. Sólo null habilita el recorrido heredado. Excepciones de barrera/par inválido, undefined o resultado incongruente fallan; no se convierten en ausencia ni aproximación por código/nombre.

El puerto de E es responsable del par inverso/directo, relecturas y barrera actual; esta capa verifica forma/referencias, producto activo no servicio y revisión del vínculo. Lookup es advisory de listado y no emite capacidad de escritura. Detail/save/history siguen usando la verificación completa de E, fuera de esta modificación. Resolver ausente o OFF/null conserva resultados y exactamente las mismas lecturas del modo anterior.

## Después de guardar en modo global

Tras adapter.save, sólo una confirmación propia committed/ok (o la recuperación propia del adaptador compartido sin operationId, nunca un ID explícitamente distinto) inicia la recarga de sólo lectura. Se cierra el editor, se invalida epoch/cursor/fence local y se consulta la primera página; no se inserta ni reordena solamente una fila local. Con ello, cantidad cero desaparece, una cantidad mayor vuelve al lugar global correcto, conteo/continuación se renuevan y Ver más no usa la revisión anterior del propio guardado.

Una consulta anterior aún pendiente pierde su epoch y se descarta aunque entregue después un resultado antes válido. Se conservan las filas mientras carga, el texto del filtro y el foco semántico de la fila/acción. Si la fila desaparece o deja de coincidir con el filtro, el foco vuelve al filtro. No se roba el foco si el usuario se movió a otro control durante la lectura. Si la recarga falla después de confirmar, el editor permanece cerrado, el cursor queda invalidado y se informa que el cambio se confirmó pero hay que actualizar; nunca se reenvía la escritura para reparar la presentación.

Puerto de composición para root: `view.confirmedChange({origin})`. Conectar sólo al onSaved/onRecovered comprobado de Revisar vínculo, conservando el origen real. En las pruebas se cierra el diálogo de revisión confirmado y después se invoca ese método; puede suministrarse el origin que abrió el diálogo. Este método no verifica recibos ni guarda nada: quien lo invoca debe hacerlo después del circuito de confirmación ya comprobado. No se añadió wiring de producto/host. El guardado de cantidad global sí llama al puerto automáticamente. El modo legacy mantiene su flujo previo de edición local.

## Validación y límites

Primera tanda: 19 PASS / 0 FAIL / 0 SKIP, incluyendo 6 recorridos nuevos en 390/768/1280, 3 contratos de mapping y regresiones global/legacy/controles. Después se añadieron carreras y fallo de recarga: 11 focales finales PASS / 0 FAIL / 0 SKIP, más repetición de los 3 retornos de foco de vínculo. No sumar estas tandas como casos distintos.

Se compone la UI real con el servicio list real y puertos de escritura/mapping ficticios de contrato. Casos: 157 registros, p108→999 sube primero, p108→0 desaparece/conteo156, filtro conservado y foco en acción o filtro, Ver más con la revisión nueva sin segundo save; inventario legacy→producto canónico tras un único vínculo ficticio, sin modificar cantidades/costos/reservas; lookup OFF sin IO extra; par inválido nunca cae a alias; consulta anterior retenida y descartada; lectura fallida tras commit sin reenvío. No equivale a ejecutar el resolver E real ni la política B/remota; el núcleo E ya tiene su propia validación y root debe componer ambos en la integración.

Logs privados fuera de Git, `C:/SisVentas/tmp/audit-20261122-C`:

- stock-mapped-confirmed-refresh.log, 19 PASS: SHA256 `00cdf7d5baec16fc247f9c4aba0c470262e291872869c65a05b86282c0684cbd`.
- stock-mapped-confirmed-final.log, 11 PASS finales: SHA256 `ce06f644de99b06875a912cc1c3a59a9769bbcaa6350c1df682a227178872162`.

Sintaxis de ambos JS y diff check correctos. Sin consultas de producción, registros reales, permisos remotos, activación, publicación ni otra puerta global. El coordinador fusiona el argumento resolver con los argumentos de E conservando sus cambios de detail/save/history; este checkout aislado no contiene todos los demás frentes.
