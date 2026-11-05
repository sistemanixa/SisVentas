# Entrega completa OT compatible con frontend OFF · propuesta aislada

Base `9a84f3d5f1e4728caaeaf39d4fca1fd0463747e5`; rama `codex/ot-complete-delivery-off`. Único archivo de producto: `js/modules/ot-material-custody.js`.

## Contrato conservado

El servidor productivo exacto admite close/custody/return, no delivery/entregas. El frontend anterior 3.18.20 entregaba todos los pendientes con una transformación de OT que actualizaba materiales, custodia, auditoría y remito juntos. Esta propuesta conserva esa entrega completa, con el adaptador vigente de registros/resúmenes y las comprobaciones actuales de sesión y materiales. No renombra delivery como custody ni llama al servidor nuevo.

`SVGuardedWrites.restTransaction` debe delegar en `SVRecordListWrites.transaction`: el adaptador construye un único PATCH atómico con OT, resumen y revisión. El handler exige ese adaptador y rechaza un camino coordinado por LaborWrites; no permite caer al PUT simple de una OT. No modifica stock, ventas, pagos, comisiones ni el nodo independiente de remitos. El remito de entrega vive dentro de la OT, como en la web publicada.

Se conserva la comparación de materiales/técnico con el baseline y la idempotencia del transformador por identificador de remito. Notas concurrentes se conservan; materiales cambiados fuerzan reapertura. El adaptador resuelve conflictos de revisión y puede confirmar una respuesta perdida por su operationId. Si tampoco puede verificar, el reintento con baseline antiguo no duplica: se rechaza y requiere reabrir.

La acción pública entrega TODOS los pendientes elegibles tras confirmación con cantidades. Se retiran los botones nuevos por renglón y se rechazan llamadas con índice: no se promete entrega parcial. En OT cerradas sólo se entregan adicionales explícitos. Esto es compatibilidad OFF; no certifica ni activa el futuro circuito parcial/ON. El resto de custodia/rendición y el lector de remitos se conservan.

## Reglas y alcance de evidencia

Se usó la copia completa `tmp/stage1-integral-plan/return910199-rules.candidate.private.json`, sin modificarla ni publicarla. El comprobante local return910199-rules-applied.private.json registra verificación del corte 2026-11-04T04:12:01.665Z sobre ventas/$venta/.write. OT y su resumen son idénticos entre before/candidate de ese corte.

SHA256 archivo completo: `dee40945c7224f449a1f460193c268796341bd97e3c82c8e00ea236385be1fb7`.
SHA256 JSON.stringify subárbol OT: `68c4bf6cedbbcc3d19866e7de77044b1c1986ce1dc165252b7269c63238fba55`.
SHA256 JSON.stringify subárbol resumen OT: `ff0b5b2a090d340c0b6d99722ce7046898a6b65319c0efcd8266a57623dcdcc5`.

Las reglas exigen revisión nueva y coherencia OT/resumen; la prueba rechaza un PUT sólo de OT, el guard ocupado, pérdida del módulo y un actor sin acciones incluso invocando directamente el adaptador. No hubo nueva lectura remota: antes de aplicar a producción el coordinador debe correlacionar este snapshot con las reglas vigentes, incluidos padres/guard/configuración. No se afirma frescura remota basándose sólo en el nombre candidate.

## Pruebas

Node 22.23.4, emulador RTDB 4.11.2 propio en loopback 9137, namespace ficticio demo-ot-off-compat; ninguna credencial/registro real. `SV_OT_OFF_RULES` recibe la ruta local del archivo de reglas; ninguna regla privada se incorpora a Git.

`node --test test/ot-off-complete-delivery.integration.cjs`

Mismo foco final: base 5 PASS / 7 FAIL; propuesta 12 PASS / 0 FAIL / 0 SKIP. Incluye admin/administrativo, fracciones, una sola entrega/remito, stock/dinero intactos, permisos/rol, revocación antes de PATCH, nota concurrente, cambio de material, doble clic, cambio de sesión, guard ocupado, adaptador ausente, entrada por ítem rechazada, adicionales en OT cerrada, acuse perdido, error antes de commit y verificación posterior indisponible. El estado inicial esperado se toma después de serializar en RTDB, que omite arrays vacíos; se conserva el primer log que detectó esa diferencia del harness.

Focal existente sin cambios: 94 PASS / 0 FAIL / 0 SKIP (`ot-delivery-quantity`, `ot-delivery-receipt-metadata`, `ot-custody-quantity-precision`, `ot-material-state-compatibility`). No se ejecutó gate global ni se modificaron las pruebas del contrato parcial futuro; no se atribuye compatibilidad de ese contrato a esta propuesta OFF.

Evidencia excluida de Git en tmp/ot-off-compat: before.log, before-normalized.log, final-baseline-red.log, final-green.log y existing-focal.log. El foco elimina el namespace y comprueba literal null al terminar. Sintaxis y diff revisados. QA independiente de pantalla/formularios queda al coordinador; no se probó cada formulario.

Sin cambios en app/index/versiones/servidor/flags/reglas; sin publicación, push, datos reales ni interacción con 8765.
