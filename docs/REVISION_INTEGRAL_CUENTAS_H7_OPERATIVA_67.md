# Revisión acotada de Cuenta Corriente, H7 y relaciones operativas

Referencia funcional: `67f0418cc2b67618b0b3d89cfed365c2acd352b9`, árbol `7404b706ba13a0a6efc8278d7f074ed8ce001ad4`. Se leyeron PLAN_INTEGRAL_ETAPA1, CONTEXTO_ACTUAL, procedimiento de corte, archivos y logs. El HEAD observado inicialmente fue `9dc18076c8c76efa6f84f8ba8ce035a242a0cc87`; sus diferencias respecto de 67 son sólo documentación. No se editó root, código, reglas ni producción.

## Conclusión limitada

Hay evidencia local actual de Cuenta Corriente/Historial y de las relaciones operativas que excede el trabajo de Dashboard. No se identificó un defecto funcional nuevo en esta revisión estática/de evidencia. No equivale a completar el objetivo integral en producción: siguen separados el paquete final de activación, las pruebas del corte emparejado y el estado externo fresco.

La puerta sobre 67 consta en `current-gate-67f0418c.private.json`: Node22.23.4, comando `scripts/test-current.ps1`, exit0. Se comprobó el log completo: 9.492 casos, 9.461 PASS, cero FAIL, 31 SKIP. SHA256 del log recalculado: `6d691e201901b12e34be7bb579d2d80a7870c52a1568aaa5237b0158ec784e63`. Es evidencia de la selección vigente, no de las integraciones excluidas por extensión.

## Requisitos → implementación → evidencia → límite

| Requisito del plan | Archivos y pruebas concretas | Evidencia leída sobre 67 o repetida ahora | Límite que conserva |
|---|---|---|---|
| Cuenta: contribución canónica, deuda íntegra y extracto; embebidos/globales, anulados y sobrepago | `cotizador/client-account-{projection,projections,embedded,ledger}.js`; `js/core/client-account-reader.v1.js`; tests `client-account-preparation`, `projection`, `reader`, `ledger`, `embedded` | Gate: preparación emparejada sin tocar originales; fuentes omitidas/deriva rechazadas; precedencias y contribuciones. No se calcula la deuda sobre las primeras50 | No conciliación de cuentas reales ni instalación remota |
| Cuenta: escritor coordinado, permisos y recuperación; cliente sin movimientos | `client-account-{writer-protocol,scope,owner-evidence}.js`; `client-account-mode.v1.js`; host y tests `writer-protocol`, `rollout-sdk`, `scope`, `context-actions`, `native-ui` | Gate incluye UI 390/768/1280: lista50, búsqueda histórica y extracto exacto; pago/anulación, formulario conservado, revocación, ámbito nuevo certificado y alias ambiguo bloqueado. No fallback a raíces por configuración parcial | Requiere servidor/reglas/índices y puente de pestañas antiguas emparejados antes de activar |
| H7: siete fuentes completas y domicilios coherentes, sin unión por nombre ni duplicación | `client-history-{model,delta,projections,query,complete-page}.js`; tests `model`, `writers`, `delta`, `query-cost`, `complete-page` | Gate confirma fuentes explícitas, agregados >50, homónimos/domicilios ambiguos, embebido sustituido por global, monto desconocido en presupuesto sin recalcularlo con precios actuales | No fotografía completa de las siete fuentes reales ni reconciliación remota |
| H7: audiencias por módulo/asignación, originales autorizados y retiro de contexto | `client-history-{access,http-adapter,client}.js`; lectores/hosts/bootstrap/acciones/credenciales del navegador; tests `assignment-mixed`, `access`, `host-native`, `original-actions-native`, `credentials-*` | Gate: técnico ve sólo asignación propia, ajena excluida antes de leer original; original propio denegado sigue siendo error. Host real Access/Query pasó 390/1280. Retorno, filtros y cambios de sesión/rol/revisión cubiertos por fixtures | No implica acceso productivo ni permiso comercial por tener OT/comisiones. UI de todos los formularios no se presume probada |
| OT/Compras: relaciones completas para borrar/desvincular, CAS y conservación de otras órdenes/reservas | `ot-delete-{policy,command,http-adapter}.js`, `purchase-order-delete{,-model}.js`, dependencias de eliminación de venta; tests `ot-delete-*`, `purchase-order-delete-*`, `sale-delete-*` | Repetición exacta de la selección operativa sobre código funcional67: 206 PASS. Incluye otra orden fuera de memoria, aliases OT, stock insuficiente, CAS obsoleto, revocación final, replay y conservación económica | No cascadas reales, reglas remotas ni aceptación de eliminar registros reales |
| Recepción parcial y costos históricos | `js/modules/purchase-orders.js`, `purchase-receipt-costs.v1.js`; `commercial-complete-operational-chain.integration.cjs` | Los206 incluyen recepción2/3, ACK perdido/replay, reserva de otra asignación conservada, costo real34 frente a presupuestado30, venta300 y deuda26000 centavos coherentes Pages/Accounts/H7 | El fixture usa SDK/HTTP/Auth/RAM y asserts controlados; no prueba atomicidad o stock real fuera del protocolo ensayado |
| Entrega/remito: cantidad seleccionada, identidad recuperable, sin stock duplicado | `ot-lifecycle{,-model,-policy}.js`, `ot-delivery-selection.v1.js`, `manual-delivery-writer.v1.js`, custodia; tests `manual-delivery-*` y cadena explícita | Los206 incluyen selector público y ruta autoritativa entregando2, un remito, inventario sin nuevo consumo al entregar; ACK perdido recupera misma clave, payload/UID distinto rechazan y no cierran formulario ajeno | No demuestra por sí solo instalación→corrección→devolución; esa cadena es otro archivo/log explícito |
| Instalación/corrección/devolución y OT cerrada | `commercial-partial-delivery-chain.integration.cjs`, `commercial-uninstalled-return-chain.integration.cjs`, `ot-closed-delivery-eligibility-native.integration.cjs`; modelos/lifecycle/custodia | Existen pruebas y logs separados: cadena parcial independiente5PASS, devolución sin instalación2PASS; docs delimitan original cerrado frente a adicional canónico. Esos archivos/fixture no cambiaron entre b9 y67 | No están seleccionados por test-current ni por los206. No se reejecutaron aquí; no se reatribuyen sus conteos a gate67. No autoriza nueva entrega original en OT cerrada |

