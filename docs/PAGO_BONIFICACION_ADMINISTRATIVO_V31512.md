# Pago de bonificaciones desde Gastos ·v3.15.12

El administrativo con gastos.pagar y gastos.administrar puede confirmar el pago
de una bonificación aprobada sin empleados.verCuentas ni acceso a sueldos.
Endpoint específico POST /laboral/bonificaciones/pagar; sólo al confirmar.
Sin cambios de reglas, roles, IAM, flags, vistas ni preparación de la base.
Se conserva la autoridad/fence/recibo/índice existentes del servidor publicado.

Cliente envía claves de gastos, importe, revisión de saldo/vínculo y comprobante;
no envía un parche ni descarga ctaemp. Servidor verifica identidad y reset,
acciones vigentes, lectura autorizada del gasto, tipo bonificación, aprobación,
saldo, vínculo exacto y acuerdo con el movimiento. Lee sólo ese movimiento.
Un PATCH confirma gasto/movimiento/adjunto/lote/índice/recibo y libera fence.
Revalida originales, lectura y permisos inmediatamente antes del commit;
reglas existentes conservan control de rol/revisión/reset/lease/recibo.

No cambia creación ni cálculo de bonificaciones, períodos o importes originales.
No genera comisiones ni altera ventas, sueldos, otras cuentas o pagos anteriores.
Los gastos de otra clase mantienen su escritor existente; esta versión no activa
la candidata amplia15.7. Los lotes admitidos por este endpoint son de bonificaciones.
Vínculo ausente/ambiguo o saldos discordantes se rechazan, sin inventar relación.

ID estable y digest íntegro; recuperación explícita usa /laboral/operacion.
Un mismo intento vuelve a confirmar/consultar sin agregar pagos. Un intento
cancelado antes del commit deja tombstone y no puede ejecutar tarde. Un pago nuevo
no puede superar el saldo ni volver a pagar una bonificación ya completada por admin.
La cuenta queda interna: respuesta sólo con claves y resumen del gasto ya legible.
Cliente actualiza su lista tras acuse y no pisa una sincronización más reciente.

Pruebas ficticias:75focales de comando/cliente/guard/recuperaciónPASS; primera
puerta6.165total/6.138PASS/27opt-in/0fallos; cinco casos extra de reset y lotePASS.
94servidorPASS. Formulario real y cliente/servidor con guard real contra memoria:
390/1280PASS, estado Registrando visible y un solo commit, sin red de negocios.
21comprobaciones locales de expresiones exactas de reglas remotasPASS; no es
un emulador ni una escritura productiva. No se pagó ninguna bonificación real.
AST: sólo _registrarPagosGastosAtomico cambiado en app; resto idéntico a15.11.

Costo informado antes de infraestructura: compilación/publicación estimada<USD1,
sin nuevos servicios/costo fijo/sondeos. Cada pago añade lecturas puntuales sólo
durante su acción. Evidencia privada tmp/bonus31512-release. La publicación se
registrará en CONTEXTO_ACTUAL sólo después de verificar servidor y Hosting.
