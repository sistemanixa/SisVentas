# Listados: transferencias repetidas y suscripción SAC

Preparación posterior a la publicación verificada v3.14.5. Rama
`codex/listados-historial-condicional`, base `e788385dba8d0843fae16c0310c306b3bdbd8193`.
Estos cambios todavía no están publicados. No modifican operaciones comerciales,
reglas remotas ni comisiones; no se probaron con escrituras de datos reales.

## Selector de presupuestos de Proyectos

Abrir Vincular consultaba toda la raíz de Presupuestos mediante SDK, incluso sin
cambios desde la apertura anterior. Se reutiliza el lector condicional comercial
existente sólo para esa consulta explícita. La fuente se valida en cada solicitud
con ETag actual; no se cachean permisos, no hay reloj ni se agregan servicios.

La autenticación y las identidades, perfiles y permisos siguen comprobándose en
cada solicitud. El resultado conserva todas las propuestas autorizadas y el DTO
anterior. Guardar/vincular sigue comprobando la ficha puntual y su propietario;
no utiliza la copia de este selector para autorizar una escritura. Un error HTTP,
de red o JSON rechaza la solicitud, sin devolver datos anteriores como actuales.

`projects-selector-etag.test.cjs`: once casos, incluidos perfiles modificados
con304, propietario cambiado, revocación y304 demorado frente a un200 más nuevo.
El resto de los contratos de Proyectos y su empaquetado también pasan.

Benchmark privado contra la fuente exacta de la base, con1.200 presupuestos
ficticios:24 pares alternados por caso,72 pares con DTO idéntico. Incluye lectura
instrumental de contexto y raíz, serialización y filtrado; excluye preparar la
fixture, red real, arranque de instancia y facturación.

| Caso | JSON recibido desde las fuentes, antes → candidata | GET | Respuesta al cliente |
|---|---:|---:|---:|
| Sin cambios, instancia con copia previa | 1.296.269 → 898B | 8 → 8 | 344.267B, idéntica |
| Primera apertura | 1.296.269B, igual | 8 → 8 | 344.267B, idéntica |
| Fuente modificada | 1.296.266B, igual | 8 → 8 | 344.264B, idéntica |

CPU local p50:sin cambios2,94→2,74ms; primera apertura3,17→8,14ms y
fuente modificada2,67→7,16ms. La copia y serialización condicional añaden trabajo
cuando hay que descargar de nuevo. No es una promesa de menor primera carga ni
un ahorro monetario. Una instancia nueva, una raíz modificada o demasiado grande
sigue leyendo la colección completa; esto no equivale a paginar el historial.

## Gastos: suscripción de Aguinaldos sin consumidor

El módulo histórico instalaba `onValue(sisventas/aguinaldos)` al cargar Gastos.
Su copia privada sólo alimentaba funciones locales sin consumidores activos,
mientras la tabla final utiliza Gastos y el alta SAC tiene su propio circuito.
La suscripción sobrevivía a la salida de Gastos y podía provocar repintados por
cambios que no aportaban información a la tabla.

Se retira exclusivamente su arranque, sin cambiar el cálculo, fecha, selección,
duplicados, confirmaciones ni guardado de SAC. Las fuentes legítimas de Gastos y
la sincronización de otros módulos permanecen. El listener era push; no se le
atribuye una tarea por reloj ni un cargo concreto. La URL del módulo y su entrada
SHELL se renuevan para una publicación posterior.

`payroll-orphan-listener.test.cjs`:17 casos funcionales con los cuatro módulos
cargados en el orden real del índice, funciones activas y SDK/DOM ficticios.
Cubren admin/cuenta propia/sin acceso, filtros/KPI, pagos activos/anulados,
retirados, revocación, baja de escuchas y alta por formulario→adaptador→gateway→
guard en memoria. Incluyen doble clic/replay, CAS de duplicado concurrente,
cancelación y rechazo conservando el formulario y los pagos anteriores.
Las tres regresiones de escucha fallaban antes de retirar la llamada.

Comparación privada adicional:24 pares idénticos, con360 marcas ficticias y60
empleados; JSON entregado a listeners21.121→1.630B, repintados2→1,
CPU local p50 de la operación1,691→1,267ms. La preparación del entorno se excluye
y se mide aparte. No representa protocolo RTDB, latencia web ni factura.

