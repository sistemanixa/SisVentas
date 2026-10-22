# Haberes y SAC: lectura por semestre

Preparación de v3.14.7 sobre la v3.14.6 publicada. Además de la web, esta tanda
requiere Cotizador compatible y una restricción del recibo obligatorio en reglas.
No crea servicios ni requiere ejecutar una migración o backfill de datos.
La publicación de esta candidata queda pendiente de coordinación y autorización.

## Qué cambia

Al abrir Registrar aguinaldo se consulta el rango de seis meses de cada empleado
activo. La respuesta proviene de REST autenticado, sin caché HTTP, con seis
solicitudes simultáneas como máximo. No se usa un resultado SDK posiblemente
cacheado como sustituto de una lectura fallida. Cambiar el máximo o la selección
recalcula localmente; cambiar de semestre o pulsar Reintentar inicia una lectura
explícita nueva. Durante una carga incompleta el total es desconocido y se bloquea
Confirmar; no se presenta un subtotal parcial como definitivo.

Cerrar el diálogo, cambiar de sesión o perder el contexto invalida las respuestas
anteriores. Ocultar la pestaña aborta las lecturas pendientes y no inicia las
restantes. Volver a mostrarla no consulta por sí solo: requiere Reintentar.
El estado ocupado muestra el proceso, evita doble envío y mantiene el foco en
el diálogo. Al cerrar se restauran el foco y el scroll de la pantalla anterior.

Se retira la revisión de Haberes que se programaba seis segundos después del
inicio de sesión. Su reemplazo es **Empleados → Revisar haberes**, con el permiso
existente `empleados.avisarHaberes`. Conserva los días 1–5, el mes anterior local
y los empleados activos con cargo. Consulta una hoja empleado/mes por persona,
sin leer Gastos ni la raíz Haberes. Un directorio incompleto, fallo parcial o
denegación no se informa como cero pendientes. El resultado completo se mantiene
visible bajo la cabecera; salir o cambiar de contexto lo descarta.

## Cálculo y confirmación

Las fórmulas, coerciones históricas, meses trabajados, redondeos, tope, fecha del
gasto y detección de duplicados se conservan. La previsualización no autoriza el
importe a guardar. Dentro del constructor atómico se vuelven a leer y comparar
los sueldos consumidos, el empleado y el cargo si se necesita su valor supletorio;
el cálculo usa exclusivamente esas fuentes actuales.

Un sueldo que cambia entre lectura y escritura produce un conflicto y un nuevo
cálculo antes del único commit. El servidor contrasta el mejor sueldo y el techo
canónico; admite un máximo manual menor, nunca un importe superior al cálculo.
Cambios de identidad, ingreso, cargo o actividad
del empleado exigen revisar otra vez el semestre. Si desaparece el sueldo y el
plan no incluía el cargo ahora necesario, no se inventa esa fuente: se invalida
la previsualización y se pide recargar. No se concede sólo una parte del grupo.

Se conserva el CAS de `sisventas/gastos` completo para reconocer duplicados
legacy, incluidos los pagados. Las claves estables y la operación del formulario
evitan duplicar un reintento. No se reescriben Haberes, CTA, pagos, bonificaciones
anteriores, marcas SAC antiguas ni comisiones.

## Alcance de las lecturas al confirmar

El transporte existente admite hasta 128 fuentes por operación. No se aumenta
ese límite ni se divide el grupo en altas independientes. El plan intenta:

1. Historia de Haberes por empleado, su ficha, cargos necesarios y Gastos.
2. Si no cabe, agrupar cargos, después empleados y finalmente Haberes.

Sin cargos supletorios, hasta 63 empleados caben con sus fuentes individuales;
con cargos distintos para todos caben 42 antes de necesitar padres compartidos.
Para grupos extraordinariamente grandes puede volver a leerse Haberes
completo, únicamente al confirmar. No se elimina silenciosamente ningún
destinatario para caber en el límite. El descriptor informa el alcance elegido.

