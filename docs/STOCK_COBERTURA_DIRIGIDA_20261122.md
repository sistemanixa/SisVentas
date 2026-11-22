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

## Ampliación: recibos antiguos y contraste real de consultas

El siguiente incremento añade lectura puntual de la OT original cuando los recibos no se pueden acreditar solo por auditorías. Usa `ot-material-state.legacyReceiptIdentity/receiptBoundToRow` existentes, más comprobación obligatoria de preimagen SHA actual o antigua. `stockRegistro` por sí solo no acredita producto: deben coincidir OT, fila única, identidad candidata del original, venta, revisión y cantidad instalada. Máximo 32 OT originales, 256 filas por OT y 256 recibos; excederlos exige conciliación. El original entra en evidencia y CAS; ninguna de estas lecturas modifica ledger, OT o remitos. Si no se puede reconstruir una preimagen única se bloquea, sin asumir ausencia. La historia/remitos de cada comando consumidor continúa verificada en A/D.

Recibos modernos y antiguos comparten validación estricta de revisión entera segura >=1, claves OT/venta, instalada numérica finita >=0 y opcionales de cantidades/fila. Se rechazan revisiones ausentes, cadenas, infinitas o cero; auditoría adelantada; auditorías huérfanas y datos contradictorios. No se coercionan números del ledger.

Se incorporó localmente el puerto mínimo root 7f1c700c como 6cde540c, conservando solo el puerto de rango y sus pruebas; no se trasladó el contexto de políticas de Compras. La fixture ahora implementa `store.queryPage`, por lo que el guard real consulta el store real de la composición en su check final.

Evidencia ampliada: **117 PASS** de ocho suites del núcleo, incluyendo 15 del guard; **2 PASS** de composición con la UI real de C en 390/1280 y recuperación de ACK perdido; **1 PASS** del cierre de COPY de Docker, sin build. **9 PASS** adicionales contra Java Database Emulator v4.11.2 instalado, solo `127.0.0.1:9079`, namespace `demo-stock-directed-{pid}` con reglas sintéticas e índices acotados. Estas nueve verifican semántica de consultas, no permisos de producción ni la candidata completa de B.

El emulador detectó que `$key startAt:''` es inválido. Para el prefijo normalizado vacío se usa una primera página por clave sin bound, siempre limitada a 65 y rechazada si excede 64. El puerto strict permite exclusivamente esa forma acotada por clave; las consultas de otros campos mantienen bound/equalTo obligatorio. No hay descarga ilimitada ni espejo. La fixture de objeto usa un objeto no vacío: RTDB elimina objetos vacíos al persistir. Tras la corrección, los nueve casos reales (incluidos objeto/array, Unicode, booleano, número y clave numérica) pasan.

No se reemplaza esta evidencia por una declaración de circuito completo: faltan la integración central de consumidores y de las barreras/reglas candidatas, su matriz final y el cierre de clientes antiguos antes de habilitar. Todo continúa OFF; sin servidor de producto, datos reales, despliegue o push.
