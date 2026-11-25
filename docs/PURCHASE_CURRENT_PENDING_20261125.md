# Conciliación current-pending: contrato incremental

Base Root `20b81b2f`; puerto Root `b19120b0` consumido como dependencia revisada
en la copia aislada. Sin producción, datos reales, Rules nuevas ni cambios Root.

## Modelo y prueba de fuentes

`purchase-current-pending-model.plan` recibe controles exactos
`{id,orderKey,expectedHash}`, original completo, ambos conjuntos de órdenes,
EOF/páginas, referencias P/J/R verificadas, ledgers actuales y dependencias.
El comando no acepta esas fuentes desde HTTP: las obtiene de su puerto privado.

Se suman pendientes conocidos de TODAS las fuentes, deduplicando únicamente
vínculos recíprocos `legacy.migradaA` / `canonical.legacyKey` inequívocos. Los
estados desconocidos, cantidades recibidas ausentes, aliases contradictorios o
pasos pendientes son REVIEW. Canceladas contribuyen cero explícito por su estado,
sin modificar las cantidades históricas. Cada J exige enCompra numérico presente
e igualdad exacta con el total actual calculado; no hay fallback a cero.

El único patch de negocio es la orden original con `inventarioCompra` nuevo.
Baseline inmutable conserva actor/operación/fence actuales, timestamp, hash de
orden anterior a metadata, digest de cobertura y filas con P/J/R original,
ordered/received/pending y hash de fila original. Las referencias iniciales usan
baselineOperationId/baselineRow; nunca un operationId de movimiento inventado.
General, reservado, consumido, enCompra, ledger y costos originales no se escriben.

Para cantidades ya recibidas se exigen capturas económicas completas. En USD se
requiere ARS anterior conocido; no se usa FX actual. Fuentes Sale/List se leen
cuando corresponden y sus baselines económicos deben ser coherentes con las
órdenes. No se reconstruyen recepciones ni se atribuye pasado a General.

## API de composición

Comando interno `purchase-current-pending-reconcile`, modo user real,
financialAction `ordenes.editar`, separado de register/edit/receive y de Host.ready.
Requiere administrador activo, índice de permisos vigente con Compras y
Configuración, edición de Compras y sin veto explícito mantenimiento.migrar.
No se ejecuta incidentalmente al editar o recibir.

Lectura original autorizada: scope.getAsUser orden exacta. Lecturas privadas:
scope.get ledgers, pares y recibos originales de asociación, fuentes y permisos.
Scanner: dos roots exactos, `$key`, limit129, cursor inclusivo de clave segura
1..128, orden RTDB de enteros antes de strings, EOF y límite de páginas failclosed.
No filtros, endAt ni subpaths. Se repiten páginas, EOF y fuentes antes del commit.
Esto acredita cierre frente a escritores SDK cortados y participantes del Guard;
no frente a un Admin externo que escriba entre EOF final y PATCH.

Recibo Guard actual exacto: `{fence,digest,actorUid,result,confirmedAt}`.
Resultado versionado: `{ok,committed,operationId,orderKey,reconciliation:
'current-pending',baselineVersion:1,actorUid,originalOrderHash,rowsHash,baselineDigest}`.
Digest corresponde al wire de tres campos. No se guardan fuentes/ledger en recibo.
History valida ese recibo específico y su binding; committed:true genérico no basta.

## Orden de migración y readiness

El comando de mantenimiento exige enabled, admisión genuina y Guard user sin
readonly global; no depende del ready de órdenes económicas y no habilita SDK.
Root montará el endpoint administrativo explícito
`/compras/ordenes/reconciliar-pendiente`. No se agregan botones ni rutas aquí.
La instalación/corte de negocio no se declara cubierta sólo porque exista este
comando: primero se cierra y verifica el circuito, luego se concilian únicamente
órdenes con evidencia suficiente y se repite la cobertura bajo admisión real.
Installed nunca se rebaja a false para obtener fallback.

## Checkpoint puro

27 tests de modelo PASS: patch sólo metadata, fuentes RAW intactas, cantidades
desconocidas y saldo ausente rechazados, deduplicación recíproca, aliases y moneda,
capturas USD/ARS preservadas. Este checkpoint no acredita comando, montaje HTTP,
Rules ni activación. La composición privada y modelos futuros se verifican en
el bloque siguiente sin cambiar este criterio de preservación.
