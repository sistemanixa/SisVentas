# Auditoría de los 22 fallos de v3.20.12

Fecha: 14/11/2026. Fuente inspeccionada: 863917e8, checkout sin cambios previos. No se modificaron runtime, versiones ni expectativas. Sin operaciones reales ni red de producción. Ejecución actual con Node v24.17.0; log original con Node v22.23.4: no son entornos idénticos.

El log `frontend12-current-tests-chrome.private.log` contiene exactamente 22 entradas `not ok`. Los números TAP son locales a cada lote y no identificadores globales. Inventario completo:

| # | Archivo / caso original | Evidencia de esta revisión |
|---|---|---|
| 1 | client-history-bootstrap: prepared public index…disabled | Archivo actual PASS, pero caso renombrado a final release enables reviewed Accounts; no es repetición literal de expectativa histórica. |
| 2 | client-open-intent-audit: Account ledger…inert | PASS actual. |
| 3 | commercial-writer-protocol-rules: store overwrites reserved claims | Reproduce FAIL undefined frente a schema 2. |
| 4 | commission-private-extra-surfaces: formulario genérico | PASS actual, antes faltaba queueMicrotask en VM. |
| 5 | cotizador-container-dependencies: dependencias COPY | Reproduce FAIL, 6 referencias correspondientes a 4 módulos. |
| 6 | dashboard-backend-mount: Docker COPY payload alone boots | Repetición no concluyente: falta módulo playwright antes del fallo original budget-presentation-trial. |
| 7 | employee-clothing-integration-review: archivo completo | Ahora 7 casos PASS; antes fallo de carga a nivel archivo. |
| 8 | gastos-form-return-native: retorno 390 | No ejecutado: falta módulo playwright actual; originalmente ejecutable headless ausente. |
| 9 | gastos-form-return-native: retorno 768 | Mismo bloqueo; no ejecutado. |
| 10 | gastos-form-return-native: retorno 1280 | Mismo bloqueo; no ejecutado. |
| 11 | gastos-form-return-native: legacy display-only return | Mismo bloqueo; no ejecutado. |
| 12 | labor-writes: actual account host switches… | PASS actual. |
| 13 | labor-writes: a cut between mode check… | PASS actual. |
| 14 | ot-delete-index-route: resultado incierto | Reproduce FAIL textual: espera Consultá la operación, recibe Consultá el intento antes de repetirlo. No prueba eliminación confirmada ni error privado filtrado. |
| 15 | sale-delete-http-isolation: receipt after uid | FAIL con configuración predeterminada; PASS con habilitación ficticia explícita. |
| 16 | sale-delete-http-isolation: receipt after role | Igual. |
| 17 | sale-delete-http-isolation: receipt after password | Igual. |
| 18 | sale-delete-http-isolation: receipt after revocation | Igual. |
| 19 | sale-delete-http-isolation: concurrent identical | Igual. |
| 20 | sale-delete-http-isolation: concurrent different body | Igual. |
| 21 | sale-delete-http-isolation: capability/recovery | Igual. |
| 22 | sale-delete-runtime: full runtime REST/local HTTP | Repetición no concluyente: sandbox rechaza conexión loopback EACCES antes de verificar respuesta. Original 503 frente a 200, código FENCE_REQUIRED. |

## Eliminación de ventas

El constructor de runtime toma saleFinancialDependencies del entorno, falso por defecto. El fixture isolation fuerza los dos fences del store y la evidencia financiera, pero omite esa opción del guard. Por eso los siete casos positivos no llegan a probar su objetivo: la protección rechaza primero. La prueba de autorización faltante/revocada sí pasa.

Sin editar archivos, `SALE_FINANCIAL_DEPENDENCIES_ENABLED=true` y `node --test test/sale-delete-http-isolation.test.cjs` produjo 8 PASS, 0 FAIL, 0 SKIP. Con el entorno predeterminado, el mismo archivo produjo 1 PASS y 7 FAIL. Esto acredita funcionamiento de estos casos ficticios en modo habilitado; no habilita producción ni valida el caso HTTP de runtime, bloqueado por el entorno actual.