Las referencias abreviadas de tests corresponden a archivos directos de `test/` con el mismo prefijo. Se comprobaron en el log, entre otros, los casos de preparación emparejada, H7 completo, supresión de embebidos ante global, técnicos/asignación mixta y las cinco variantes nativas Account/H7 indicadas.

## Repetición operativa actual

Selección solicitada: archivos directos de `test/` cuyo nombre empieza `sale-delete`, `ot-delete`, `purchase-order-delete` o `manual-delivery` y termina `.test.cjs`, más `commercial-complete-operational-chain.integration.cjs`. Son 23 archivos de puerta más una integración explícita: **206 casos**. No se añadieron `.rules.integration.cjs` ni otros opt-in.

Node `C:/SisVentas/tmp/node22-portable-20261104/node.exe` v22.23.4, `NODE_PATH=C:/SisVentas/cotizador/node_modules`. Primer intento restringido:204PASS/2FAIL por acceso loopback (`ERR_NETWORK_ACCESS_DENIED` y `fetch failed`). Se conservó el log; repetición autorizada con loopback: **206 PASS, 0 FAIL, 0 SKIP, exit0**. No cambió una expectativa ni un archivo funcional. Logs nuevos privados del checkout delegado: `tmp/sdk-proof/operational-review-67.private.log`, `operational-review-67-loopback.private.log` y selección `operational-review-67-selection.private.txt`.

El log anterior de206 era sobre b9. Comparación b9→67: no cambiaron archivos operativos, modelos Account/H7, tests seleccionados o fixture de cadena; sólo cambian seis archivos de Dashboard/avisos y el helper de últimas por creador dentro de las rutas examinadas. La repetición actual evita depender exclusivamente de esa comparación estática. El log separado de42 dependencias financieras PASS sigue siendo antecedente, no una nueva ejecución.

## Los31 SKIP, sin confundirlos con integraciones fuera de la puerta

| Archivo | Casos SKIP | Significado para este alcance |
|---|---:|---|
| `commercial-draft-transport-restart-native.test.cjs` | 2 | Pausa SDK real con reglas del emulador y mismo borrador,390/1280. Relevante para transición; el log general no ejecutó esas variantes |
| `commercial-full-app-metrics.test.cjs` | 1 | Arranque HTML completo y deuda histórica; complementa alcance de cobertura, no sustituye Account/H7 |
| `dashboard-notice-rest-independent.test.cjs` | 1 | Retiro de editor por dataEpoch. Alcance Dashboard, no prueba de cadena OT/Account |
| `labor-expense-race-emulator.test.cjs` | 7 | Gasto concurrente/entradas largas, comisión, diario fiscal y límite durable de reintentos; infraestructura financiera compartida |
| `labor-runtime-emulator.test.cjs` | 20 | REST store, guard real, replay/resolución ACK, revocación durante lease, privilegios de referencias, sentinels y bootstrap sólo derivado; infraestructura compartida con Accounts/H7 |
| **Total** | **31** | No hay skip directo con nombre Account/H7/OT; eso no acredita sus integraciones de reglas fuera del patrón de puerta |

