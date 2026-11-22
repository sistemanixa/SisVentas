# Identidad histórica: contrato de fase para D/A

Callback implementado `resolveReference(original, ports)` ahora llama `identifyOriginal(stored, selector, {read,query})`. Esos puertos pertenecen a ESTA resolución/fase; sus lecturas y consultas se registran para freshCAS. No capturar un ledger anterior ni usar un hint del formulario como evidencia. OFF no invoca el extractor ni añade I/O al recorrido legacy.

Resultado del extractor interno del dominio: `{productKey?, inventoryKey, receiptIdentityKey?, aliases?, history:{kind,sourceHash,verifiedReads}}`.

- kind=confirmed exige receiptIdentityKey histórico válido. sourceHash debe coincidir con el original fresco; verifiedReads debe incluir el ledger físico completo y referirse a lecturas realmente hechas mediante el puerto de fase. Si hay mapping, su identidad histórica debe coincidir exactamente. No recanonizar una vieja entrega.
- kind=absent sólo se emite después de probar ausencia de recibo/historia relevante en original/ledger/historial por el dueño del dominio. No se envía un receiptIdentityKey provisional. El núcleo exige sourceHash y lecturas verificadas del ledger real; con mapping obtiene receiptIdentityKey de ese mapping autoritativo, permitiendo L→primeraD. Sin mapping conserva el resultado legacy.

La prueba estructural del núcleo no sustituye el verificador semántico de D: D debe rechazar una supuesta fila nueva si tiene entrega/devolución/remito/stockRegistro/origen histórico o evidencia de un recibo previo, aunque instalada=0. Una bandera ausente o un campo history proveniente del cliente no demuestra ausencia. El extractor es código de servidor sobre el original, nunca JSON de body. No se relajan guards, firmas, remitos o validación física.

readSet conserva entradas de lectura `{path,hash}` y de consulta `{kind:'query',path,field,value,hash}`. `assertFresh(readSet, readFresh, queryFresh)` repite las mismas consultas; si falta queryFresh para una consulta histórica, falla cerrado. D/A deben registrar este assert en beforeCommit. No entregar readSet a UI. La firma query equivale al puerto existente de igualdad; rangos de cobertura dirigida de catálogo tienen contrato propio queryPage y aún no están conectados aquí.

Pruebas del core real:17PASS de puerto, entre ellas primera entrega trasmapping con evidencia de fase, vieja entrega con identidad confirmada, rechazo de ausencia no leída, recanonización y cambio de membresía en historial. La prueba de primeraD verifica el contrato de provisión de evidencia con datos ficticios; no se afirma la matriz completa de entrega/instalación/devolución del servicio D. Esa composición sigue pendiente del dueño D.

Cobertura dirigida de catálogo:2121bfc4 aporta8PASS de rangos/tipos/prefijos y phantoms, sin espejo global. El callback/command aún utiliza loadCoverage provisional con evidencia en namespace de config/index: no se activará ni se retirará esa dependencia hasta completar cobertura autoritativa de inventario/mappings/historia y su emulador. La activación privada/cohorte es distinta de datos de producto. Todo sigue OFF.