En la configuración publicada, la deshabilitación financiera y de History es intencional. El rechazo seguro puede ser una limitación visible si la interfaz permite solicitar Eliminar: no debe presentarse como eliminación operativa sólo porque los casos habilitados pasan. No se hizo recorrido autenticado de esa interfaz en esta revisión.

## Empaquetado y diferencia con imagen

El Dockerfile del checkout omite tecnoprices-login, budget-presentation-trial, ot-custody-held-authority y client-account-operational-state. El scanner reproduce seis referencias (dos módulos tienen más de una referencia). Es un bloqueo real para reconstruir usando ese Dockerfile; no acredita que la imagen desplegada carezca de ellos.

La copia local exacta conservada de imagen c455 contiene los cuatro módulos. Los dos últimos son byte idénticos al checkout; los dos primeros difieren. También difieren index.js y labor-runtime.js. La imagen no contiene sale-delete-fence.js en su raíz. El manifiesto privado identifica fuente 8c5f2a7a y 147 archivos; el checkout auditado es 863917e8. No son artefactos intercambiables. Se verificó presencia y comparación local; no se arrancó Docker ni se consultó Cloud Run en esta revisión.

## Otros resultados y límites

Siete archivos no relacionados con empaquetado/borrado dieron 73 casos, 71 PASS y 2 FAIL: protocolo y texto OT. El store elimina el schema aportado por claims del usuario y sólo emite schema 2 con una versión autorizada del protocolo del actor; el fixture fallido no aporta esa versión. Hace falta decidir el contrato esperado y probar ambos actores, sin sustituir la aserción para obtener verde.

Las seis entradas históricas que ahora pasan incluyen la expectativa bootstrap modificada anteriormente; no se atribuyen a correcciones realizadas aquí. Los cuatro casos de navegador no son SKIP acreditados: sus cuerpos no se ejecutaron por dependencia ausente. Tampoco se usa un fallo de infraestructura distinto como reproducción del defecto original. No se repitió la suite completa ni se declaró publicación apta.

Siguiente paso: provisionar el mismo Node/dependencias del log, repetir los cuatro casos navegador, el payload Docker y HTTP runtime; revisar contrato de protocolo y alinear la reconstrucción Docker con el artefacto autorizado. Conservar la deshabilitación publicada hasta autorización y evidencia de habilitación coordinada.

## Repetición concluyente con Node 22 y dependencias disponibles

Actualización del mismo 14/11: se localizó Node 22 portátil y Playwright ya instalado fuera del checkout. Se usó NODE_PATH apuntando a esa instalación, SV_TEST_CHROME al Chrome instalado y ejecución autorizada fuera del sandbox exclusivamente para Chrome/HTTP loopback ficticio. No se instalaron paquetes. Esta sección reemplaza las clasificaciones inconclusas de los casos 6, 8–11 y 22 de la tabla.

- Casos 8–11: los cuatro cuerpos de gastos-form-return-native se ejecutaron y dieron PASS, 0 SKIP.
- Caso 6: dashboard-backend-mount dio 8 PASS y 1 FAIL en el payload Docker. Ahora falta ot-summary-digest. Durante la auditoría otro bloque agregó ese módulo y referencias desde ot-lifecycle/ot-delivery; por tanto este resultado demuestra que el árbol de trabajo actual no se empaqueta, pero no reproduce literalmente el primer módulo ausente del log original. El scanner inicial sobre fuente anterior ya había acreditado las seis referencias históricas; repetido después de los cambios concurrentes detecta ocho referencias/cinco módulos, sumando dos referencias a ot-summary-digest. No atribuir esta adición al SHA 863917e8 ni al despliegue c455.
- Caso 22: con configuración predeterminada se ejecutó HTTP loopback y reprodujo exactamente 503 SV_SALE_DELETE_FENCE_REQUIRED frente a 200. Con SALE_FINANCIAL_DEPENDENCIES_ENABLED=true sólo en el proceso ficticio, pasó. La ejecución conjunta de runtime e isolation habilitados dio 9 PASS, 0 FAIL, 0 SKIP con Node 22.

