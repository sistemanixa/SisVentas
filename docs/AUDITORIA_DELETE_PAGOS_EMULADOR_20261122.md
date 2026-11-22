# Auditoría de cuatro integraciones de eliminación y pagos · 22/11/2026

Fuente fijada: `85e1d9e5650879919cf999695a8f5ecbdf7956e7`, rama aislada `codex/audit-20261122-deletions-emulator`. Se leyeron AGENTS, CONTEXTO_ACTUAL y AUDITORIA_OMISIONES. No se modificaron producto, pruebas existentes, reglas ni expectativas.

## Resultado real

Cuatro archivos ejecutados individualmente: **0 PASS / 4 FAIL / 0 SKIP / 0 cancelados** a nivel de entradas TAP. Las tres pruebas de eliminación fallaron en preparación antes de escribir reglas o datos; pagos falló al importar el archivo antes de registrar sus casos. No son cuatro rechazos de operaciones por permisos del servidor y no prueban cascadas.

| Entrada exacta | Nombre TAP | Resultado y punto de bloqueo |
|---|---|---|
| sale-delete-rules.integration.cjs | actual sale deletion with copied rules retires originals, debt and H7 in one receipt | FAIL: commercial-write-cut-rules → sdk-admission-pause-rules.strip: configuración sdkAdmissionPaused existente no reconocida. |
| ot-delete-user-rules.integration.cjs | copia exacta más Accounts y Operational: caracteriza ausencia de H7 | FAIL: client-account-cut-rules → client-account-rules.prepare: autoridad de cuentas no compatible. |
| ot-delete-action-full-rules.integration.cjs | composición Accounts Operational H7 y veto OT: commit USER y acción SDK | FAIL: mismo rechazo de autoridad de cuentas. |
| payment-scoped-emulator.integration.cjs | test/payment-scoped-emulator.integration.cjs (fallo de archivo) | FAIL al importar línea24: routeStart/routeEnd. El selector literal espera tres rutas; cotizador/index.js:2223 incluye también /laboral/gastos/editar-administrativo. Ningún caso financiero quedó ejecutado. |

La base usada fue exclusivamente `C:/SisVentas/tmp/auditoria-integral-20261122/rules-current.private.json`, SHA256 de bytes y de JSON compacto `ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db`. No se retiraron grants ni se cambiaron pins para hacerla aceptar.

## Entradas históricas y límites

La inspección offline de `C:/SisVentas/tmp/labor-remote-rules-review/before.private.json` dio SHA256 semántico `136954197b29137f0f92f0765dedace395c84d19c316ed02d33958316e83822a`: tampoco la admiten los constructores comerciales/de cuentas. No se ejecutó una matriz con esa base histórica.

Se localizó el pin histórico requerido por payment-scoped: `C:/SisVentas/tmp/labor-remote-rules-review/labor.private.candidate.json`, SHA256 semántico exacto `978cea4169880cd9b5d2782fbe17b7243a2fea562cb1737cb15292ebaa2e1782`. Está disponible; no corresponde afirmar entrada perdida. Su comprobación offline tampoco permite los constructores delete actuales. El import de pagos falla antes de leer cualquier base, por lo que sustituirla no arreglaría esta corrida.

Existen dos evidencias privadas anteriores: `C:/SisVentas/tmp/payment-scoped-emulator.integration.evidence.private.json` y `payment-scoped-emulator.integration.r100.evidence.private.json`, ambas del22/10/2026 y con35PASS/0FAIL/0SKIP sobre pin978cea. Son evidencia histórica, no prueba de la fuente85e1 ni de reglas actuales. No se trasladan sus resultados al contador presente.

## Ejecución y trazabilidad

Node22.23.4 portable existente; Java de Android Studio; emulador database4.11.2 existente. Puertos propios127.0.0.1:9046,9057,9037, comprobados libres antes del spawn, iniciados en secuencia y detenidos en finally esperando child exit. Sólo namespaces demo, sin credenciales reales ni conexiones remotas. Dependencias existentes de cotizador y tmp/firebase-security-tools. El primer arranque restringido falló por conexión local Java denegada; se repitió con autorización de ejecución local y los tres emuladores quedaron cerrados. No se detuvieron procesos ajenos.

Lanzador privado: `C:/SisVentas/tmp/run-deletions-audit.private.cjs`. Logs privados en `C:/SisVentas/tmp/audit-deletions-20261122/`; no versionados y sin expresiones de reglas incluidas en este informe.

| Log privado | SHA256 |
|---|---|
| sale-delete-rules.integration.cjs.private.log | 51d96d09b4560db7ddd645bb4371a8e2536675eeb99fb4b0aa97b082c2b73e19 |
| ot-delete-user-rules.integration.cjs.private.log | 935c5d50f909fe1f12e5f5d762887ff92c7280fb1acaf64a1273c4722e91dafc |
| ot-delete-action-full-rules.integration.cjs.private.log | f95d3804873a8548db1dd756db7da40a031e00e565e545db65c690e3959a090b |
| payment-scoped-emulator.integration.cjs.private.log | 74281d1eb2b5f4a67f79c8ed1539740b234a527371a06d1f6a3e6701300f8043 |

## Siguiente bloque concreto

Preparar una integración nueva que use el router actual, sin depender del literal histórico de tres rutas, y conserve toda la matriz de pagos y sus controles. Separar ejecución histórica con pin978cea de una prueba nueva con reglas actuales revisadas. Para delete, hace falta una composición explícita que acepte la autoridad actual sin retirar protecciones: primero demostrar preservación y rechazos del constructor, luego las matrices completas en emulador propio. No cambiar estos tests/pins para obtener positivos aparentes. Este bloque es diagnóstico: no acredita eliminación real, pagos, comisiones, stock, producción ni autorización para publicar.
