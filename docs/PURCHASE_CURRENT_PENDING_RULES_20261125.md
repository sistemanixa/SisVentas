# Current-pending: checkpoint local, no habilitable

Fuente exportada con `git archive` del commit congelado `531ac358bfa88b5d53598092f45ce7c48fe9f95b`. Reglas efectivas privadas de referencia SHA256 `5a5f7b34de6cbba2ae54517029de956b6be605e21143fe4a86c131255052e48f`. No reglas ni registros privados incorporados a Git.

`test/purchase-current-pending-rules.integration.cjs` usa la fixture nativa de E del paquete congelado: calcula CodePins desde bytes, prepara metadata, firma la activación con digest del candidato real, crea admisión opaca y asociaciones mediante políticas genuinas. La declaración ficticia de cierre de escritores NO certifica producción ni IAM/Admin externo.

Comando actual + Guard + RESTStore reales sobre transporte de memoria capturan UID, claims completos, snapshot previo y PATCH. El PATCH íntegro se ejecuta con autenticación WebSocket del emulador; no Bearer ni claims positivos escritos manualmente. Esto prueba el commit nativo capturado; no representa que cada lectura HTTP del comando haya pasado por el emulador.

Resultado: **5 PASS, 2 FAIL, exit1**. Emulador propio aislado, limpiado y detenido.

- PASS: baseline de orden clásica y resumen curado, recibo real y liberación del guard en un PATCH; replay sin segundo efecto; inventario, ventas, listas y numeración preservados. SourceCost/Stock/Link/Numbering no reciben autoridad artificial.
- PASS servidor: Editar false, Migrar false y cambio de rol rechazan antes de PATCH. Orden fantasma después del EOF rechazada en revalidación fresh.
- FAIL nativo: cambiar `sv_permisos/admin/indiceRevision` o rol admin a administrativo en el snapshot previo, conservando token genuino capturado y lease, permite PATCH (200 frente a rechazo esperado). No se relajaron expectativas ni se agregaron grants. Requiere decisión/cierre acotado del principal antes de declarar puerta verde.

REST devuelve `inventarioCompra.baseline.rows` y `references` con índice 0 como arrays. El positivo compara explícitamente esas dos representaciones sin alterar el resto de la orden; preservación de namespaces se compara antes/después contra REST. El validador de baseline de A debe contemplar la forma real: al leer esta fuente, `object()` excluye arrays; informado al principal como límite downstream, no corregido por B.

Ejecución explícita: Node22, `SV_STOCK_PRESENCE_EMULATOR=1`, salida privada en `SV_STOCK_PRESENCE_OUT`, copia congelada indicada por `SV_CURRENT_PENDING_SOURCE`. Baseline y runtime no se modifican. No pruebas globales, remotos, publicación ni datos reales. Dos intentos iniciales de fixture abortaron por avance de rama y comparación LF/CRLF; no constituyen evidencia funcional.

## Cierre propuesto posterior, pendiente de emisor genuino

`purchase-current-pending-precondition-rules.cjs` agrega sólo AND a cada `.write` existente (incluidos padres, raíz true, comodines, guard y recibo). Se activa únicamente por `svPurchaseSourceCostKind === 'current-pending-reconcile'` y exige Version0, UID/actor/lease/fence/op/digest vigentes, admin activo con rol y revisión de permisos originales, módulos Compras/configuración, Editar/Migrar no false, reset vigente y orden original existente. Kind reservado debe emitirlo exclusivamente SourceProtocol desde SourceAuthority sellada, nunca actor.operation ni JSON cliente. No crea grant, namespace, flags financieros ni familia nueva. Los demás Kind conservan el predicado original.

La composición fija inserta este cierre antes de preservación de ledger y Presence final. Matriz puramente sintética del predicado: 25 PASS (23 condiciones adversariales y controles de padres/OR y conservación). Esto NO es un positivo de negocio con tokens manuales y NO reemplaza los siete casos genuinos pendientes del emisor de Root. Lectura no identificó veto global Version0 con Kind no vacío: ramas SourceV1/V2 exigen Version1/2 para sus grants y permanecen inactivas. No se modificó el SourceProtocol antiguo local.