## Verificación y límites

Puerta vigente:4.032 aprobadas/27opt-in omitidas/0fallos,4.059total,38,43s.
Suite propia Cotizador94/94. Focales de Proyectos/SAC/paquete:103aprobadas; son subconjunto de la puerta, no
sumar. Sintaxis y diff correctos. No se cambian pagos, permisos ni comisiones.
Las pruebas de guardado usan exclusivamente un store ficticio; no certifican una
operación financiera productiva ni el servidor desplegado.

Evidencia privada en `tmp/listings-next-private`:benchmark de Proyectos con fuente
actual, prueba comparativa SAC, regresiones y logs. No versionar perfiles, datos
ni salidas privadas. Para activar la parte Proyectos hace falta publicar una
revisión nueva de Cotizador; esta preparación no lo hace ni anuncia una versión
web nueva. La producción sigue en5 y conserva su backend anterior.

Pendientes materiales de la auditoría:primera descarga de listas completas,
refresco de Ventas tras un guardado con retorno parcial, cálculo repetido por fila
del historial de Cobranzas, lectura de Haberes de empleados no seleccionados y
ramas financieras legacy que requieren cobertura de índices y escritores
coordinados. No recortar filas/fechas ni omitir refrescos para aparentar totales
completos. Cuenta corriente ya agrupa referencias y no se informa falsamente
como un cruce completo por cada venta.

### Prototipo privado de saldos de Cobranzas

Se preparó aparte un índice efímero por render, conservando el matcher canónico y
la suma desde cero en el orden publicado. Un acumulado inverso puede cambiar un
centavo y se descartó. La comparación privada incluye alias, prioridad técnica,
saldo guardado, anulados, objetos repetidos, HTML, mutaciones entre renders y
referencias malformadas antes/dentro del sufijo. El fallo de indexación vuelve al
bucle original; no omite registros. Se añadió la guarda de lista realmente array
para preservar null/undefined con índice cero.

No está aplicado ni versionado como función activa. El seguimiento del22/10
completó dos benchmarks privados sobre la app candidata6:1.000 y5.000 pagos,
50filas visibles,10pares alternados por escenario y2calentamientos excluidos.
Cada par comprobó fuera del intervalo medido HTML, paginación, contador y
objetos visibles exactos. Los contadores instrumentados por separado confirmaron
el mismo número de adiciones IEEE y0lecturas/escrituras de red.

| Caso | p50 con1.000 pagos, anterior → candidata | p50 con5.000 pagos, anterior → candidata |
|---|---:|---:|
| Ventas dispersas | 220,42 → 8,67ms | 3.562,62 → 63,83ms |
| Una sola venta | 225,10 → 9,18ms | 3.751,10 → 108,13ms |
| Saldos ya guardados | 3,083 → 3,080ms | 12,83 → 13,01ms |
| Alias compartidos adversos | 254,75 → 260,21ms | 3.380,14 → 3.692,62ms |

Se mide el render síncrono real, cálculos de sufijos y formato monetario con DOM
ficticio. Se excluyen fixtures, compilación/creación deVM, aserciones, red y
arranque. El escenario adverso de5.000 pagos empeoró9,24%; su p95 pasó de
3.961,22 a4.127,15ms. Los grupos densos también retienen más memoria durante el
render. Por ese resultado **la candidata no queda aprobada para integrar en6**;
hay que mitigar ese caso y repetir su cobertura antes de incorporarla. No es una
mejora universal ni una reducción de la raíz de pagos descargada.

Los SHA del balance, matcher y helper siguen siendo exactamente los del corpus
anterior de2.620 comparaciones; esos casos no se contabilizan como una nueva
ejecución. Los benchmarks nuevos compararon cada render medido, sin repetir el
corpus completo. Evidencia privada: `cobranzas-saldo-followup-1000.private.json`,
`cobranzas-saldo-followup-5000.private.json`, sus runners/logs y
`listing-followup-20261022.private.md`, en la misma carpeta tmp. Una integración
futura requiere pruebas permanentes sobre la aplicación activa y una versión
nueva; no editar la app5 ya publicada.

### Próxima raíz histórica: Haberes de SAC

