# Frente B: baseline completa y contrato de comisión · 22/11/2026

Base de código local autorizada `060c77f8`, con correcciones claims/empaquetado del frente B. El coordinador proporcionó una captura RTDB privada de 3.576.401 bytes, SHA256 `ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db`. Hash comprobado antes y después. Sólo se leyó esa copia; no se obtuvo otra ni se modificó. No se incorporan sus bytes o expresiones a este documento, Git o logs.

## Contrato de las cuatro pruebas de comisión

Commit separado `c5b76030de6aaff9351941e46d3b82fc2465e3fe`, únicamente `test/commission-write-proof.test.cjs`. No cambia código productivo ni la autorización para comisiones.

La expectativa anterior de esquema ausente para escritores user/server/command/bootstrap contradice la semántica canónica ya probada: el esquema identifica el protocolo del store, no una capacidad de asignar comisiones. Por ello ahora exige 2 en los cuatro modos y conserva **todos** los controles de prueba de comisión: versión 0, kind/venta/empleado vacíos y revisión null sin prueba emitida, OT operacional 0 y PaymentIndex 1. Refuerza la inyección adversaria de esquema 999 y capacidades History/Accounts/Financial 1: deben quedar en 0. Conserva marcas de versión de acceso y contraseña pendiente para usuario y comando.

No se sustituyó la capacidad WeakSet por un booleano. Los ocho casos de prueba falsificada/trasplantada y el caso positivo de prueba emitida siguen vigentes. La política compone sus gates con la autorización previa mediante AND: el esquema no abre una autorización originalmente cerrada. Las matrices mínimas del documento anterior lo verifican en emulador, incluyendo servicio, identidad, actor, fence, revisión y sesión.

Tanda focal posterior: **38 PASS / 0 FAIL / 0 SKIP**, red totalmente bloqueada. Log privado `audit-b-20261122-commission-schema.private.log`, SHA256 `f1d284a827f8f2eff74996b647362374347f0a897c577f22d5933d8225ddf26b`.

## Carga íntegra de la captura: diferencias preservadas

El opt-in manual `store-protocol-claims-emulator.integration.cjs` acepta ahora `SV_PROTOCOL_RULES_FILE` y exige `SV_PROTOCOL_RULES_SHA256`. Pasa el texto íntegro al emulador sin transformar ni componer reglas. Sin ese archivo conserva el candidato mínimo anterior. El emulador siempre es propio, en loopback/puerto efímero y namespace demo; tokens, datos y preparación son ficticios.

La primera ejecución sobre la captura completa reutilizó los 19 casos mínimos: **11 PASS / 8 FAIL**. Se conservan los rojos. Ocho operaciones que la fixture mínima consideraba positivas fueron denegadas; incluían un payload financiero construido directamente sin el circuito completo de acción/índices. No se atribuye cada rechazo a una causa única ni al marcador canónico. Tampoco se usan los negativos como demostración individual de cada guarda mientras su control positivo de commit era inválido.

Sí se verificó el rechazo del journal a GET/PUT/DELETE y patch mixto, y la adquisición de lease por la identidad de servicio correcta. Un control posterior de sólo recibo/liberación, sin payload financiero, confirmó positivamente el contrato de metadatos. No se añadieron claims ni grants a las reglas para obtenerlo.

Huella de los nodos inspeccionados, sin expresiones: `sv_labor_guard/.write` SHA256 `b20d34eab00d51c00c6e082f76fd7a938af6df480b09ecf490782acee518fcc9`; `sv_labor_receipts/$op/.write` `ed205d0cd376137a3b45122f6bc93d62d838b3ddad847edb7ab2cd91dcfe1203`; `sv_labor_indexes/.write` `eae693142ab0b8c924ddaeb4c618ad9084f9cf2516bff1fd15f52df434ccb2fc`. No se declaró que History/Financial del candidato mínimo estuvieran desplegados en la captura sólo por aparecer en código.

## Control positivo completo y revocación sobre la captura

Se identificó la integración existente `test/admin-expense-rules.integration.cjs` y se tomó su circuito fiel para un caso explícito, sin modificarla. Usa `createAdminExpenseCreate`, validación/access del modelo, `Permissions.build`, `Index.buildIndex`, guard real con proyecciones, store REST real y record lists. No es un PATCH financiero armado a mano para sortear las reglas.

La tanda final seleccionó **2 casos PASS / 0 FAIL / 0 SKIP**:

1. Recibo/liberación de lease sin payload financiero.
2. Circuito completo de Gastos, con cuatro escenarios independientes de datos ficticios. El válido confirma un gasto y un recibo. Revocar identidad, cambiar revisión de permisos o exigir reset justo antes de enviar el PATCH rechaza el commit con `SV_LABOR_COMMIT_UNCONFIRMED`, sin gasto o recibo nuevo y liberando el lease. Compara ventas y pagos enteros y todos los índices con `Index.buildIndex` del estado resultante.

La semilla usa módulos/acciones ficticios coherentes con el modelo, configuración del circuito e índices derivados por las funciones existentes. No representa configuración real de usuarios ni la activa en producción. No se alteraron las reglas capturadas. No se usó el puerto 9046 ni se compitió con el frente E: ambas tandas reservaron un puerto efímero.

El caso completo y el control de metadatos requieren explícitamente una baseline completa: sin `SV_PROTOCOL_RULES_FILE` quedan SKIP, separados de los 19 del candidato mínimo. No se borraron casos ni se cambió una expectativa de los ocho rojos para hacerlos pasar. La captura no se fuerza a satisfacer la fixture financiera mínima.

## Repetición acotada

Con los mismos Node/JRE/jar/SDK existentes del informe anterior, establecer `SV_PROTOCOL_RULES_EMULATOR=1`, `SV_PROTOCOL_QA_OUT` privado y los dos valores de archivo/hash proporcionados por coordinación. Usar el preload `C:/SisVentas/tmp/audit-loopback-only.cjs`. Desde el checkout integrado:

```powershell
& C:/SisVentas/tmp/node22-portable-20261104/node.exe --test --test-concurrency=1 --test-name-pattern='complete existing expense|metadata-only receipt' test/store-protocol-claims-emulator.integration.cjs
```

La preparación escribe sólo datos y reglas de prueba en el emulador; nunca usa un destino remoto. Limpia sus datos, clientes SDK y espera la salida del Java propio al terminar. No requiere secretos ni instalaciones.

Logs privados separados:

| Tanda | Resultado | SHA256 |
|---|---|---|
| `audit-b-20261122-complete-rules.private.log` | 19 mínimos: 11 PASS / 8 FAIL | `2facddb0711b0be05407fce97620f95bf51f82d807a060fbbf3428dd98f5b19f` |
| `audit-b-20261122-complete-rules-control.private.log` | Control inicial de metadatos: 1 PASS | `65c4f68238354ec8cf732088d098f4c462d14b15ba92dda81aa9a110fc2afba7` |
| `audit-b-20261122-complete-expense-final.private.log` | Dos controles finales: 2 PASS | `972f00319b3b0777fc25ff0fa264f24f2b175216411783e99a63de343ad70574` |

El control inicial y la primera tanda completa de Gastos se solapan con la final: no sumar sus escenarios como casos adicionales ni fusionarlos con las 38 pruebas focales. El contrato completo de ejemplo demuestra compatibilidad de ese camino y sus tres revocaciones, no de todas las operaciones comerciales o todas las capacidades futuras.

Sin reglas o permisos modificados, datos comerciales reales, llamadas fiscales, navegador, build, despliegue ni secretos. La suite general y la integración siguen centralizadas.
