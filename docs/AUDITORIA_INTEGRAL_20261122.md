# Auditoría integral reanudada · 22/11/2026

Autorización del titular: revisar pendientes y corregir en paralelo. Se trabaja en local, con datos ficticios, sin operaciones comerciales reales, cambios de permisos, compilaciones remotas ni publicación durante la investigación. Esta reanudación reemplaza la pausa de la auditoría general para este alcance.

## Base comprobada

- Web consultada por HTTP: v3.21.2-firebase. El índice referencia app.v3.21.2.js.
- Base limpia de integración:060c77f8; código público5e4bb83d. Copia central: C:/SisVentas/.local/auditoria-integral-20261122, rama codex/auditoria-integral-20261122.
- origin/main actualizado por fetch:4639a87b, limpieza sobre una base histórica. No representa automáticamente el código publicado. No importar eliminaciones de tests para resolver fallos.
- C:/SisVentas está atrasado y tiene cambios desconocidos conservados. Los cinco frentes usan worktrees propios; nadie edita el checkout de otro frente.

## Reparto y propiedad

| Frente | Dueño funcional | Pendientes de base | Entregable |
|---|---|---|---|
| A | Recibos y operaciones comerciales |8fallos de revocación/recuperación/concurrencia, eliminaciones de ventas y comisiones | Reproducción, corrección, pruebas, commit aislado |
| B | Claims y empaquetado |1fallo de claims reservados +2de Docker/dependencias | Commits separados de claims y paquete, sin ampliar permisos |
| C | Gastos y consultas |4fallos de retorno de Gastos; cobertura histórica, buscadores y recargas | Funciones de frontend y pruebas nativas, sin modificar escritores comerciales |
| D | OT y Tecnoprices |1fallo HTTP incierto OT; entregas/instalaciones/remitos/eliminación y proveedor | Ciclos sintéticos e idempotencia/latencia; sin usar OTs reales |
| E | Stock de oficina | Lectura positiva, orden/páginas, alta por búsqueda y Revisar vínculo | Conservación de cantidades/historial, pruebas de UI y servicio |
| Coordinación | Inventario, compatibilidad e integración |91omisiones documentadas deben clasificarse; pruebas generales y regresión cruzada | Registro único, conflictos por función, cobertura explícita |

El store laboral puede recibir funciones distintas de A/B; cada uno entrega un commit propio y la integración revisa el conflicto. Ningún frente cambia index, SW, versión o configuración de producción. La comprobación general se ejecuta centralmente para no multiplicar navegadores ni presentar cinco suites independientes como prueba del conjunto.

## Criterios de cierre

Un fallo se marca resuelto sólo con causa, reproducción y prueba del cambio en la fuente actual. Si es una fixture obsoleta, se demuestra el contrato vigente sin debilitar permisos ni invariantes. Conservar los fallos anteriores y pruebas omitidas como evidencia; no atribuir cobertura a tests no ejecutados. Validar éxito, rechazo, permisos revocados, respuestas tardías, concurrencia y reintento incierto según el circuito.

La suite de referencia anterior fue11041total/10934PASS/16FAIL/91SKIP. Primera corrida central diagnóstica sobre3510ef2f:11058total/10962PASS/5FAIL/91SKIP; los16fallos de referencia ya no aparecen y se detectaron4expectativas viejas de esquema y1preservación exacta de Stock tras el cambio aprobado. Se conservaron hashes originales y se probó una derivación acotada/adversarial, no se reemplazaron para ocultar cambios. Contrato de claims distingue esquema de capacidades con inyección maliciosa neutralizada. Segunda puerta completa, fuente fija9dec32e6ef26a1ac1d3cd54d3de61d28eb842fb6:11089total/10998PASS/0FAIL/91SKIP/0canceladas, Node24.17.0 y Chrome existente. No se modificó código durante esa corrida. La corrida inicial de preparación se interrumpió al integrar los primeros bloques: preintegracion-parcial.private.log no es una certificación de baseline completa. Logs y artefactos van en C:/SisVentas/tmp/auditoria-integral-20261122, fuera de Git.