Comando de lote predeterminado: Node 22 --test test/gastos-form-return-native.test.cjs test/dashboard-backend-mount.test.cjs test/sale-delete-runtime.test.cjs: 14 casos, 12 PASS, 2 FAIL (payload Docker y HTTP fence), 0 SKIP. Lote habilitado: Node 22 --test test/sale-delete-runtime.test.cjs test/sale-delete-http-isolation.test.cjs: 9/9 PASS.

Balance actualizado de las 22 entradas originales: diez pasan actualmente (incluida bootstrap cuyo contrato fue cambiado antes de esta auditoría); ocho de eliminación fallan con configuración predeterminada y pasan en modo habilitado ficticio; dos de empaquetado acreditan bloqueo del checkout (el payload actual incorpora además la dependencia OT concurrente); protocolo y texto OT siguen rojos. No quedan aquellos seis bloqueos de infraestructura sin ejecutar. Esto no convierte los resultados en una puerta general verde ni habilita la eliminación publicada.

Cambios locales ajenos observados durante la repetición: ot-custody-held-authority, ot-delivery y ot-lifecycle, módulo ot-summary-digest y pruebas OT nuevas. Este agente sólo escribió este informe y no alteró esos archivos. La comparación byte a byte con c455 descrita arriba pertenece a la inspección inicial, anterior a esos cambios; no debe extrapolarse al árbol de trabajo posterior.

## Cambio acotado de Dockerfile y nueva dependencia transitiva

Por autorización posterior del coordinador se agregaron únicamente cinco líneas COPY al Dockerfile genérico: los cuatro módulos originales y ot-summary-digest. No se modificaron expectativas ni fuentes JavaScript. Repetición con Node 22, dependencias instaladas y Chrome configurado: scanner + nueve pruebas dashboard, 10 casos, 8 PASS, 2 FAIL, 0 SKIP. Ambos rojos identifican la misma dependencia transitiva antes oculta: budget-presentation-trial-model, requerida por budget-presentation-trial al construir su módulo. El scanner anterior no podía verla porque el padre tampoco estaba incluido. El cierre de empaquetado sigue pendiente de incluir ese modelo; no se amplió ese alcance sin coordinación.

El paquete real de OT186 usa un overlay de cuatro archivos sobre la imagen c455 exacta, no una reconstrucción desde este Dockerfile genérico. Las nuevas líneas COPY sólo preparan una futura reconstrucción del checkout; no reemplazan la imagen autorizada ni acreditan equivalencia funcional de los otros módulos del checkout.

## Empaquetado cerrado en checkout

Autorizado el cierre transitivo, se agregó también COPY budget-presentation-trial-model.js, única dependencia nueva requerida. Lista final de seis archivos incorporados al Dockerfile: tecnoprices-login.js, budget-presentation-trial.js, budget-presentation-trial-model.js, ot-custody-held-authority.js, client-account-operational-state.js y ot-summary-digest.js. No se incorporaron módulos sin referencia ni se alteraron algoritmos.

Repetición final Node 22: test/cotizador-container-dependencies.test.cjs + test/dashboard-backend-mount.test.cjs, **10 PASS, 0 FAIL, 0 SKIP**. Incluye cierre estático de require locales y arranque del payload copiado con flags deshabilitados/habilitados, cinco rutas GET, permisos y ausencia de escrituras ficticias. Así quedan resueltas las dos entradas originales de empaquetado para futuras reconstrucciones del checkout. La imagen c455, el overlay OT186 y este checkout siguen siendo fuentes distintas; no se construyó ni desplegó una nueva imagen aquí.

Estado de las 22 entradas después de este cambio acotado: doce pasan actualmente (incluida bootstrap con contrato cambiado antes de esta auditoría); ocho de eliminación fallan por configuración predeterminada y pasan habilitados sólo en fixture; dos rojos restantes son el contrato de schema en protocolo y el texto del resultado incierto OT. No se modificaron esas expectativas para presentarlas como aprobadas.
