# Localizador canónico interno para la historia por fila de OT — 22/11/2026

Propuesta OFF: solo núcleo E. No modifica State/Delivery/Lifecycle/OfficeCount ni el protocolo de Store de D. No cambia index, reglas, permisos, rutas o activación. El benchmark del comando OT completo sigue a cargo de D sobre el SHA integrado.

## API para D

Con `mappedAdmission` configurada en el resolver genérico, el tercer argumento de `identifyOriginal` incorpora una función opcional:

```js
const located = await io.locateCanonical?.();
// null -> mantener íntegro el recorrido de identidad/alias legado o completo.
// localizado -> {reference, product, inventory, ledgerPath, sourceHash, selector}
```

La función no recibe hints: captura la OT realmente leída por el núcleo y su selector. Materiales usa índice numérico; originales items usan `items_N`, sin fusionar arrays, reindexar o inventar una fila. Se vuelve a comparar el hash del documento real. El método es local a esa invocación/fila y sus lecturas entran en readSet y en la evidencia de lectura del proveedor histórico. No es un campo de cliente ni una nueva capacidad de escritura.

Sin admisión configurada el método no existe y la forma previa de los puertos se conserva. Con modo OFF el callback entero sigue sin ejecutarse. Con solo código y ninguna clave canónica, el método devuelve null sin leer catálogo/mappings adicionales. Un antiguo producto explícito ya ausente del catálogo también devuelve null: el lector histórico anterior puede seguir acreditando un recibo y su inverso físico antes de consultar el catálogo antiguo fallido.

## Condiciones para usar el punto directo

La fila **original de servidor** debe tener `productoKey` o `productKey` válido. Si ambos están presentes deben coincidir. Un campo explícito inválido/contradictorio se rechaza; no se reemplaza por el código de la fila. El producto P actual debe existir, estar activo, admitir stock físico y no tener fbKey contrario al path.

Se verifica la admisión Ed25519 con el manifiesto total/descriptor fijo/pins de servidor. P→J requiere el par completo y sus recibos de origen, propietario del ledger y producto actual del módulo explicit-reference. Sin mapping se exige inverso P ausente y ledger P ya existente con propietario compatible, bajo la misma cohorte. Si falta ledger P, se devuelve null para el recorrido completo: esto **no afirma ausencia de stock** y no autoriza a crear P. Un inverso huérfano o un par corrupto se rechazan, sin fallback a alias.

Si el original ya incluye inventoryKey o receiptIdentityKey, deben coincidir con la referencia acreditada. Los códigos/id descriptivos son snapshots y no pueden retargetear un P canónico; la clave física y la identidad histórica explícitas sí son identidades y nunca se ignoran si contradicen el par.

## Historia y frescura que D debe conservar

El resultado no incluye `history.kind`, `complete`, prueba de ausencia ni autorización de cantidades. D sigue verificando exactamente el original/selector, OT/fila/venta, receiptHash legado/actual, revisión, instaladas, devoluciones/custodia y remitos que correspondan. Para reconstruir una preimagen puede usar las identidades **acreditadas** de reference (incluida receiptIdentityKey) como candidatos; no debe elegir una nueva a partir del código.

Con un localizador válido D puede inspeccionar únicamente el ledger entregado. Si la historia se rechaza, el núcleo también debe rechazar aunque el par sea válido. `verifiedReads` puede incluir ledgerPath porque ese registro se leyó realmente mediante el lector de identidad del núcleo. Todos los originales, P, J, firma y orígenes permanecen en readSet y se comparan otra vez en el check fresco/commit de D.

Para el resultado sin mapping, D puede comparar las tres identidades contra la reference devuelta por **este objeto local verificado** de esa fila, evitando invocar después otra resolución por código de un source histórico. No usar un booleano cliente ni compartir ese resultado con otra fila/fase. Si retorna null, mantener el legacy/full previo completo, incluidos sus rechazos de ambigüedad. Cada fase crea un nuevo localizador; no hay caché entre planificación, fresco y Store.

## Evidencia y límites

18 PASS nuevas: mapeado/legado exacto/items con modelos físicos reales de prueba, cero lecturas de alias de código, grafía productKey válida, dos claves contradictorias/inválidas, físico/R contrario, code-only null, catálogo antiguo ausente con fallback histórico todavía funcional, ledger ausente null, pair/owner/firma/activo obligatorios, rechazo de historia/revisión y dependencias frescas modificadas. Los datos completos se conservan; ningún resolver escribe. No se copiaron políticas o modelos D ni se adaptó su State aquí.

Se agrega el módulo transitivo `office-stock-canonical-locator.js`: quien empaquete reference-port debe incluirlo en Docker aun con la función OFF. No se hizo build ni publicación. La reducción de las 36 lecturas de aliases por fase debe medirse por D en un experimento del comando completo de 12 materiales; estas pruebas del núcleo no sustituyen esa medición.
