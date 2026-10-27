# Pago administrativo de bonificaciones ·27/10/2026

## Diagnóstico

La web publicada15.10 muestra Abonar con gastos.pagar y gastos.administrar,
pero _registrarPagosGastosAtomico lee sisventas/ctaemp/<empleado> completo
antes de construir el pago. La configuración administrativa permite ambas
acciones de Gastos y niega empleados.verCuentas/empleados.pagarMovimiento.
La regla remota de lectura de cuenta ajena exige verCuentas. Por ello la
lectura previa falla con Permission denied aunque pagar el gasto esté autorizado.
No es necesario volver a pagar ni modificar la bonificación ya pagada por admin.

Se leyeron una vez reglas y configuración del rol, sin leer registros comerciales,
empleados, comprobantes ni movimientos reales. Evidencia privada fuera de Git:
C:/SisVentas/tmp/bonus-payment-audit. No se otorgó acceso a salarios/cuentas.

## Corrección candidata y pruebas

El comando por gasto ya preparado usa una fila autorizada y conserva la cuenta
original dentro del guardado, sin entregarla al operador. Se completa el control
de pay para exigir gastos.pagar además del control gastos.administrar existente.
Una denegación explícita de pagar prevalece aunque administrar esté habilitado.
No se modifica el circuito de aprobación ni de corrección/anulación de pagos.

69pruebas focalesPASS. Nueva regresión con cinco unidades por20pesos, importe100:
administrativo sin Empleados ni CtaEmp, todas las lecturas privadas como usuario
denegadas, pago con comprobante y mismo ID en gasto/movimiento en un solo commit.
Sueldo ajeno e historial conservados, replay sin duplicación. Rechaza aprobación
pendiente, exceso, cambio de permiso, revisión incorrecta y falta de acceso a fila.
Suite vigente8.117total/8.090PASS/27opt-in/0fallos;94servidorPASS.
Sintaxis/diff correctos. Pruebas financieras en memoria, no pago real ni prueba
visual de un guardado autenticado de producción.

## Límite de activación

Esto NO está corregido todavía en la web15.10. El comando pertenece a la candidata
amplia15.7; requiere vistas de cuentas preparadas, cobertura de escritores, reglas
y despliegue coherentes. No habilitar sólo el cliente ni ampliar la lectura de
ctaemp como atajo. Continúa pendiente el corte descrito en PENDIENTES_V3156.md.
No se publicó ni modificó servidor/reglas/flags/configuración de roles.
La preparación no agrega consultas por reloj ni infraestructura.