`abrirModalAguinaldo` descarga `sisventas/haberes` completo para mostrar empleados
activos y seis meses. `recalcularAguinaldo` vuelve a descargar esa raíz tanto al
cambiar el semestre como por cada `oninput` del máximo por empleado. El módulo
`payroll-selector.js` envuelve y delega el original, conservando esa lectura.
La confirmación activa de `payroll.js` también descarga la raíz aun cuando sólo
se eligieron uno o pocos destinatarios.

Una prueba offline del cálculo/render activo con SDK ficticio reprodujo cinco
lecturas de esa raíz al escribir cinco valores del máximo. Con200empleados y
132meses ficticios por empleado, cada JSON completo ocupa4.068.891B; conservar
los seis meses de12empleados activos ocupa11.271B y produce exactamente las
mismas filas del cálculo. Es tamaño de JSON local, no tráfico real ni factura;
las lecturas puntuales pueden aumentar el número de solicitudes.

Propuesta sin aplicar: cargar los meses del semestre para los empleados que se
deben mostrar al abrir/cambiar semestre y recalcular el máximo sobre ese snapshot
efímero del modal. Al confirmar se debe releer el semestre de los destinatarios
seleccionados y conservar la validación financiera y CAS de duplicados de Gastos.
Falta probar respuestas tardías, selección, frescura, concurrencia, revocaciones,
cierre y errores; una copia de presentación no debe autorizar la escritura ni
presentar un total recortado como completo. Evidencia privada:
`haberes-repeated-read-proof.private.cjs/.json`.

También se identificó `_verificarHaberesPendientes`: el inicio de sesión lo
programa una vez con `setTimeout(...,6000)` y, sólo los días1–5 y con permiso
`empleados.avisarHaberes`, lee Haberes completo para comprobar un único mes.
Es una consulta retrasada por inicio de sesión, no un proceso recurrente del
servidor ni evidencia de la causa de cargos anteriores. Se propone revisar el
disparador para una acción explícita en Empleados/avisos y leer sólo el mes
necesario por empleado autorizado, conservando el aviso y su permiso. No se
modificó este circuito ni se retiró su información durante el diagnóstico.

### Revisión de frescura de SAC posterior a la publicación6

La publicación6 está cerrada; lo siguiente es diagnóstico privado separado, sin
cambios funcionales aplicados. `fbGet` es el `get` del SDK: puede devolver caché
cuando no alcanza al servidor. Repetir la query al confirmar no acredita por sí
solo una respuesta de red. El patrón REST autenticado/no-store de GuardedWrites
existe, pero su transacción intercepta Haberes hacia el adaptador laboral; no se
lo debe invocar como si fuera un lector sin efectos. Un GET REST acotado al rango
del semestre, sin fallback SDK, es una propuesta local de lectura, no un servicio
nuevo ni una autorización para publicar otro servidor.

Hay además un límite financiero previo independiente de la velocidad: el helper
actual `_guardarAguinaldosAtomico` compara Gastos, no los salarios mensuales con
que se calcularon las filas. Una prueba con helper/adaptador/gateway/guard reales
en memoria reprodujo que, si el sueldo cambia entre cálculo y commit, no se
recalcula el SAC por ese CAS. No se usaron datos ni red reales. Un GET REST fresco
soluciona la posible caché al leer, pero no cierra esa carrera posterior; no se
debe anunciar una garantía de concurrencia de Haberes que no existe.

La variante privada de CAS de seis hojas mensuales detectó el cambio y recalculó
una única alta; con una fuente SDK permanentemente obsoleta rechazó sin escrituras.
El presupuesto128 admite21personas más Gastos con esa forma. Comparar un padre
por empleado amplía a127 pero vuelve a leer su historia al confirmar; un fallback
de raíz para conservar grupos mayores recuperaría una lectura global. No se
integró ninguna opción ni se redujo silenciosamente la capacidad. Empleado,
cargo y valores de respaldo concurrentes requieren revisión propia si se amplía
la protección. Evidencia privada: `sac-source-cas-review.private.cjs/.json` y
`sac-source-freshness-review.private.md`.

Por tanto la propuesta del controlador del modal y su lector permanece privada
hasta completar la prueba REST, la revisión de esta ventana de concurrencia y
sus límites. Ninguna cifra de la fixture anterior con SDK certifica el lector
REST posterior. No se publicó una corrección parcial ni se modificaron sueldos,
aguinaldos, pagos, permisos o comisiones reales durante este diagnóstico.
