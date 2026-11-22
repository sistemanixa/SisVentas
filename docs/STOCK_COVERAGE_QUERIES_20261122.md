# Cobertura por queries acotadas, sin espejo global

Nuevo componente puro de I/O inyectado `office-stock-catalog-coverage.js`; todavía no conectado a command/port, que continúan OFF. No crea índices, config de producto, backfill ni copia de catálogo. Sólo producto puntual y queries acotadas; todo probado con datos ficticios.

## Contraejemplo de queries exactas

El alias normalizado del lector actual reemplaza signos/noASCII por guión bajo y trunca120. Buscar únicamente id/codigo/cod equalTo=A_B encuentra canonical.codigo=A_B pero omite otro.codigo=A.B, aunque ambos apuntan al mismo inventario A_B. También omite arrays String([A,B]), objetos, booleanos/números frente a strings y sufijos truncados. Las pruebas reproducen esas colisiones; no se marca cobertura completa a partir de equalTo parciales.

## Puerto ejecutable y demostración acotada de catálogo

`collect({productKey, inventoryKey, limit=64}, {read,queryPage})` lee el producto original para derivar TODOS sus aliases y la clave física seleccionada; no acepta un set parcial de aliases o un complete=true cliente. Para cada campo $key/id/codigo/cod consulta los prefijos previos al primer guión bajo (o el alias completo si no hay guión bajo). El fin de rango es el sucesor ASCII del prefijo, inclusivo de modo conservador: no usa prefijo+U+F8FF, que perdería algunos preimages Unicode. Descarta prefijos cubiertos por otro más corto.

Se cubren tipos adicionales: bucket numérico finito cuando un alias puede empezar por número/signo; booleanos correspondientes; cola desdeU+FFFF que incluye objetos/arrays según el orden RTDB, más strings altos conservadoramente. Si el prefijo es vacío, esa consulta incluye strings y objetos y puede superar el límite: RECHAZA, no certifica un subconjunto. No se supone schema escalar de id/codigo/cod.

queryPage recibe `(sisventas/productos, {orderBy, startAt?, endAt?, equalTo?, limitToFirst:limit+1})`. Debe ejecutar exactamente el rango tipado contra el backend; no puede reemplazarlo por limit2/equalTo. El módulo rechaza resultados de más de limit registros, claves malformadas y alias que no pueda interpretar. Devuelve catalog=true únicamente tras I/O de todas sus consultas y propietario único esperado; no afirma otras coberturas.

Resultado contiene productoKey/aliases/owners, readSet puntual y querySet de `{path,options,hash}`. `assertFresh(proof,{read,queryPage})` repite exactamente las consultas y detecta cambios de membresía (incluidas inserciones concurrentes). No entrega registros, precios o ledger a UI. Por ahora este módulo sólo certifica catálogo, NO inventario/mapping/recibos, y requiere validar el comportamiento en emulador antes de integrarlo.

## Requisito mínimo de transporte e índices

La query genérica actual de scope es igualdad y el readQuery del store sólo admite key/uid; no se elude esa restricción. Para integrarlo hace falta un puerto de servidor cerrado a catálogo y estas opciones de rango/límite, y conservar querySet para freshCAS; no requiere modificar el guard genérico si se inyecta el lector acotado y se registra el beforeCommit. Cada propietario debe usar el mismo lector/orden RTDB. Solicitar revisión de ese puerto a coordinación antes de conectarlo.

Sólo se requeriría .indexOn id/codigo/cod en productos (key ya tiene índice nativo), no un espejo global. La copia privada de reglas se inspecciona sólo para comprobar esos índices; cualquier faltante se prepara como candidato y emulador, nunca remoto. La completitud depende de terminar cada rango, no de que exista un índice. Un bucket grande bloquea ese caso legítimamente.

La exigencia provisional de sv_stock_reference_config/index en command/port todavía no se retiró: primero integrar esta prueba de catálogo con consultas completas de inventario/forward/inverse e historia verificable y sus CAS. No sustituirla por coverage=true arbitrario. Sigue pendiente el tooling ficticio de preparación de la activación privada/corte, distinto de datos de producto.

## Identidad histórica: ajuste pendiente de D

El port actual compara receiptIdentityKey del original con mapping siempre. Eso protege historia confirmada, pero puede rechazar una primera entrega tras asociación cuando la fila no tiene recibo y la nueva identidad legítima debe venir del mapping. Antes de cambiarlo hace falta que D defina evidencia de fila nueva verificada contra documento/ledger/historial completos (no sólo instalada=0, sin stockRegistro o una bandera cliente). Una fila devuelta/remitada no es pristine. Con historia confirmada la igualdad seguirá obligatoria; con ausencia de historia demostrada se tomará la identidad del mapping autoritativo. No se implementó una relajación ciega. Pruebas requeridas: primerDtrasL y viejaDantesL, además de D-R-L-I sin nuevaD rechazado.

## Evidencia actual

8PASS de rangos/prefijos, Unicode/truncación, numeric/boolean/array/object, límite excedido y phantom en freshCAS, con doble de orden RTDB. Sintaxis/diff correctos. No emulador ni garantías de producción todavía. No navegador, datos reales, write remoto o build. Este incremento es componente de catálogo, no cobertura completa habilitada.
