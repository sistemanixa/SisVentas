# Stock: lista positiva paginada (local)

Fuente aislada `b37792ff`, rama `codex/stock-positive-pagination-local`. No incluye trabajo H7. No se publicó, aplicaron índices ni guardaron operaciones reales.

## Problema reproducido

La API anterior paginaba50 productos del catálogo y resolvía su inventario por alias. La UI eliminaba los ceros después. Por eso «Ver más» podía consultar otros50 productos sin añadir filas disponibles; además se multiplicaban las lecturas de inventario por producto/alias. El JS servido por el loopback62603 coincide con la fuente19 y contiene el filtro positivo; esta comprobación HTTP no demuestra qué está ejecutando una pestaña con Service Worker.

## Cambio local

- `cotizador/office-stock.js`: consultar el resumen operativo por `general`, desde el mínimo número positivo. Leer51 registros (52 con cursor inclusivo), procesar50 y conservar el valor/tipo y la clave del último procesado. Sin descargar el catálogo completo.
- Los números positivos se obtienen directamente. RTDB ordena los strings después de los números: las cantidades antiguas en texto se validan sin descartarlas; un tramo de strings cero puede devolver cero filas con continuación explícita, nunca un «vacío completo» falso. Cantidades no interpretables se señalan para revisión. No se recorren páginas automáticamente.
- Resolver producto por clave exacta o consultas indexadas de igualdad con límite2 por campo/referencia. Sin asignar a un producto ambiguo. Conservar las filas de stock positivo sin vínculo como revisión, sin habilitar su ajuste.
- Separar clave de inventario y `productKey`. Los alias duplicados siguen como filas distintas; la UI no suma cantidades y bloquea su edición cuando detecta el producto repetido. Detalle/guardado conservan sus validaciones canónicas existentes.
- `cotizador/index.js`: extender exclusivamente el callback privado de estas consultas con `equalTo` y `startAt` tipado; el cuerpo HTTP no elige ruta o campo.
- `js/modules/office-stock.js`: «Ver más» muestra actividad, conserva filas durante la espera y evita doble consulta. El selector «Agregar stock» sigue incluyendo productos sin existencia.

## Preparación necesaria, no aplicada

`scripts/build-office-stock-list-indexes.cjs` produce una propuesta offline: `.indexOn general` en `sisventas/compras_resumen/inventario_operativo`, y `codigo/cod/id` en productos conservando los índices previos. No modifica autoridad. **No activar el backend nuevo antes de comprobar/aplicar los índices exactos**: una consulta sin indexar no acredita ahorro de transferencia. Se requiere empaquetado mínimo sobre el servidor Stock vigente y nueva revisión/publicación; no desplegar todo el checkout ni mezclar H7.

La ordenación/cursor es nueva: frontend y backend deben activarse emparejados. No acepta el cursor-string del listado anterior. No modifica el modelo de ajustes, cantidades, reservas, costos, historial, permisos financieros o comisiones.

## Verificación local

39 pruebas Node aprobadas: ajustes, comandos, paginación, catálogo, HTTP, recuperación del host y roles. Prueba nueva del servidor:180 productos intercalados,121 positivos incluyendo el producto inicial; páginas50/50/21, sin repetición. Legado110 cantidades string cero: continuación explícita hasta encontrar el positivo posterior. Incluye referencias no resueltas, alias duplicados, cursor inválido y prueba de que los índices no cambian grants.

Medición sintética en memoria, no latencia ni facturación de producción: respuesta8618/8698/3775bytes,59/59/30 lecturas instrumentadas incluyendo la consulta, una consulta de inventario por página. El archivo `test/office-stock-pagination-native.test.cjs` aprobó los dos casos390/1280 con API real sobre memoria,100ms de demora deliberada,141 positivos, catálogo con ceros y «Ver más»:50→100→141 filas visibles, controles bloqueados durante la espera, cero escrituras y cero solicitudes exteriores. Respuestas8700/8780/7220bytes y108–116ms incluyendo la demora ficticia; no representan producción. Las cantidades ilegibles se identifican en un aviso separado, nunca como existencias positivas. Log `stock-positive-pagination-native-final.private.log` retenido fuera de Git. Se conservan los intentos fallidos: primero faltaba NODE_PATH; el segundo detectó una imagen exterior ficticia abortada, eliminada de la fixture sin relajar la aserción de red.
