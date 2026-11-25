# Constructor conjunto B: checkpoint local 25/11/2026

`scripts/lib/inventory-current-rules.cjs` exporta `prepare(baselineBytes,{activationPins})`, `BASELINE_SHA256` y `STAGES`. Es puro: recibe Buffer/string, no lee archivos, red, secretos ni configuración remota. Sólo acepta los bytes originales cuyo SHA256 es `5a5f7b34de6cbba2ae54517029de956b6be605e21143fe4a86c131255052e48f`; rechaza objetos, otro baseline, pins ligados a otro baseline y opciones adicionales. No modifica la fuente ni acepta constructores/callbacks de autoridad del consumidor.

Orden fijo de composición:

1. `inventory-combined-rules`: catálogo/vínculos e índices, corte SDK, metadata StockOrder, SourceCost V1, cierre de scope Link1 y History/Financial, validadores de resumen.
2. `inventory-installed-rules`: instalación persistente y cierre SDK aun cuando se retire o rompa la activación.
3. `inventory-catalog-interlock-rules`: restaura exclusivamente autoridad original por registro del catálogo bajo interbloqueo; conserva stock/stockReal crudos. No concede escritor de servidor nuevo ni escritura de colección cuando está instalado.
4. `purchase-source-cost-v2-rules`: prepare/reconcile y receive conjunto con relación original Sale↔List, contexto conjunto, revisiones y condiciones History/Financial. SourceV1 se conserva como rama separada.
5. `purchase-numbering-rules`: allocation privado sobre bootstrap existente; contador y órdenes requieren las capacidades genuinas A y los demás permisos de negocio.
6. `inventory-ledger-preservation-rules`: preservación del ledger incluyendo permisos heredados.
7. `office-stock-precondition-rules`: condición atómica de existencia para TODOS los grants existentes; obligatoriamente último paso.

`preparedFinancial` está fijado a false. No compone los opt-ins History/Financial ni cambia sus flags. Si ya estuvieran instalados en un baseline futuro, ese baseline requiere revisión nueva; no se omiten sus condiciones para que un fixture pase. No se incorpora el WIP3651 ni familias OT provisionales.

El resultado `{rules,manifest}` incluye etapas/digests, diff de atributos con hashes (sin copiar expresiones en el manifest), bytes/digest de candidata, `presenceAppliedLast:true`, `activated:false` y `readyForActivation:false`. Verifica que permanezcan iguales las cuatro autoridades raíz y que cada `.write` no cerrada tenga la condición Presence exterior. No escribe ni instala la candidata, activación, marker ni metadatos. El digest firmado debe calcularse sobre `JSON.stringify(result.rules)`; los pins de prueba no acreditan un despliegue.

## Dependencias exactas para integración

El nuevo constructor requiere siete constructores directos: inventory-combined-rules, inventory-installed-rules, inventory-catalog-interlock-rules, purchase-source-cost-v2-rules, purchase-numbering-rules, inventory-ledger-preservation-rules y office-stock-precondition-rules; además stock-link-activation-contract. Sus componentes B ya entregados están en `28972199` (núcleo/constructores), `22ad955e` (office-stock-order/classify), `ab7e0418` (numeración), `da0f3971` (Presence); no copiar ramas completas ni Guard/Store/runtime históricos.

Transitivos de reglas: catalog-write-fence-rules, purchase-inventory-sdk-cut-rules, purchase-source-cost-rules, stock-link-activation-rules, stock-link-index-rules, stock-link-rules, stock-link-scope-rules, stock-order-metadata-rules y stock-order-summary-rules. Del dominio existente: labor-fence-policy, sale-financial-dependencies-protocol y office-stock-order con sus dependencias públicas actuales. No requiere como imports del constructor políticas A/E/D ni módulos privados recuperados de imagen. Los comandos de negocio sí requieren las capacidades A/E/D y hooks genuinos montados por Root: esto no los sustituye. El protocolo SourceCost usado por el Store y los modelos A se mantienen bajo sus propietarios.

Consumo desde un fixture que ya tiene bytes del baseline revisado:

```js
const Builder = require('./scripts/lib/inventory-current-rules.cjs');
const candidate = Builder.prepare(baselineBytes, {activationPins});
// El fixture firma candidate.manifest.candidateDigest y usa candidate.rules.
// No aplicar constructores adicionales después del cierre Presence.
```

## Evidencia y límites

Nueve comprobaciones focales PASS, cero FAIL/SKIP: constructor rechaza baseline no revisado; overlay Presence compila sobre5a; constructor conjunto completo compila en el emulador; cuatro variantes adversariales de autoridad heredada conservan7 ante PATCH3 y admiten altas null→3/null→0; dos pruebas unitarias de cierre sin concesiones. La prueba conjunta conserva los validadores originales de general en inventario/resumen, no crea roots History/Financial y rechaza preparedFinancial=true/pins ajenos. Con los pins ficticios del fixture combinado: candidata4.199.582bytes,260atributos distintos. El tamaño/digest final variará con pins finales.

Ejecutar explícitamente `test/office-stock-precondition-rules.integration.cjs` con `SV_STOCK_PRESENCE_EMULATOR=1` y `SV_STOCK_PRESENCE_OUT` hacia salida privada; el harness inicia sólo su emulador loopback, verifica SHA de fuente privada antes/después y limpia/detiene su proceso. Unitarios en `test/inventory-current-rules.test.cjs` y `test/office-stock-precondition-rules.test.cjs`. No añade pruebas remotas a la puerta ordinaria.

La candidata conjunta se probó en compilación/preservación, no como todos los comandos A/E/D ejecutados juntos. Root comunicó aparte E8/8 con command+Guard+REST+Rules y Presence integrado sobre freeze1b990; eso no se atribuye a esta nueva candidata. Pendientes: descriptor/checkpoint OT definitivo, composición fija de sus familias antes de Presence, circuito completo con capacidades genuinas y Rules conjuntas, cierre de escritores/preparación y puerta de publicación de Root. No hubo publicación, corte remoto ni datos reales de prueba.
