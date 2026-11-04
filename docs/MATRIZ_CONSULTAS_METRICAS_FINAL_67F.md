# Matriz final de consultas y métricas · fuente67f

Fecha: 04/11/2026. Auditoría cerrada al alcance solicitado del PLAN_INTEGRAL_ETAPA1: consultas, métricas, fuentes completas, readiness y retornos. Documento preparado en checkout aislado; no modifica root, código, pruebas ni producción. No abre prestaciones nuevas ni certifica por extensión todos los circuitos de mutación del plan.

## Fuente y evidencia comprobada

Fuente funcional: `67f0418cc2b67618b0b3d89cfed365c2acd352b9`; árbol `7404b706ba13a0a6efc8278d7f074ed8ce001ad4`. En la revisión, root tenía commits documentales posteriores sin diferencias de código, índice, SW ni pruebas frente a67f. Este checkout documental tiene otra base; las referencias de la matriz corresponden expresamente a67f, no se atribuyen a su HEAD propio.

| Evidencia | Resultado y alcance | Archivo real |
|---|---|---|
| Puerta vigente, Node22.23.4 | 9.492 casos:9.461PASS/0FAIL/31SKIP; exit0; cuatro lotes, selección completa | `C:/SisVentas/tmp/stage1-integral-plan/current-gate-67f0418c.private.log` y `.private.json` |
| Hash del gate verificado | SHA256 `6d691e201901b12e34be7bb579d2d80a7870c52a1568aaa5237b0158ec784e63` | Mismo log; metadata fija SHA/comando/inicio/fin/exit0 |
| Nativa final independiente | 14PASS/0FAIL/SKIP; emulador y namespace propios, reglas propuestas, backend real del corte con Auth ficticio | `C:/SisVentas/tmp/stage1-integral-plan/dashboard-native-67f0418-final/test.private.log`; `docs/DASHBOARD_NATIVE_CUT_67F0418.md` y manifiesto en root |
| Chrome final independiente | 6PASS/0FAIL/SKIP: últimas personales/global y avisos tardíos1280/390 | `C:/SisVentas/tmp/dashboard-six-67f0418c-browser-independent.private.log`; `docs/DASHBOARD_BROWSER_QA_67_CIERRE.md` en root |
| Opt-in adicional confirmado por root y contrastado con log/hash | 8PASS/0FAIL/SKIP: commercial-full-app-metrics(1), dashboard-notice-rest-independent(7) | `C:/SisVentas/tmp/stage1-integral-plan/final-67-metrics-point-optin.private.log` |
| Hash opt-in verificado | SHA256 `0f3b79c23e1bd8d9a8fe1428fda2b874fb1c1aa548f28044f260e19545b71c69` | Mismo log; sus últimos ocho resultados terminan en PASS |

No se suman estas ejecuciones como casos únicos del gate. Los ocho opt-in resuelven dos de sus31omisiones: seis casos REST de ese archivo ya estaban en la puerta; sólo el caso HTML y el caso Chrome dataEpoch estaban omitidos. Por tanto quedan29SKIP pendientes de evidencia en esta matriz, no23. Costos/QA están ejecutándolos según coordinación; una ejecución en curso no se marca aprobada.

## Matriz requisito → evidencia → límite

