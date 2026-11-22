# Orden global de Stock: propuesta local sin activar

Problema reproducido por coordinación: con 100 registros de cantidades 1..100, la página inicial actual lee las primeras 50 ascendentes y luego las ordena en el navegador; muestra 50 como máximo aunque existe 100. Ordenar sólo las filas recibidas no constituye orden global.

| Alternativa | Resultado | Decisión |
| --- | --- | --- |
| Descargar todos los resúmenes y ordenar | Orden correcto, lecturas sin límite y costo repetido | No implementar |
| limitToLast sobre general original | RTDB separa números de strings; cantidades históricas de texto y empates pueden alterar límites | No implementar |
| Proyección numérica mínima con cobertura y revisión autoritativas | Páginas acotadas en orden global, sin cambiar originales | Implementar OFF |

Plan aprobado: agregar únicamente `_svStockRank:-cantidadNormalizada` y `_svStockSourceHash` al resumen de inventario ya existente; no crear otro índice de originales ni copiar historial, unidades o costos. La clave del resumen identifica inventario. La cantidad mostrada se toma del original puntual fresco y se verifica contra su huella de cantidad cruda/revisión; los números y strings históricos se conservan. Cero no tiene rank positivo consultable, se excluye de la lista normal y sigue disponible en Agregar/búsqueda. Una cantidad inválida impide certificar cobertura completa.

El lector sólo usa esa proyección cuando config, generación, versión de escritor, revisión y cobertura coinciden con una barrera autoritativa inyectada por servidor, antes y después de la página. No basta la metadata autocertificada del propio índice: una cantidad nueva omitida necesita invalidar el sello de todos los escritores. Hoy no existe ese sello global de inventario en operational-read-config; por ello el modo nuevo queda OFF y la preparación se ejecuta únicamente sobre fixtures locales.

Las consultas usan orderBy rank, startAt numérico + clave y máximo 51/52 filas para obtener 50 más evidencia de continuación. Cursor atado a generación/revisión/rank/clave; cambios concurrentes rechazan continuidad y piden actualizar, sin mezclar dos estados ni inventar totales. Primera página debe contener los máximos globales y Ver más no omitir empates. Se verifican orden y huella de cada fila y totales de cobertura; no se interpreta un índice incompleto como stock vacío.

Interfaz: modo explícito de orden global por mayor cantidad, distinto del fallback heredado. No se ofrecen órdenes de nombre/ascendente como si fueran globales cuando sólo hay una página. Se muestra cuántos registros positivos verificados se cargaron de la cobertura completa, sin sumar cantidades parciales como un total definitivo. Se preservan filtro/foco y contenido durante recargas; cambio de revisión no agrega páginas mezcladas.

Regresiones previstas: >100 registros, números/strings legados, ceros, empates y claves numéricas, invalidquantity, cursor inválido, continuación completa sin duplicados/omisiones, fuente/proyección/revisión cambiadas durante lectura y entre páginas, y vista 390/768/1280 con datos ficticios. Sin endpoints, escritura real, preparación remota, activación ni puerta global adicional.

## Primera entrega: derivación y lector sin conexión

`office-stock-order.js` es puro: prepare produce sólo los dos campos derivados por registro, config ready=false/writersClosed=false, fence y referencias inválidas. No escribe ni certifica una barrera real. maintain es un puerto candidato para extender Operational.augment: devuelve derivados y siguiente fence, más expectedFenceHash que el coordinador debe revalidar con lectura fresca antes del commit bajo el MISMO guard. No se conectó ni cambió SharedGuard ni Operational.augment.

Protocolo propuesto en dos fases: (1) preparar/contrastar el resumen y cantidades con fuentes completas bajo una barrera de escritores verificada, mantener ready=false; (2) sólo después de cerrar SDK/escritores y comprobar CAS de fence+original+config, habilitar una generación. Cada escritura posterior debe conservar original y resumen, derivar rank/hash y avanzar conteos/revisión de sv_office_stock_order_fence en el mismo patch coordinado; beforeCommit relee el fence y rechaza un hash distinto. Cambios de config/generación también invalidan continuidad. El puerto candidato no es evidencia de que todos esos escritores estén cerrados; permanece pendiente para revisión del coordinador.

`office-stock-order-reader.js` exige ese config y un readOrderingFence AUTORITATIVO inyectado por servidor; no lo deduce de una página ni de un flag del cliente. Antes/después verifica la misma configuración/fence, rechaza cantidades inválidas, coteja cada rank/hash con el original puntual, pagina por rank numérico y clave RTDB con límites 51/52 para 50 resultados. No consulta colecciones completas. totalPositive proviene de la cobertura, no de sumar una página. La UI deberá contrastar el acumulado al terminar y no presentar como colección completa un índice incompleto.

16 pruebas locales aprobadas, cero fallos/omisiones: 157 positivos mixtos num/string más cero, 123 empates con claves numéricas, cantidades inválidas, barrera/versiones, cursores corruptos, concurrencia y puerto puro CAS. Log privado `C:/SisVentas/tmp/audit-20261122-C/stock-order-reader.log`. No se modificó aún list/adapter/frontend ni se activó la preparación. Fuente de coordinación: central 4c8c98efaef580d2ee15b32e2a1ce526570d02cb, list sin parche sobre 9f98; cambios posteriores se limitarán a las funciones de listado para no revertir los ajustes de otros frentes.