Esta protección añade fuentes y solicitudes a la confirmación frente al SAC
anterior. La mejora principal está en la lectura de pantalla y en dejar de
descargar toda la historia por cada tecla. Gastos completo continúa siendo una
fuente de confirmación; esta tanda no resuelve toda la auditoría de listados.
Los tiempos y bytes de fixtures no equivalen a factura, protocolo de red ni
latencia de producción.

La variante de seis hojas por empleado se descartó como opción inicial: en la
fixture de cuatro empleados elevaba la confirmación de 10 a 65 GET. Usar padres
por empleado redujo esa cifra a 25 antes de incorporar el propósito de permiso
y la reutilización de snapshots autorizados. No se confunde ese resultado
intermedio con las métricas del paquete final.

## Permisos y concurrencia

Se mantienen las comprobaciones de sesión, rol, revisión de permisos y contexto
del cliente, y el transporte/gateway/guard existentes. Las fuentes se comparan
bajo su contrato de concurrencia, sin ampliar permisos de lectura o escritura.
Una denegación de lectura interrumpe la operación, sin fallback a datos viejos.

La revisión encontró que administrar Gastos podía permitir una alta SAC genérica
aunque se hubiera revocado registrar Haberes. El propósito `employee-sac-batch`
identifica el alta, exige `empleados.registrarHaberes` vigente y compara sus
fuentes. El guard y el recibo del mismo PATCH revalidan ese contexto. No se acepta
omitir el propósito ni inventar una marca legacy para eludirlo. Los pagos y las
bajas de SAC existentes conservan sus contratos propios.

Dentro del mismo intento se puede reutilizar un ancestro cuya lectura como
usuario ya fue autorizada. Eso evita descargar otra vez cada hijo al validar
sus cambios. No comparte datos entre intentos/UID, no reemplaza una autorización
denegada ni cachea permisos; conserva la comparación CAS de todas las fuentes.
No se promete protección contra un escritor privilegiado que eluda el guard.

## Compatibilidad de la migración manual

La función existente de Mantenimiento puede recuperar SAC desde Aguinaldos o
desde CTA. Su propósito separado `employee-sac-migration` exige administrador
con `mantenimiento.migrar`. El servidor reconstruye el resultado desde fuentes
reales comparadas; un campo `origenLegacy` enviado por el cliente no basta.

Los SAC de una ejecución se agrupan en un único guardado con Gastos compartido y
fuentes puntuales o padres adaptativos. Así se evita descargar Gastos N veces.
Cada Gasto y su backlink/marca de origen se confirman juntos. Un Gasto existente,
incluidos sus pagos, no se reemplaza. Una referencia rota o un duplicado ambiguo
exige revisión; no se elige arbitrariamente un destino.

Corrección acotada: la rama Aguinaldos anterior ignoraba historia económica que
la fuente pudiera contener. Ahora se conserva con la misma normalización de
pagos que CTA; sin historia económica sigue siendo un pendiente. CTA conserva
su semántica publicada, incluido su mapa de pagos original. Esto no es una
revisión general del tratamiento de pagos anulados ni recalcula históricos.
Una lectura o confirmación fallida se informa como incompleta. Mantenimiento no
marca OK ni inicia su siguiente fase de comisiones después del rechazo SAC.
No se ejecutó este circuito
sobre datos reales. Los cálculos de horas extra y comisiones quedan fuera.

## Requisitos antes de publicar

Revisar y desplegar el servidor compatible, moviendo sus accesos existentes a
la revisión nueva para no dejar un escritor antiguo como alternativa. Respaldar
y comprobar una base remota fresca antes de aplicar el AND del recibo. El builder
offline parte de `a4b9a66f6ae6f272683bfcbf9c4cd6245436aa3f6bdc9e96de4aa098722ca4ad`
y sólo cambia `sv_labor_receipts/$op/.write`; no agrega grants ni modifica fiscal,
pagos o índices. Después publicar Hosting y verificar activos/versión antes de
actualizar el aviso. La web sola no es compatible con el servidor anterior.