## Evidencia adicional y pendientes reales

Pruebas fuera de puerta, con datos ficticios: compartir preview2PASS, presentación genérica18PASS, recuperación nativa3PASS; protocolos mínimos19PASS en emulador efímero y control completo con copia de reglas reales2PASS (gasto por modelo/acceso/guard/store/índices; válido confirma una vez y revocaciones rechazan). Los19casos mínimos no sirven sin cambios como prueba positiva de todo el baseline: al aplicarlo íntegro11PASS/8FAIL por preparación financiera incompleta, conservados por separado; el control completo existe precisamente para no atribuirlos falsamente al claim2. No se transforma una matriz parcial en cobertura global.

Los frentes aportan informes separados: A154casos; B35y matriz19; C114lectores+6garantías+346casos económicos distintos; D445PASS/13SKIP; E43casos base. No sumar esos conteos a la puerta ni entre sí: hay solapamientos y condiciones diferentes. Las91omisiones globales siguen inventariadas, con opt-ins ejecutados por separado y artefactos privados faltantes expresamente no certificados.

Lecturas externas autorizadas de metadata, sin registros comerciales: localHTTP y web entregan21.2; Cotizador cotizador-otropa-cc198f6e concentra100%y15tags, digest55e5d728480cf490b36d78591cf5441095ab05c635ed91631de1c927e41eba50. No inferir igualdad de fuentes por nombre de revisión. Reglas RTDB leídas porGET, copia privada3576401bytes SHA256ea197750dc668aedffc5e182dd6a6e7fd6e939279690cf4a8077ac4cd975f3db. No hubo PUT remoto, build, cambio de tráfico/permisos ni operaciones reales. El conectorFirebase no tenía sesión; se usó CLI existente sin imprimir credenciales.

Revisar vínculo de Stock continúa como migración local separada: resolver/plan/política propios preparadosOFF; todos los escritores de Compras/OT deben usar la misma clave física, conservar identidad histórica del recibo y cerrar SDK antiguo tras liberarlease. Catálogo requiere barrera común; se preparó candidato acotado con30pruebas sobre reglas íntegras, aún no aplicado. No hay botón de reparación que guarde mientras esto no esté completo. Este pendiente no se oculta bajo la puerta verde del bloque anterior. Tecnoprices se verifica con fixtures del lector; no se atribuye login/proveedor en vivo ni rendimiento productivo a las simulaciones.

## Segunda integración local: Stock y lecturas OT

Fuente central5c4ecdfa: se incorporaron resolver/plan/política/comando de vínculo OFF, autorización tipada de Stock en guard, cierre COPY del payload, contrato de interfaz y recuperación, más reutilización de originales completos de catálogo sólo dentro de una planificación OT. No hay rutas nuevas activadas ni botón integrado en la aplicación activa. Se conserva el control fresco de permisos, datos y consultas antes del commit.

Pruebas centrales separadas, sin sumarlas entre sí: núcleo Stock92PASS; interfaz aislada12PASS; composición real interfaz/comando/guard/store y puerto histórico38PASS; OT7PASS. Primer intento de UI restringido:12errores de conexión loopback del navegador, registrados, no fallos atribuidos al producto. Repetición con Chrome habilitado12PASS. Pruebas opt-in adicionales: Cuenta Corriente con ambos órdenes de fuentes, arranque completo con60/1095ventas y20históricas, presentación y detalle22casos/21PASS/1SKIP; ese opt-in restante de retiro del editor se ejecutó aparte con7PASS/0SKIP. Todas las operaciones fueron ficticias.