| Requisito del plan | Código de67f y prueba efectiva | Evidencia real | Límite / faltante concreto |
|---|---|---|---|
| Primeras50 sin reducir el universo | `js/core/commercial-pages-reader.v1.js`, modelo Pages; `test/commercial-pages.test.cjs` | GatePASS:50+50 filas,127 ventas y deuda2020, sin raíces originales de ventas/pagos | Requiere proyección/cobertura válidas; su preparación remota no está certificada por el gate |
| Búsqueda histórica fuera de memoria | Reader.search e índice existente; `test/commercial-sparse-and-source-order-native.test.cjs` | GatePASS:HTML real, mes+texto, dos páginas UI vacías intermedias y coincidencia histórica; consultas acotadas | Página filtrada vacía no equivale a fin; backend ficticio, sin ahorro productivo medido |
| Totales/deuda independientes de50filas | Totals/modelo, host Pages, consumidores sales-metrics/metrics-cache; commercial-pages y prueba de Cobranzas nativas | GatePASS y opt-in nuevoPASS:HTML60/1095ventas,50filas iniciales,20ventas históricas buscables, deuda completa en Ventas/Dashboard/Cobranzas, retorno a Ventas,0SDKrootventas/pagos y0writes | Opt-in simulado; mantiene otras raíces legítimas (clientes, productos, OT, etc.). No afirma que toda la app dejó de leer raíces |
| Cuenta Corriente y saldos por período | Lectores/proyección Accounts; `test/client-account-ledger-reader.test.cjs` | GatePASS:50por página, saldos completos, período sin movimientos conserva saldo anterior, búsqueda de estado sobre todas las cuentas, revisión cambiante rechazada | No equivale a Accounts instalado/cortado en producción |
| Historial completo por identidad/domicilio | H7 y manifiestos; `test/client-history-complete-page.test.cjs` | GatePASS:50+50+21, totales certificados, partición por domicilio, audiencia propia elegible; ambigüedad no se inventa como cobertura completa | Caminos asignados/mixtos no certificados usan fallback declarado. Preparación/corte H7 remoto pendientes |
| Informes y estadísticas sobre período completo | `js/core/commercial-report-read.v1.js`; commercial-report-read, active-consumers y host-invalidation/host-dom-native | GatePASS:más de50ventas, detalles puntuales autorizados, pagos resumidos, gastos/directorio frescos, faltantes/cambio de revisión/permisos/importe discordante rechazan total definitivo | Límites explícitos:5.000registros por período,2.000gastos,1.000empleados. Exceso exige período menor/error; no presenta total parcial. No mide latencia/costo productivo |
| Cobertura salarial completa y explícita | `js/core/salary-coverage-read.v1.js`; salary-coverage-read y salary-report-cache-context | GatePASS:55ventas del período, contraste diario con totals, detalle faltante no es vacío, gastos acotados, rol/revisión cambiantes cancelan, lectura sólo a demanda | Límite1.000ventas,1.000gastos por consulta y200referencias de productos. No hay aceptación implícita de períodos superiores; exigir reducir período |
| Fuente ausente/error/desconocida no equivale a0 | Readiness, Reader.totals, report/salary readers; `test/data-readiness.test.cjs`, Pages y sparse/source-order | GatePASS:pendiente/vacío confirmado/error/sesión nueva distintos; error no completa fuente; cobertura ausente o inconsistente rechaza | Readiness de un resumen no promete que todos los originales estén descargados; cada consumidor debe usar su fuente certificada |
| Presupuestos Dashboard sin colección original incidental | Source/Host/Aggregate/HTTP y plan de inicio del app; pruebas startup, budget-source y navegadores independientes | GatePASS; Chrome final6PASS y nativa14PASS respaldan demandas acotadas, fuente autoritativa, reset/revocación y ausencia de nuevas lecturas de colección presupuestos al entrar | Flags nuevosOFF. No se retiraron otras fuentes legítimas todavía usadas; sin ahorro remoto facturado certificado |
| Métrica mensual personal y últimas5 correctas | Faceta creatorMonth/creatorLatest Pages, helper y lector Ventas, DTO/Host/renderer | Nativa14PASS y Chrome6PASS:501personales frente50parciales, cinco claves personales distintas deltop5global, seis campos públicos, centavos exactos, nombre vigente/escape y sin fallback de arrays | Metadata del grupo exacto tiene costoO(n); orden final por clave estable es cambio limitado de presentación, no paridad de inserción legacy; locale debe certificarse |
| Avisos tardíos sin permiso revisarVencidos | changed de Source, verificarVencimientosPptos y generarNotificaciones; módulo notifications.js | Chrome final1280/390PASS:respuesta retenida1400ms,overlayvisible,sin falso vacío; Source entrega y centro muestra aviso sin agregar revisarVencidos; unaGETavisos | Backend/Auth ficticios; no certifica Auth/reglas desplegadas. Otros avisos válidos/Source retenida tienen focales separados, no permiso ampliado |
| Retornos/revalidación sin red desde render | Hosts de Dashboard, contexto/epochs y Reader preflight; pruebas host/contexto más Chrome final | PASS:retención503,salida/retorno por Clientes,retiroUser; cuatroGET personales en ciclo; global6/7GET; sin GET extra al navegarVenta. Preflight comparte sólo anclas iniciales y relee cierre fresco | Eventos red/visibilidad simulados, no desconexión física/minimizaciónSO. Cero llamadas de render no significa cero consultas de toda navegación |
| Editor puntual no sobrevive a retiro de dataEpoch | `test/dashboard-notice-rest-independent.test.cjs` | Opt-in adicional7PASS incluye Chrome de retiro del formulario; REST conserva ruta autenticada, respeta status y no reintenta/reutiliza snapshot fallido | Este SKIP quedó resuelto por ejecución adicional; no se reescribe el resultado histórico de la puerta |

