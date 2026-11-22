# Frente B: opt-ins y contrato de protocolo · 22/11/2026

Complemento de `AUDITORIA_B_CLAIMS_PAQUETE_20261122.md`, base autorizada `060c77f8` y correcciones locales `cd9ad6ee` / `f665c2c1`. Sólo revisión local y prueba explícita autorizada; ninguna otra suite general, navegador, consulta remota, instalación, secreto, permiso o despliegue.

## Contrato de reglas y claims: evidencia ejecutada

`test/store-protocol-claims-emulator.integration.cjs`: **19 PASS / 0 FAIL / 0 SKIP**, concurrencia 1, SDK Firebase y emulador RTDB reales. Usa puerto efímero en loopback y proyecto `demo-protocol-claims-20261122`, con red externa bloqueada. Datos, tokens y journal son ficticios. Datos borrados, clientes SDK cerrados y Java propio detenido al terminar.

Es un **candidato mínimo de prueba**, generado por las funciones ya existentes `Policy.metadataRules()`, `Policy.financialRule(2,'false')` y `Protocol.prepare()`. No modifica esas funciones ni ningún archivo de reglas. El permiso original del ramo financiero de prueba está cerrado: verifica que el esquema no lo abra. No representa todas las concesiones, ancestros y descendientes de una captura desplegada. No se cargó ni observó la configuración remota.

| Comprobación | Evidencia |
|---|---|
| Comando válido con esquema 2 | Commit permitido sólo con servicio/fence/actor vigentes. |
| `svLaborService=false`, fence o actor incorrectos | Denegados aunque el marcador sea 2. |
| Revisión de permisos, contraseña pendiente, versión de acceso incorrectas | Denegadas por el contrato de actor. |
| Identidad revocada o reset requerido en servidor | Denegados con las demás marcas correctas. |
| Adquirir lease | Requiere UID exacto del servicio y claim de servicio; esquema 2 solo no basta. |
| Usuario cuyo permiso original está cerrado | No gana autoridad de escritura por esquema 2 ni por el claim de servicio. |
| History / Accounts / Financial instalados | El esquema no reemplaza cada capacidad independiente; sin ella falla, con la correspondiente funciona. |
| Falta `writerSchema`, pero existe un marcador instalado | Gate sticky sigue rechazando esquema 1, incluso con capacidad específica. |
| Journal fiscal | GET, PUT, DELETE y commit mixto denegados; gasto y journal originales conservados. Es protección del candidato cerrado, no demostración de reglas fiscales desplegadas. |
| Store real contra el emulador | Emite 2, neutraliza capacidades inyectadas en Auth a 0, preserva actor/versión y confirma un comando válido sin alterar el gasto ajeno. |

El transporte del último caso convierte el override del store en un JWT **sin firma y ficticio**, aceptado exclusivamente por el emulador. Comprueba origen/namespace antes de enviar; nunca usa ese token con un servicio real. Las credenciales `owner` pertenecen sólo al protocolo local de preparación/limpieza del emulador.

Log privado `C:/SisVentas/tmp/audit-b-20261122-protocol-emulator-final.private.log`; SHA256 `d3a73523cbe0349a7f10411a01a62dd2c090971d800fb7914a93d99fc3f60ebc`. La tanda previa de 14 PASS está solapada: no sumarla a los 19 finales ni a los 35 focales previos.

## Dependencias existentes comprobadas

- Java fuera de PATH: `C:/SisVentas/tmp/sales-indexed31719/java/jdk-21.0.13+9-jre/bin/java.exe`.
- Emulador: `C:/Users/gon_s/.cache/firebase/emulators/firebase-database-emulator-v4.11.2.jar`.
- SDK/rules-unit-testing: `C:/SisVentas/tmp/firebase-security-tools/node_modules`.
- Node 22 portátil ya instalado y dependencias Firebase Admin de Cotizador existentes. No se instaló nada ni se leyó una credencial.

La nueva integración requiere `SV_PROTOCOL_RULES_EMULATOR=1` y `SV_PROTOCOL_QA_OUT`; se ejecutó con el preload local `audit-loopback-only.cjs`. Es `.integration.cjs`, fuera de la selección habitual `*.test.js/cjs` de la puerta.

## Clasificación en lectura de opt-ins existentes

