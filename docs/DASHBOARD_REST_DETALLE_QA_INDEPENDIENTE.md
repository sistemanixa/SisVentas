# REST y detalle puntual: revisión independiente

## Cierre independiente sobre f23a5124

04/11/2026. **Falla del editor retirado cerrada** en `f23a51240bb9129ca79e221d66b65519d7ce8ac6`. La evidencia roja de08267 que sigue abajo se conserva como antecedente histórico. Repetición serial independiente: **24 PASS, 0 FAIL, 0 SKIP**, con11 casos del helper, siete propios (incluye Chrome), cinco Chrome de navegación y uno de reentrancia del coordinador. Mi test conserva SHA256 `69530ec0d219ddee1190bfec58d152c661d2ff443479b0da4e0137cdb1e37f24` sin cambios de fuente ni expectativas.

El cambio de dataEpoch después de abrir el editor ahora oculta el formulario y limpia su identidad. También pasan el retiro durante preparación, el retiro dentro del callback y la preservación de un editor reemplazado con igual clave pero otra base. Retorno,403/404, salida durante GET y visibilidad siguen pasando. No se añadieron escenarios ni se amplió el alcance.

Comando: `node --test --test-concurrency=1 test/dashboard-budget-notice-detail-runtime.test.cjs test/dashboard-notice-rest-independent.test.cjs test/dashboard-budget-notice-detail-native.integration.cjs test/dashboard-budget-notice-editor-reentry.test.cjs`, con `NODE_PATH=C:/SisVentas/cotizador/node_modules`, `SV_DASHBOARD_NOTICE_INDEPENDENT_NATIVE=1`, `SV_BUDGET_NOTICE_DETAIL_NATIVE=1` y acceso loopback. Log privado `C:/SisVentas/tmp/dashboard-notice-editor-f23-independent.private.log`, SHA256 `2c606b3d0d76caebf97708b17c6b65de6b8d6288e635bb0ed7a4d850c7f53744`. Helper ensayado blob `38077ad2c5197963aedcd1925c2686b87c6d3331`, SHA256 `f02e05e0c25858f0fcc5552588a859bdf962aad2ba54c83669bd4bfc2fdb223e`; coincide con el freeze.

Se mantienen los límites: backend/token ficticios en Chrome, sin Auth/RTDB reales, guardado posterior al retiro, montaje completo de consumidores, minimización física ni puerta general. Sin cambios funcionales, staging, publicación o recarga del usuario. Sólo se actualiza este documento propio; el contexto compartido queda a cargo del coordinador.

04/11/2026. Freeze `08267f5c61375885b50516401aa89fbff309ac53`. Alcance: transporte REST preparado, autorización del detalle, fuente separada, cambios de epoch y retorno. Sin cambios funcionales, staging, puerta general, datos reales ni publicación.

## Falla reproducible: editor visible tras retiro

**Pendiente de corrección.** Abrir aviso puntual, entrar al editor y cambiar `dataEpoch` emitiendo `sisventas:data-state-changed`: el host retira el registro y su fuente, pero deja visible `#ppto-form-view`. `reset()` sólo oculta el detalle; la limpieza del formulario y de identificadores de edición está en `back()`, que ya no puede reconocer la entrada retirada.

La prueba propia `test/dashboard-notice-rest-independent.test.cjs` conserva dos reproducciones: unidad (formulario abierto mediante callback del host) y Chrome (HTML/app integrados, navegación y formulario reales del fixture). Ambas fallan en la expectativa de ocultar el editor. El caso pendiente de preparación sí pasa: retirar el epoch antes de completar la carga impide invocar el editor. No se intentó guardar después del retiro y no se afirma que esta falla permita escrituras no autorizadas.

Reproducción Chrome: definir `NODE_PATH=C:/SisVentas/cotizador/node_modules` y `SV_DASHBOARD_NOTICE_INDEPENDENT_NATIVE=1`; ejecutar `node --test --test-name-pattern='Chrome:' test/dashboard-notice-rest-independent.test.cjs` con acceso loopback. El fixture captura un contador mutable de datos; no altera la fuente funcional. Log `C:/SisVentas/tmp/dashboard-notice-082-editor-epoch-chrome.private.log`, **0 PASS / 1 FAIL**, SHA256 `e8dcaba83901af012e4c16fc28106d2e529f018cdae78619e18e1b02bb748ef7`.

## Verificaciones aprobadas

- Foco sin Chrome: **42 PASS / 1 FAIL / 0 SKIP**, incluyendo los 17 Source/Readiness independientes intactos, nueve casos del helper, dos REST, nueve montaje y seis controles propios. La única falla es el editor retirado descrito arriba. Log `dashboard-unit-082-independent-after-nodepath.private.log`, SHA256 `c862754e528dd6aea797b81ccd65fa3639a0b6e0d8962571eaecc90d9e43caf7` (en tmp). El test Chrome propio se agregó después y se ejecutó por separado; no se lo cuenta en esos43.
- Los cinco Chrome existentes: **5 PASS / 0 FAIL / 0 SKIP**. Escritorio1280/móvil390, apertura por fbKey con apóstrofo, teclado/edición/retorno, actor inactivo403 y clave ausente404 sin fallback a lista, salida durante GET y visibilidad. `pptoData` permanece vacío en apertura puntual y Readiness exige `budgetNoticeDetail`, no `presupuestos`. Log `dashboard-notice-082-chrome-independent-loopback.private.log`, SHA256 `57462683d66f380e24a1e1643be53826ce83de9a013a300e77499db08cce44eb`.
- REST: límites inválidos (0, fracción,51, UID>2, combinaciones/campos no permitidos) rechazan antes de credenciales o HTTP. 401/403 se propagan como403 y500 como503, cancelando cuerpo, sin retry ni snapshot cacheado. La fachada es sólo lectura. Los lectores montados siguen verificando autenticación, grants y cobertura; la fachada usa credencial de servicio y no constituye por sí misma una frontera de autorización por usuario.

Primera corrida focal sin NODE_PATH:32PASS/5FAIL por Playwright ausente en carga de index/payload. Repetición con dependencia resuelta conservó expectativas. Primer Chrome: bloqueo sandbox `ERR_NETWORK_ACCESS_DENIED` al loopback; repetición permitida produjo los5PASS anteriores. Logs iniciales privados `dashboard-unit-082-independent.private.log` y `dashboard-notice-082-chrome-independent.private.log`; no se confunden con fallas funcionales.

## Fuente y límites

Blobs revisados: helper detalle `f4d3f1b10fd4d3ad32ed6f9678f711cc76ff9714`; fachada REST `236e7607c3c97ea662a4c088d1a0cd2cbe6d9cc4`; store `3def4086478858f109427c77466160a9de758ae8`; app `c42033541418549e4966d3c40337f07dbb6ef757`; Readiness `4ed49aae1fee609fdf366e25b21b6ebbeaa49d38`; notifications `997f666cbfc2d3022684d205fe673e46363aad07`.

Chrome usa backend y verificación de token ficticios, con lógica real de authorize/visibleRecordsByIds. No ejecuta Auth real, indexservidor ni RTDB remoto. El GET puntual mantiene aislado el original; entrar al editor sí prepara sus fuentes propias y permisos. No se acredita arranque completo de producción, todas las acciones de edición, minimización física ni activación de flags. El atributo whitespace compartido queda al coordinador; no se tocó el patch legítimo. Documento/contexto y corrección funcional se integrarán por el coordinador.