Las activaciones de esos opt-in requieren emulador local y variables explícitas; se inspeccionaron sus condiciones de `skip`. Las20 variantes incluyen cinco casos parametrizados de inactivo/rol/permisos/reset/expiración durante el lease.

Root informó ejecuciones separadas sobre67:8PASS métricas/editor,27runtime en9017 por Costos y6borradorSDK por QA. Se leyó `final-67-metrics-point-optin.private.log`:8PASS/0FAIL/SKIP. Los27 y6 deben ligarse a sus logs/manifiestos de misma fuente cuando lleguen: sus conteos incluyen casos ya no omitidos, por lo que **no** se suman como si 8+27+6 fueran31 nuevos casos. Este informe no inicia emuladores ni atribuye automáticamente esas tandas al log general.

Adicionalmente, `client-account-rules.integration.cjs`, `client-history-write-rules.integration.cjs`, matrices OT/delivery/attestation y otras `.integration.cjs` están **fuera** de `test-current.ps1`; no figuran entre los31. Hay antecedentes emulados y matrices de corte documentados, pero se deben emparejar con los hashes del artefacto/reglas definitivos. Respecto de la fuente1c12 de las siete matrices históricas, runtime/store/lifecycle y builders/atestación de entrega sí cambiaron: no extender su aprobación por nombre o por ausencia de un skip.

## Pendientes locales y externos separados

**Locales antes del corte, sin agregar prestaciones:**

1. Congelar el paquete único de activación con Accounts/H7 habilitados sólo en ese artefacto, versión/índice/SW/SHELL coherentes y pruebas frío/caliente/reglas del corte exacto. El índice67 mantiene ambos rollouts `enabled:false`; la puerta del árbol de desarrollo no equivale a probar ese paquete habilitado.
2. Emparejar imagen, todas las rutas escritoras, reglas compuestas de Accounts/H7/pausa SDK/OT y namespace privado de atestación. Contrastar manifiestos/hashes de los ensayos ya hechos y ejecutar sólo lo que haya cambiado o falte en el paquete final; los27runtime y206 operativos no prueban automáticamente esa composición conjunta.
3. Incorporar al cierre los logs actuales de los opt-in y los límites de integraciones excluidas. La cadena pública instalación/corrección/devolución ya tiene evidencia local distinta; no presentarla como cubierta por los206 ni inventar que no existe.
4. Concretar el protocolo de ventanas anteriores al puente, borradores y recuperación del corte. Hay pruebas locales de pausa/reinicio de listener con mismo backend; no prueban reinicio de proceso/Cloud Run ni actualización transparente de una pestaña que nunca recibió el puente.
5. Reconciliar documentación específica antigua: `HISTORIAL_FUENTES_POR_CLIENTE.md` conserva párrafos de03/11 que dicen “no conectado a pantalla/audiencias”, ya superados por archivos y pruebas actuales; `OT_ENTREGA_PARCIAL_CANDIDATA.md` contiene pendientes históricos de integración. Usar CONTEXTO/plan actuales y el SHA de cada evidencia, no esos encabezados aislados. Es mantenimiento de estado, no un defecto funcional nuevo.

**Externos, todavía no acreditados por esta revisión:** observación remota fresca de reglas/configuración/raíces, inventario vigente de todos los escritores/accesos/fiscal, pausa y drenaje reales, snapshot coherente, instalación/conciliación técnica sin reescribir históricos, atestación con generación/reglas correctas, capacidades efectivas y reapertura autorizada. Git no sincroniza nada de eso. No se consultó producción ni se aplicó candidato alguno.

También permanece separado mostrar la fuente actual en la ventana del usuario: el contexto informa servidor8765 en otra copia y falta de control de IAB. No se anuncia como visible una UI no recargada. La validación humana focal o el verde de modelos no prueban todos los formularios ni todos los estados históricos.

La salida de este bloque es una matriz de evidencia y pendientes, no una declaración de objetivo integral terminado ni una autorización de publicación.