Los 91 SKIP son un agregado histórico de la puerta de la base. Esta revisión no reejecuta esa puerta ni pretende reconstruir cada caso generado desde un conteo estático de archivos. Tampoco resta los 19 casos nuevos a esos 91.

| Archivos/casos relevantes | Puede ejecutarse localmente | Condición o límite concreto |
|---|---|---|
| `labor-runtime-emulator.test.cjs` | Sí, con dependencias existentes | Emulador exclusivo `127.0.0.1:9017`, `FIREBASE_DATABASE_EMULATOR_HOST` exacto y `SV_LABOR_RULES_BASE`. Antes de ejecutarlo hay que revisar compatibilidad de la baseline con `prepare-labor-fence-rules.build`: reconoce hashes y rechaza grants desconocidos. Usa namespace demo y Admin con token owner ficticio, no ADC. |
| `labor-expense-race-emulator.test.cjs`, incluido `fiscal server journal is closed…` | Sí, con las mismas condiciones | Ese caso siembra un CAE ficticio y comprueba GET/PUT/DELETE y patch mixto; no llama AFIP. Sus hooks cargan en **el emulador** el candidato generado desde la baseline. No es una comprobación de reglas remotas sin esa baseline revisada. Se podría seleccionar sólo ese nombre para una próxima tanda. |
| `ot-scope-read-overlay.test.cjs`: 17 hashes retenidos | Preparado para ejecución sin navegador, Docker ni red | Inventario en lectura de `C:/SisVentas/tmp/activation-scope20261110/baseline-server`: 17/17 archivos presentes, 0 hashes diferentes del manifiesto `BASE_HASHES`. No se ejecutó el opt-in. Esta disponibilidad actual no acredita cuándo estuvo disponible durante la puerta histórica. |
| `ot-lifecycle-missing-primary-rules.test.cjs` | Condicional | Dos casos dependen de `SV_OT_LINK_RULES` y `SV_OT_LINK_MODEL`, con forma/hash exactos; no sustituirlos por reglas/modelos actuales parecidos. No se asignaron inputs ni se ejecutó. El caso de forma desconocida es unitario ordinario. |
| `stage-combined-runtime.test.cjs`, `combined-accounts-clothing-overlay.test.cjs` | Condicional | Requieren referencias retenidas completas: `SV_COMBINED_NATIVE_BASE`, manifiestos/digest y referencias Accounts según el archivo. Probar staging/bytes no construye ni ejecuta una imagen. No se configuraron por inferencia. |
| `security-storage.test.js`, `security-auth-order.test.js` y pruebas puras de scopes | No son estos opt-ins | Son unitarios ordinarios de la puerta; no deben declararse pendientes de Java ni contarse automáticamente dentro de los 91 SKIP. |
| Integraciones manuales `*rules.integration.cjs`, presencia, pagos y scopes | Posibles por tandas separadas | No pertenecen por nombre a la selección habitual de la puerta. Algunas exigen puertos fijos, `SV_SECURITY_TOOLS` y capturas revisadas. Inventariarlas no equivale a haberlas ejecutado. |

No se ejecutaron aquí los opt-ins existentes listados: se revisaron sus guardas, hooks y dependencias. El único agregado ejecutado fue la matriz mínima de 19 casos descrita arriba. Previews/presentación quedaron al coordinador.

## Validación que sigue faltando

La corrección de claims no prueba la compatibilidad con todas las reglas realmente instaladas. Falta una tanda con **copia local exacta y revisada** compatible con el builder o con el contrato que deba comprobarse, preservando todos sus ancestros y permisos, más el runtime real y las capacidades activas correspondientes. En particular, el candidato mínimo no comprueba un usuario con permiso financiero original positivo ni la forma completa del journal fiscal desplegado.

La prueba concreta preparada para esa próxima revisión es iniciar el emulador dedicado 9017 y ejecutar, con una baseline expresamente identificada y sin relajar rechazos del builder, los dos archivos `labor-runtime-emulator.test.cjs` / `labor-expense-race-emulator.test.cjs` o primero el caso de journal por patrón. Si la captura no corresponde al builder, hay que informarlo, no reescribirla para hacer pasar los casos. Esto sería carga de reglas de prueba en emulador, nunca una modificación de reglas reales.

Los claims `svLaborService`, el esquema y las capacidades no se activaron en ningún usuario ni servicio externo. Sin cambios de configuración, permisos, reglas fuente o despliegues.