La demora OT NO queda certificada como resuelta por quitar cuatro lecturas de planificación. Consulta de metadata Cloud Logging de POST exacto /ot/ciclo (sin cuerpos ni registros comerciales): revisión vigente cotizador-otropa-cc198f6e,3respuestas200, mediana10668.378ms y máximo11196.541ms. Muestra pequeña, confirma necesidad de seguir midiendo; no demuestra causa ni rendimiento de la candidata. D continúa con fases y demora sintética150ms sin ejecutar una OT real.

Reparto actualizado: A escritores tipados de Compras y cierre de inventario SDK; B candidato de reglas cerrado y contrato de activación; C interfaz y recuperación durable; D consumidores OT, tres identidades y latencia; E núcleo/cobertura dirigida de referencias. Persisten bloqueos de activación: cobertura autoritativa sin índice duplicado provisional, consumidores completos, reglas con grants heredados, recuperación tras recarga y prueba integral conjunta. La puerta verde anterior corresponde a9dec32e6, no certifica por extensión esta segunda integración. No se publicó ni compiló remotamente.

## Opt-in financiero retenido, ejecutado centralmente

Se encontró la referencia histórica exacta de las pruebas de runtime: SHA256c44a50deadc0d7af16b02d0226a0acf1642fa77dac722d08d14d3b47e14c93fb. El builder la aceptó sin relajaciones. Con el runtime de la fuente central5c4ecdfa, Node22portable y emulador propio9017: labor-runtime-emulator + labor-expense-race-emulator27PASS/0FAIL/0SKIP. Se ejercitaron reintento, recibo perdido, revocaciones, índices, comisión pagada conservada, carreras de gasto y journal fiscal ficticio cerrado. El proceso local fue cerrado por su lanzador. Es una validación contra ese candidato histórico, no una afirmación de equivalencia con las reglas remotas actuales; los controles contra la copia remota íntegra se describen aparte. No hubo escrituras externas.

## Hallazgo adicional de orden global en Stock

Reproducción central con el servicio real y la fixture de listado ya existente:100registros ficticios con general1..100; primera respuesta50filas, mayor cantidad visible50, aunque existe100, con cursor de continuación. La interfaz ordena sólo las filas cargadas; no cumple un orden global de mayor a menor. No se cambió el listado para ocultar el caso. E lo incorpora después de cerrar cobertura de referencias, con pruebas de más de una página, empates y cantidades numéricas/strings antiguas. Un limitToLast sin tratar el orden por tipo de RTDB no sería suficiente y podría omitir existencias históricas.

## Puerta completa de segunda integración

Fuente fija5c4ecdfa, sin cambios de código durante la ejecución:11220tests/11129PASS/0FAIL/91SKIP/0canceladas, salida0 del script vigente. Log privado puerta-segunda-integracion.private.log. Las91omisiones de la puerta no se eliminan del inventario por ejecutar tandas manuales separadas. Los27opt-ins financieros retenidos, las pruebas de navegador y controles de reglas actuales se mantienen como evidencias con bases y límites distintos. La nueva herramienta de vínculo sigueOFF: esta puerta no activa ni certifica consumidores aún en desarrollo.

## Tercera integración: compatibilidad comprobada antes de activar

Se unieron los modelos y el guard tipado de Compras, su COPY mínimo, recuperación durable de Stock en sessionStorage y su composición real, más ventanas acotadas de lecturas OT. Se resolvió un conflicto de tabla de acciones conservando las entradas de ambos frentes. Pruebas centrales Compras/Stock/OT84PASS; UI durable12PASS; composición con comando/guard/store reales5PASS; tercera optimización OT26PASS. Nada de esto activa rutas nuevas.

La repetición central de la candidata B inicial sobre el núcleo E actual dio43PASS/3FAIL: los recibos de E habían pasado de6a7campos al agregar committed:true, y las reglas propuestas aún exigían6. No se atribuyó la tanda previa de B al conjunto. Se alineó la forma exacta de7campos con committed booleantrue y ataques específicos; nueva repetición central63PASS/0FAIL/0SKIP con la base remota copiada íntegra y los módulos ya unidos. Emulador propio cerrado. Se conservan ambos logs privados stock-link-rules-central y stock-link-rules-central-v2.