## Evidencia

Puerta final: **4.482 aprobadas, 27 omitidas opt-in y cero fallos** (4.509 total,
36,06s), más Cotizador94/94. Las62 pruebas de política SAC,23 de fuentes,35 de
controlador semestral,49 de revisión manual,35 de migración,9 de integración de
Mantenimiento y95 de reglas forman parte de la puerta; no sumar sus cifras.
Motor RTDB real:32/32, incluidos20 recorridos gateway/guard/store y12 de la regla
final. Corresponden a la política `c52f43fe…`; monto inflado rechazado sin PATCH,
máximo menor aceptado, revocaciones finales sin parciales. Namespace ficticio
eliminado y emulador detenido. Sintaxis, diff y coherencia local7 correctos.

Las regresiones permanentes ejecutan las funciones activas y los módulos del
índice en su orden real. Cubren rango y recálculo local, selección, respuestas
tardías, cambios de semestre, sesión y permiso, fallo HTTP/JSON/token, ocultamiento,
reintento, equivalencia con el cálculo canónico, CAS de sueldos y cargos, nuevos
fallbacks, grupos grandes, duplicados y conservación de historias pagadas.
El transporte financiero usa gateway y guard reales sobre un store ficticio.

La revisión de pendientes tiene pruebas separadas de calendario local, ventana
1–5, directorio incompleto, pool, cancelación y ausencia de arranque automático.
La evidencia privada, capturas y mediciones quedan en
`tmp/listings-next-private`, fuera de Git. No se usaron guardados financieros
reales ni se borró la navegación para comprobar esta tanda.

La QA visual aislada pasó ocho escenarios con funciones y módulos actuales,
CSS locales y datos ficticios:320/390/768/1280, scroll interno, foco/Tab/Escape,
error/reintento y botón ocupado. Los hashes de todas sus fuentes coinciden con
la candidata final. La fuente externa de iconos se bloqueó deliberadamente;
no equivale a probar el login o una operación financiera productiva de7.

## Medición y límites de rendimiento

Fixtures de60 meses por empleado, tres ejecuciones de la candidata final, con
tabla, totales y Gastos exactos frente a las funciones de la app6 inmutable.
Cada ejecución genera1POST/1commit ficticio. El baseline de transporte procede
de las comparaciones emparejadas guardadas antes del nuevo contrato; no se intenta
ejecutar un cliente antiguo contra el servidor que ahora lo rechaza correctamente.

| Empleados | Cambios del máximo | GET antes → candidata | JSON recibido antes → candidata |
|---:|---:|---:|---:|
| 4 | 5 | 16 → 31 | 275.783 → 83.451 B |
| 24 | 5 | 36 → 131 | 1.654.363 → 499.939 B |
| 70 | 5 | 82 → 223 | 4.825.097 → 1.459.011 B |
| 4 | 0 | 11 → 31 | 79.998 → 83.451 B |

Las teclas consumen0GET/0B. Abrir recibe2.612/15.672/45.710B para4/24/70 empleados.
Confirmar recibe80.839/484.267/1.413.301B con27/107/153GET, respectivamente.
Se instrumentan también los dos GET iniciales del propósito nuevo y las
lecturas de control, autorización e índices. Un snapshot autorizado del mismo
intento evita GET redundantes de hijos, sin eliminar autorización o CAS.

El caso de cuatro personas sin cambiar el máximo aumenta4,32% de JSON y añade
consultas por una protección que antes faltaba. No se promete ahorro universal
ni más rapidez al guardar. El benchmark anterior de70 personas registró una
regresión de CPU local de9,26%; no se la descarta con estos contadores nuevos.
No se midió latencia productiva, cabeceras/protocolo ni facturación. No se agregan
servicios, instancias mínimas, suscripciones históricas ni tareas por reloj.
Quedan abiertas las primeras cargas completas y otras ramas documentadas en la
auditoría. Un fallo previo de comparación de hijos nuevos de un padre CTA
genérico también queda separado; no se cambió su política de bonificaciones.
