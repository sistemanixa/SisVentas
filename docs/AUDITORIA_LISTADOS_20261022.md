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
