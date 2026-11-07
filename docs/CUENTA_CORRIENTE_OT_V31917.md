# Cuenta Corriente y OT: integración conjunta local

## Alcance

Integra el hotfix CC de `bc20dc06` y una corrección acotada del cierre de OT.
Producción verificada antes del corte: web 3.19.16 y Cotizador
`cotizador-commission31916-db724dee`. La candidata CC separada no se activa.
Eliminaciones, Tecnoprices y otros frentes quedan fuera de esta entrega.

Cuenta Corriente conserva las mismas lecturas y los autores originales; aumenta
el paralelismo acotado de las referencias de presupuestos de seis a dieciséis
sólo en listados. Los guardados conservan su validación y concurrencia anterior.
Ver `CUENTA_CORRIENTE_APERTURA_V31917.md` para mediciones y límites.

El cierre OT admite el vínculo histórico en una sola dirección cuando original,
venta y resumen coinciden exactamente, con revisión entera positiva vigente.
No crea ni reasigna el enlace primario. Cualquier alias contradictorio conserva
el bloqueo. La regla evalúa primero este caso verificado para evitar consultar
un hijo cuyo identificador es nulo. Se mantienen el fence, sesión, rol, permisos,
asignación técnica y el alcance exclusivo de estado de instalación y auditoría.

## Validación y composición

Modelo/command/policy: 39 casos aprobados. Contrato de transformación y overlay
contra el baseline retenido: tres aprobados. Emulador con runtime desplegado
retenido y parche mínimo: 25 aprobados sin Pages y 25 con Pages. Son dos modos
del mismo conjunto, no cincuenta escenarios independientes. Incluyen admin,
administrativo y técnico asignado; rechazo con reglas anteriores; repetición y
respuesta perdida; vínculo contradictorio; revocación; cambio tardío de vínculo
y rechazo de escrituras ajenas de importes, pagos y stock. Comparación de todos
los totales comerciales antes/después, salvo su revisión de actualización.

Se preservan los intentos rojos: configuración restringida de loopback,
normalización inicial de arrays vacíos de RTDB en la fixture, evaluación del
enlace nulo en las reglas y una expectativa de campo de totales inexistente.
El modelo de servidor se aplica mediante overlay con hash fijo, conservando
cada byte fuera de la rama nueva. Hereda la imagen CC ya construida sin tráfico;
no sustituye el servidor completo por fuentes preparadas de otros frentes.

Preflight de reglas remoto: el hash coincide con el retenido
`dee40945c7224f449a1f460193c268796341bd97e3c82c8e00ea236385be1fb7`.
La candidata cambia exclusivamente `.write` de `estadoInst` y `audit` de la
venta, dentro de las capacidades OT existentes. No modifica concesiones padre
ni roles. Respaldo y datos de diagnóstico quedan privados fuera de Git.

## Estado al congelar

Pendientes en este checkpoint: puerta conjunta completa, compilación y revisión
sin tráfico del overlay conjunto, aplicación verificada de esas dos reglas,
activación conjunta, Hosting y comprobación web posterior. No se presenta como
publicado. No hubo cierre real de OT, pagos, movimientos de stock o comisiones
como prueba. El diagnóstico exacto real se ejecutó en memoria, sin transporte
de escritura; no acredita haber cerrado OT-179.


## Cierre publicado y comprobado · 07/11/2026

Fuente funcional congelada: `72db94334701bad67525445a08ec94ba0476cd7f`.
Puerta conjunta: 9.956 casos, 9.910 aprobados, cero fallos y 46 omitidos,
salida 0. SHA256 del log: `4254cd1fb019cfe29f82327b1789f71ccbbd41f771577e530a34b84b436cdc3e`.
Servidor: 94 aprobados; 47 focales conjuntos y tres recorridos cliente-servidor
con la fixture sin enlace primario aprobados aparte. No sumar conjuntos
solapados. El emulador propio terminó vacío, verificado por su teardown, y fue
detenido al finalizar.

Compilación `cf79104e-ca03-44ed-830b-ce1077b64326` SUCCESS. Revisión conjunta
`cotizador-ccot31917-dd416173` activa al 100%, incluidos los quince accesos
existentes; recursos, variables e identidad conservados. Digest de imagen
`sha256:cf7bcefb95650282ecb6a29aec3f33871c5f05371976ff3b1970d0122825dc65`.
Se aplicaron y releíeron exactamente las dos expresiones de reglas indicadas,
comprobando antes que no hubiera guardado financiero activo y que la base
siguiera idéntica al respaldo. Google no entrega ETag para reglas; la lectura
inmediata posterior confirmó la candidata. No se modificaron roles ni datos.

Hosting `sites/nixa-sisventas-seguro/versions/082c4e8d365a887a`: 637 activos,
cinco cargas. RAW idéntico antes/después: 21.168.044 bytes y manifiesto
`391e5f4ac54234af20b4d9609b95490d580066195b1599e8f712b73ec318c09e`.
Siete activos byte exactos, cabeceras comprobadas, tres rutas privadas404 y
dos endpoints anónimos401. Script oficial confirmó web, marcador, SW y aviso
Firebase v3.19.17-firebase. Respaldo privado de reglas y referencia Hosting
anterior, más script de reversión de revisión/accesos, conservados fuera Git.

QA web autenticada: versión17 y Sincronizado; Cuenta Corriente muestra listado
y saldos históricos, conserva filtro y resultados al volver. Reapertura
observada de lista visible: 503ms, no una medición de frescura completa. Los
GET/304 de revalidación en la nueva revisión tardaron 1,99–2,03s; un GET/200
tardó 3,24s. No es una comparación controlada ni una garantía de apertura
instantánea, ni acredita menos transferencia. La tarjeta legacy Vencidos sin
cálculo previo continúa sin importe; este bloque no inventa ese resultado.

OT-179 abierta y conservada en Finalizar, firma guardada, sin completar, editar
ni guardar. El modelo parchado aceptó el original exacto en memoria sin mutarlo
y sin crear un enlace primario, con cero transporte de escritura. Esto acredita
la corrección de la condición rechazada; deliberadamente no acredita un cierre
real de esa OT. No pagos, comisiones, stock ni pruebas financieras reales.
Sin push ni cambios en main. El cierre se limita a CC y OT; no activa los otros
frentes ni declara concluida toda la auditoría.
