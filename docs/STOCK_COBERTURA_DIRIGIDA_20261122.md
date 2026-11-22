# Cobertura dirigida de referencias — 22/11/2026

Incremento del frente E sobre dd111977. Todo permanece OFF; no se registra ningún endpoint ni se habilita cliente. No se lee producción, no se escriben cantidades y no se aplican reglas o índices.

## Implementación

`office-stock-directed-coverage` sustituye el callback provisional que devolvía `sv_stock_reference_config/index`. Es una capacidad local de servidor, reconocida por WeakSet. Los indicadores de cobertura se producen después de leer el producto/inventario, consultar los alias normalizados y verificar ambas direcciones de mapping. No acepta un objeto cliente con indicadores de completitud.

Se consulta catálogo por prefijos y tipos, incluyendo códigos numéricos, booleanos y objetos/arrays que la normalización antigua admitía. Inventario agrega los campos `productoKey/productKey` para encontrar registros con clave física arbitraria. Los mappings se consultan por producto/inventario y se cotejan con su inversa puntual. Cada consulta pide límite+1: si rebasa 64, se rechaza toda la operación; no se trunca para elegir un candidato. No se mantiene un espejo global del catálogo ni del inventario.

La identidad histórica se acredita con los recibos y sus auditorías `confirmacionesOT/regularizacionesOT`, comprobando la preimagen SHA de OT/fila/producto/venta. Ausencia de ambos grupos y recibos usa la clave física. Recibos antiguos sin evidencia suficiente siguen bloqueados; no se declaran ausentes. La verificación de originales/remitos del dominio consumidor sigue a cargo de `identifyOriginal`, cuya evidencia debe incluir lecturas efectivamente realizadas mediante sus puertos.

`loadSnapshot` usa este loader en preview, execute y antes del commit. Los resultados de consultas y lecturas forman parte del hash esperado. El port de consumidores busca primero los mappings puntuales históricos: ausencia comprobada conserva el recorrido anterior sin consultar catálogo; presencia exige cobertura dirigida real. El readSet agrega `{kind:'range',path,options,hash}`. `assertFresh(readSet,readFresh,queryFresh,queryPageFresh)` reproduce puntos, igualdad histórica y rangos; falta/denegación del puerto fresco bloquea.

`labor-rtdb-store.queryPage` es un puerto nuevo de servidor cerrado a productos, inventario y ambas direcciones de stock_vinculos, con allowlist de campos por ruta, límites 2..129 y valores escalares JSON. No amplía `readQuery` ni `query`. No introduce imports en el store; el cierre de Docker conserva los mismos activos transitivos.

## Coordinación e índices propuestos

Root provee el puerto mínimo de guard `queryPageFresh` en 7f1c700c. E usa ese puerto en el check final cuando está disponible; fuera de ese guard usa el mismo lector directo sin caché. A/D deben proporcionar `queryPage` del store a la factory o puertos del resolver y el cuarto argumento fresco a `assertFresh`. Los callbacks de cobertura provisionales dejan de ser aceptados.

Índices necesarios, solo como propuesta para B: productos `codigo,cod,id` (ya presentes en la copia auditada); inventario `codigo,cod,id,productoKey,productKey`; ambas direcciones del mapping `productKey,inventoryKey`. Falta de índice, permiso o consulta falla cerrada. No desplegados.

## Evidencia y límites

84 pruebas de este incremento: catálogo, cobertura dirigida, comando, puertos de consumidores para Stock/Compras/OT, consultas REST con fetch ficticio, guard y store reales compuestos con datos en memoria. Incluyen alias concurrente, inventario fantasma, mapping nuevo tras ausencia, tipo servicio/inactivo exacto, límite excedido, identidad distinta de producto/clave física, ACK perdido y replay. No equivalen a la matriz completa de comandos de los tres dominios: A/D componen sus consumidores reales por separado. Sin emulador remoto, datos reales, activación, build o publicación. La suite general la ejecuta la coordinación central.
