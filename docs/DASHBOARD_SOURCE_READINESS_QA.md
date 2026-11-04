# Bridge de Presupuestos: Readiness real y sesiones

## Ampliación sobre Source congelado cf9bb1e2

04/11/2026. Fuente `cf9bb1e2a790453328eef2974cb3b831e761017c`, mismos bytes en `53b8f128`: blob Git `b76fc2c5c9bba56bc20570be090a66dd29a7e186`, SHA256 `14fb74842660b7559b2895b30fdd30f3e60d18596cee19cf7ab31a808fd1060b`. Se repitieron primero los once casos anteriores intactos: **11 PASS**. Después se añadieron seis casos: **17 PASS, 0 FAIL, 0 SKIP** en total.

- `SV_BUDGET_SDK_RETIRED` tras cambiar sólo `connectionEpoch` conserva datos y aviso de error bajo la misma autoridad. `ensure` no repite lecturas; un refresh explícito válido renueva la vista y limpia el error. El consumidor hermano sigue listo.
- Cambiar en sitio cualquiera de los cuatro grants (`ventas`, `pagos`, `ordenes_trabajo`, `presupuestos`) retira ambas cachés y sus certificaciones reales de Readiness, aunque rol, firma de configuración, sesión y User permanezcan iguales.
- `dataEpoch` ausente, null, negativo, fraccionario, string o NaN rechaza antes de iniciar lecturas del SDK. Los dos controles anteriores de reset siguen pasando.

El caso SDK_RETIRED inyecta el error en el puerto de lectura; verifica la reacción del Source, no reproduce aquí el transporte de una desconexión real. Se mantiene el uso de Readiness real y de SDK/DTO reales para las lecturas correctas del fixture. No se modificaron Source ni Readiness: hashes antes/después idénticos; test ampliado SHA256 `a8c2d28cc50040d3ad3b4aa1dbd076ddcab8635f5572e62100508365381a6e65`. Logs privados `C:/SisVentas/tmp/dashboard-budget-source-readiness-cf9-original11.private.log` y `C:/SisVentas/tmp/dashboard-budget-source-readiness-cf9-extended.private.log`. Se conservaron las evidencias rojas históricas de abajo.

Sintaxis del test y `git diff --check` correctos. No se ejecutó puerta general ni se verificó HTML, montaje visible o producción. Sólo test y este documento propios; sin staging ni commit por indicación del coordinador. La actualización del contexto compartido queda a cargo de la integración.

04/11/2026. Revisión independiente del bridge propuesto, sin montaje en aplicación ni edición de runtime compartido. `test/dashboard-budget-source-readiness-independent.test.cjs` carga `js/core/data-readiness.js` real en VM y usa el lector SDK real con DTO proyectado real; DOM, transporte de snapshots y solicitudes host son fixtures en memoria. No usa un mock de los handles de Readiness ni fabrica los resultados finales del lector SDK.

## Defectos reproducidos y preservados

- Primera fuente WIP `909110abe7ccc1f11387e457deff7c31422301ab4fe0818d49679c2abb497370`: 4 PASS / 2 FAIL. Al cambiar UID/rol/sesión, una demanda del otro kind dejaba readiness del contexto anterior certificado; consultar ese consumer antiguo cancelaba la nueva demanda legítima. Log `C:/SisVentas/tmp/dashboard-budget-source-readiness-independent-before.private.log`, SHA256 `494f8e612ba44fe8446fb07427ee0de3b4ed5296382c0526f15c9410dbfc65ff`.
- Fuente `4dec3f6648c3cb4ae922a047624da4bb1a6a8529`, bridge SHA256 `ac29ab7ae6510353b6ec40840795729c602fe8d8ec0302b9f9b808858400723e`: 7 PASS / 2 FAIL tras agregar tres controles de bloqueo403. Cruce entre kinds seguía fallando. Log `dashboard-budget-source-readiness-independent-4dec.private.log`, SHA256 `c706b60587ff8ccb6cdf5764247f38f07ee4039015e40210bd0b0581ef44b582` (mismo directorio tmp).
- Sobre esa misma fuente se agregaron dos casos de reset `dataEpoch`, conservando los nueve anteriores: 7 PASS / 4 FAIL. El resultado cacheado anterior al reset se reutilizaba y un pending anterior podía certificarse con Auth/User/epoch de sesión idénticos. Log `dashboard-budget-source-dataepoch-before.private.log`, SHA256 `c5675f8e3b2ac0066d829c9ee0d3f2d5e1402c00edcfdcd8d1636b6b1aeccb4b`.

## Repetición después del arreglo del coordinador

**11 PASS, 0 FAIL, 0 SKIP**, manteniendo exactamente las once expectativas y el test de hash `1c47186e71a1e1a13da2b8c49c04e8bc33f66cbe72aaf106e5c646887d0dfd0c`. Fuente bridge local ensayada SHA256 `afdcb6a9c5258bc69a43776172a0f443778e4ccccd2856a3040bd53bde43f860`; todavía parche del coordinador sobre 4dec al ejecutar, no se atribuye al commit 4dec original. Readiness real SHA256 `ed204ee254b2d9c26b271d6761c64a546b23bd83abd666af3b1394eb49a9114d`.

Se verifican deduplicación de demanda, datos visibles durante refresh, error con datos previos sin cero falso ni retry por render; claves `dashboardBudgets` y `dashboardBudgetNotices` sin certificar `presupuestos`; retiro de ambos consumers y settlement del pending ante403; bloqueo del mismo contexto después de403 sin nuevas lecturas, con retry explícito o contexto nuevo permitidos; aislamiento de roles/kinds y resets `dataEpoch` sin cambiar Auth/User/sesión. No se agregaron exigencias `dataEpoch` al lector SDK: pertenece al pin del host/bridge.

Log final `C:/SisVentas/tmp/dashboard-budget-source-readiness-independent-after.private.log`, SHA256 `0e871d6caee9189c173ddc7648f86b8b3518bd932ba87829d7cce96ed454dfbf`. Hashes antes/después idénticos en `dashboard-budget-source-readiness-after-before-hashes.private.json` y `dashboard-budget-source-readiness-after-after-hashes.private.json`, dentro de tmp. Sintaxis/diff correctos.

Límites: no es recorrido de ventana ni reglas/Fresh nativas, ya documentados por separado. `requestAnimationFrame` y DOM son puertos simulados; no se prueban render, pila visual ni deadlines propios de Readiness. El bridge no incorpora sondeo/reloj y los tests no disparan timers, pero no se afirma que el host/Readiness completo carezca de temporizadores. Falta montaje, captura real de `_svDataEpoch`/sesión/permisos y eventos del host. Sin publicación, remotos ni datos reales. El commit de esta revisión contiene exclusivamente test y documento propios; el arreglo funcional pertenece al coordinador.