Continúan OFF y pendientes el cierre de cobertura dirigida E, consumidores OT/Compras completos, orden global C y coordinación del corte bajo una única activación de cohorte. No hay un flag adicional independiente que pueda habilitar una migración parcial. El ahorro OT se midió sólo con IO ficticio150ms (ejemplos1/6/12materiales documentados), no se declara desaparecida la demora de producción. No se construyó ni publicó una imagen ni se cambió stock, pagos, comisiones o permisos reales.

## Compatibilidad de pruebas con lector dirigido y orden global

Después de incorporar el lector ordenado, la preservación nativa rechazó office-stock.js por el cambio de lectura autorizado. Se mantienen todos los hashes nativos: una fixture pública con hunks exactos del commit02ba0c58 reconstruye su predecesor, luego se aplican las derivaciones ya revisadas.11pruebas de preservación PASS, incluidas alteraciones indebidas de guardas/operación y una nueva alteración del lector que debe rechazarse. No se cambió el hash para aceptar cualquier código.

La primera composición de UI con E01347/5ee detectó4timeouts: el transporte ficticio de la prueba no aplicaba filtros/rangos y conservaba el queryPage simulado de una versión anterior. No se modificó el producto ni sus aserciones para ocultarlo. El transporte usa ahora queryRows verificado por el emulador, exige límites de consultas de colecciones y compone explícitamente store.queryPage;5recorridos de recuperación PASS con permisos revocados/usuario cambiado/almacenamiento lleno y un solo efecto. Log stock-durable-directed-v2.private.log. La fuente publicada sigue igual.

Bloqueo de rendimiento explícito antes de habilitar consumidores: con el planner anterior,641IDs numéricos podían exceder la consulta global de números y rechazar una referencia única;12materiales mapeados alcanzaban2124solicitudes. D y E reproducen y corrigen con igualdad/inversión acotada del normalizador, ventanas de6 y reutilización sólo dentro de la misma fase. No se activará un flujo funcional que degrade ese comportamiento. Los perfiles anteriores, rechazos y vencimiento de lease quedan como evidencia, no como celdas exitosas.

## Tercera puerta completa de integración

Fuente fija 7fe2c12063470e17d8146082fba20919554649f7, código c011fd8e: 11415 total / 11324 PASS / 0 FAIL / 91 SKIP / 0 canceladas, script vigente salida 0. Lotes: 2882/2871/11; 2820/2818/2; 2434/2399/35; 2496/2468/28; 783/768/15 (total/pass/skip). Evidencia privada puerta-tercera-integracion.private.log. No se modificó código durante la corrida. No incluye entregas posteriores de consumidores, proyecciones de orden o Compras vinculadas.

La migración de escritores todavía no está cerrada: alta de órdenes, listas desde ventas, preparación, reservas, recepción/cancelación, agrupación y devoluciones conservan recorridos SDK que bloquearía un corte prematuro. El comando manual existente exige orden previa; no equivale a crearla. Un modelo puro de creación con inventario existente se entrega por separado; no prueba la creación inicial de inventario. El cierre SDK permanece propuesto y OFF.

Rendimiento OT: con núcleo dirigido 1c18 y 641 productos, doce vínculos explícitos tardan aproximadamente 44 segundos a 150 ms por lectura y superan la ventana de operación. Aunque una fixture sin reglas haya aceptado el PATCH, el caso no está aprobado. D conserva límite global de seis lecturas y fases frescas separadas; E prepara consumo puntual de vínculos inmutables bajo cohorte verificada. Crear un vínculo sigue requiriendo descubrimiento completo. No se extiende la ventana ni se omiten controles para conseguir un resultado verde.
