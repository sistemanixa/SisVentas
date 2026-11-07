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