## Revisión completa de31SKIP

| Cantidad original | Archivo/escenario | Estado al cerrar este documento | Dependencia / siguiente verificación local acotada |
|---:|---|---|---|
| 2 | `commercial-draft-transport-restart-native.test.cjs`:SDKadmisión/reglas y recuperación mismo borrador390/1280 | Pendiente de resultados Costos/QA; no adjudicadoPASS | Emulador indicado en FIREBASE_DATABASE_EMULATOR_HOST, SDK y Chrome; evidencia de este corte |
| 1 | `commercial-full-app-metrics.test.cjs`:HTMLcompleto/deudahistórica | **Resuelto:1PASS opt-in** | Log/hash adicional arriba;60/1095,50filas,búsquedaantigua,retornos,0writes |
| 1 | `dashboard-notice-rest-independent.test.cjs`:Chromeeditor/dataEpoch | **Resuelto:PASS dentro de7casos** | Log/hash adicional arriba;seisRESTya estaban en la puerta |
| 7 | `labor-expense-race-emulator.test.cjs`:gastos concurrentes, fiscal/journal, intentos durables | Pendiente de resultados Costos/QA; no adjudicadoPASS | FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9017 y SV_LABOR_RULES_BASE; permisos/servidor emulado, no producción |
| 20 | `labor-runtime-emulator.test.cjs`:RESTstore, comandos/recibos, commit/revocaciones/lease, refs y bootstrap | Pendiente de resultados Costos/QA; no adjudicadoPASS | Mismo emulador/reglas, recibos y recuperación sobre cortefinal; nativaDashboard no los sustituye |
| **31** | Total histórico | **2omisiones resueltas,29pendientes** | Sólo actualizar con logs/resultados terminados; no iniciar nuevas matrices por rutina |

Los27casos de runtime/carreras son prerrequisitos de consistencia del conjunto comercial, no pruebas de una tarjeta. No puede inferirse su aprobación a partir de un lector que ya recibe un derivado consistente. Tampoco se concluye que el código esté fallando por estar opt-in: falta ejecución de esos escenarios sobre la fuente final.

## Separación local / remoto y conclusión de alcance

**Local comprobado:** gate67fverde para sus9.461casos efectivos,14nativa y6Chrome independientes; ahora también HTMLcompleto60/1095 y retiroeditor/dataEpoch mediante8opt-in. No apareció un defecto nuevo en esta revisión de evidencia. Siguen29omisiones concretas en ejecución por otros frentes, sin resultado incorporado aquí. No se ejecutaron nuevas pruebas para guardar este documento.

**Local visible:** la pestaña del titular no fue recargada; IAB devolvía browser.user is unavailable. El servidor8765 seguía apuntando a otra copia según CONTEXTO del cierre auditado. No afirmar que la fuente final está visible allí, ni manipular su edición por otra vía.

**Remoto pendiente:** revalidación fresca del estado/despliegues, todos los accesos/escritores, paquete fiscal; instalación controlada Accounts/H7/Pages/proyecciones/reglas y ensayo de corte/recuperación según CORTE_INTEGRACION_COMERCIAL. FlagsOFF, originales reales intactos; main y publicación general separados. Git no aplica Firebase/reglas/SecretManager/CloudRun/Auth.

**Conclusión:** las consultas y métricas tienen evidencia local trazable y límites explícitos. Este documento no declara terminado el objetivo integral ni autorizada/realizada producción. El siguiente cierre local de los29SKIP corresponde a las ejecuciones ya coordinadas; el siguiente cierre remoto requiere el procedimiento de activación y evidencia externa vigente, no ampliar esta auditoría.
