# Retiro del observador de comisiones

Pedido expreso del titular: eliminar la vía desactivada que permitía volver a instalar un observador periódico y evitar barridos históricos por reloj o instancias permanentes para ese fin. Esta corrección es local y requiere integración y publicación separadas. No acredita la configuración de producción.

## Cambio

- Se elimina `start()` de la fábrica de generación y su exportación: no quedan la escucha global de ventas pagadas, el estado del observador, su intervalo de60segundos ni sus reintentos por reloj.
- Se retira `commission-job-events.js` y su COPY del contenedor; no se conserva un instalador alternativo de escuchas/timers.
- Un `COMMISSION_OBSERVER_ENABLED=true` antiguo falla cerrado antes de `server.listen`. No se convierte silenciosamente en un servidor que dejó de generar comisiones.
- Con generación habilitada, el servidor sigue exigiendo el receptor de eventos. Se mantienen los comandos explícitos autorizados y los eventos reales, con validación/idempotencia vigentes.
- `retryPending(id)` exige una venta concreta antes de leer. No existe el modo sin argumento que descargaba todos los trabajos. La recuperación conserva corte temporal, reserva y máximo de cinco intentos; no cambia comisiones/pagos existentes.

No se tocó el modelo económico, los costos originales, porcentajes, participantes, estados de aprobación, reglas RTDB ni receptor de eventos. Las breves suscripciones que necesita una transacción puntual se cierran en `finally`; no son observadores en reposo.

## Pruebas

Los archivos de prueba se conservan. Los escenarios del observador se trasladan a acciones explícitas y guardas de ausencia de temporizadores/listeners; no se elimina la comprobación de generación, límites, aprobación, idempotencia, corte histórico o recuperación. El contenedor se comprueba contra sus dependencias reales.

Focales: generación, evento/replay/coordinación/HTTP, arranque y dependencias del contenedor. Emuladores:20casos comerciales y27laborales, incluidos permisos, comisiones originales, cortes entre cuenta/gasto y replay. Suite vigente con Chrome/loopback permitidos. Confirmación final:75focalesPASS,47emuladorPASS, suite7238total/7211PASS/27skip/0fallos. Sintaxis y diffPASS. No se construyó ni publicó una imagen; la integración debe construir/verificar su revisión exacta. SHA se registra en CONTEXTO_ACTUAL al entregar.

Evidencia privada fuera de Git: `C:/SisVentas/tmp/auditoria-maestra-observador-focales.log`, `auditoria-maestra-comerciales-sin-observador.log`, `auditoria-maestra-labor-sin-observador.log` y `auditoria-maestra-sin-observador-suite.log`.

## Integración

Aplicar sólo el commit de este retiro sobre la versión vigente, preservando el WIP de Cuenta corriente del otro chat. Antes de publicar, comprobar la configuración exacta del servicio: el flag retirado no puede ser `true`, y si la generación está habilitada el receptor de eventos debe estar habilitado. No cambiar esos valores por inferencia, ni reactivar el observador como alternativa. No requiere migrar, borrar o recalcular datos ni crear infraestructura.
