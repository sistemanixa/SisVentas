# Expiración real en emulador con reglas compuestas

Estado: cinco pruebas explícitas PASS, cero fallos/omisiones. **No hay activación ni cambios de guard/Store o reglas remotas.** Es evidencia de expiración del fence compartido, no una acreditación completa de permisos de todos los PATCH OT del benchmark.

## Fuentes y aislamiento

La base se leyó de la copia privada de reglas actuales autorizada por el integrador, verificando SHA-256 `ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db`. No se sube esa copia ni el candidato a Git. Se compone sin alterar predicados:

1. `stock-link-rules.prepare(raw,{activationPins}).rules` de `3134eb50fb82f4185d0d667f5d3deec06cf9477e`, con sus dependencias de scope, índices, catálogo, activación y política.
2. `purchase-inventory-sdk-cut-rules.prepare(link,{activationPins})` de `8c48e583272d507cd1ea14e1af753326f15a5c92`.
3. `stock-order-metadata-rules.prepare(cut,{activationPins}).rules` de 3134.

Los nueve módulos se compilan desde blobs Git inmutables, sin importar WIP de otros checkouts. El verificador de activación es el comprometido en `02ee4f6d03acbac48b9c431acb28e25e1b222498`. Los pins son los mismos de la cohorte ficticia del benchmark. El documento firmado usa el digest real del candidato compuesto, conservando idéntico manifiesto/pins. La clave Ed25519 es efímera en memoria y no se exporta. La autoridad es sólo del laboratorio.

Digest del candidato completo: `36311762141b6c92f63d4a92a2990227216b7df08c8970b5e56ab63c8143b2d3`. Fuentes/digests y JSON de reglas quedan únicamente en `tmp/audit-front-d/expiry-emulator/`. Se omitió SourceCost, según el alcance OT indicado por el integrador.

Emulador instalado v4.11.2, Java instalado, proceso propio sin ventana en `127.0.0.1:9087`, namespace nuevo `demo-ot-fast-expiry-<PID>`. Se comprueba que el puerto esté libre antes de iniciar y se cierra el hijo observado al finalizar. Sólo el dueño de la fixture siembra y borra ese namespace. Las escrituras evaluadas usan JWT de emulador con los UID/claims de servicio reales del Store; no el bypass owner. Todo acceso se limita al loopback exacto y namespace propio.

## Casos comprobados

- Un fence vigente coincidente confirma el recibo atómico y libera el guard.
- Un fence coincidente ya vencido no puede borrar el guard ni crear el recibo.
- Una credencial preparada antes de expirar no evita la evaluación del reloj actual del servidor al enviar después.
- Un fence contrario se rechaza incluso con plazo vigente.
- Un comando real de `createLaborGuard` y `createLaborRtdbStore`, con reloj real y lease original de 30 segundos, prepara su PATCH; la fixture lo retiene hasta `expiresAt + 50 ms` y envía exactamente el mismo cuerpo y claims. El servidor responde HTTP 401, el Store conserva el error de operación no confirmada y el guard ejecuta su abort normal. No quedan guard ni recibo y la OT ficticia sentinela permanece intacta.

En el último caso se clona la lease recibida por `acquire` y se reenvía sin cambios. Antes/después de esperar, la lease almacenada es idéntica. Se capturan hashes de cuerpo y override, sin registrar tokens. Para que el timeout HTTP original de 20 segundos no venza antes que una espera artificial de 30, la preparación ficticia consume 11 segundos dentro del callback del guard; al preparar el PATCH quedan unos 19. Se conserva el timeout de 20 y no se renueva ni amplía la lease. El caso tardó 30144 ms y el envío ocurrió 73 ms después de la expiración. El tiempo desde entrada a run hasta el deadline fue 30002 ms porque la lease se creó dos milisegundos después; no se cambió su duración.

La traducción `auth_variable_override`→JWT se hace exclusivamente para autenticar contra Database Emulator. El URL/payload traducido se prepara antes de la retención y no se modifica al enviar; mantiene el mismo UID y todos los claims del override. No es una modificación de identidad ni de permisos del comando.

## Antecedentes conservados y límites

El primer lanzamiento quedó bloqueado por permisos de loopback; la repetición autorizada usó el mismo emulador local. La prueba positiva inicial omitía el recibo atómico, por lo que su rechazo no se consideró evidencia de expiración. El positivo corregido y los negativos pasaron primero contra la base íntegra. Dos intentos de composición detectaron dependencias no inventariadas de scope/índices; se completó el inventario desde Git antes de repetir. El primer caso de retención llegó al timeout HTTP y **no** se contó como rechazo de reglas. Se conserva su log separado. No se debilitó ningún predicado para obtener verde.

Resultado final: `tmp/audit-front-d/ot-fast-expiry-composed-final.log`, cinco PASS, SHA-256 `12cd901fbfe633704622e4f054179f7e2b7e8687f16c6897a00b357e03ebb256`. Evidencia de lease/cuerpo/override/HTTP/abort en `expiry-emulator/flight.private.json`, SHA-256 `bb58700b0ca3a626e21de584127b758886091f605ccaabfeab596181513024b4`; sólo hashes y metadatos ficticios. El benchmark completo de 641 productos permanece en el commit anterior `4416e5c996f198cc6eeeeba9f4929b901c64dc3e`; no se repitieron las nueve celdas. Acreditar el fence común con el recibo atómico no equivale a recorrer todas las validaciones de inventario, índices y permisos de una OT real bajo la candidata completa.

Repetición explícita, con la base privada disponible y guardia de red de la auditoría: preparar el núcleo con `node test/helpers/stock-reference-committed-core.cjs`, definir `SV_OT_EXPIRY_EMULATOR=127.0.0.1:9087` y ejecutar `node --test test/ot-fast-lease-rules.integration.cjs`. No instala dependencias ni usa credenciales reales. El helper permite rutas/hash alternativos sólo mediante parámetros de entorno explícitos; el caso siempre exige el digest revisado y loopback exacto.

ON continúa OFF. El costo pendiente de alias, el resto de la cohorte, empaquetado y permisos integrales se cierran en integración central. La continuidad y el estado externo del proyecto no se deducen de este commit local.
