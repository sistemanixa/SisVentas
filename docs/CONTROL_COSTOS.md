# Control de consumo de SisVentas

## Decisión del titular · 18/10/2026

- Mantener el sistema operativo durante octubre. No suspenderlo por el gasto ya acumulado.
- Avisos mensuales a USD15,21,27,30 y por proyección de USD30, para todos los servicios del proyecto SisVentas. Conservar el presupuesto anterior.
- Suspensión al recibir un aviso válido con costo mensual real de USD60 o más, **desde noviembre de2026**. No dar por activo el corte sólo por crear un presupuesto.
- Retirar consultas de datos por reloj sin una acción del usuario. Conservar autorización por operación, lectura inicial asociada al ingreso/navegación, eventos causados por cambios reales, reconexión y reintentos acotados de una operación concreta.
- Comisiones: el pago completo confirmado es el disparador; generación idempotente y participantes autorizados. No borrar, recalcular ni alterar comisiones existentes para probar. Verificar por separado la identidad inicial y los participantes al modificar esa regla; no confundir un cambio de responsable comercial con una modificación de beneficiarios.

## Candidato v3.12.19

Sin sondeo comercial cada15s, directorios cada30s, prueba de red cada10s, vigilancia HTTP/PWA por reloj, consulta automática horaria de cotización, latidos periódicos de presencia/métricas ni revisión periódica de notificaciones. Los intervalos que sólo dibujan una animación/reloj local o pertenecen a una operación que el usuario inició no equivalen a consultas de datos.

Los listados comerciales se actualizan al entrar, guardar o usar Sincronizar ahora. No prometer actualización espontánea de cambios remotos en una pantalla que queda inmóvil: el sondeo anterior se retiró. La autorización del servidor sigue vigente en cada operación. Usuarios conserva los eventos de cambio de directorio y de revocación. Los controles del SDK de Firebase y la renovación de sesión siguen siendo necesarios; no prometer cero tráfico de protocolo.

El observador de comisiones ya recibía eventos de ventas pagadas. Se elimina su recorrido completo de trabajos cada minuto: `commission-job-events.js` sólo programa reintentos de trabajos interrumpidos concretos, respeta reservas y límite de intentos y cancela al completar/quitar. El proceso existente permanece activo para recibirlos con navegadores cerrados. **Esto aún no elimina el costo de la instancia mínima permanentemente encendida.** No bajar sus instancias/CPU antes de reemplazar y verificar ese disparo.

No se agregó una caché de autorizaciones, ni una respuesta compartida entre usuarios, ni una nueva lectura automática de historiales para intentar ocultar el consumo.

## Corte por eventos de facturación

Código: `cloud-functions/cost-guard/`. Canal privado `sisventas-cost-guard-60`. Identidad exclusiva `sisventas-cost-guard`, del proyecto `nixa-sisventas`. Cuenta de facturación y presupuesto exactos se configuran por `COST_GUARD_BILLING_ACCOUNT` y `COST_GUARD_BUDGET_ID`; no obtenerlos de un mensaje arbitrario.

El controlador valida identidad del aviso, esquema, moneda USD, monto fijo60, costo real numérico y período mensual vigente. Ignora octubre, períodos anteriores/futuros, previsiones que aún no son gasto y presupuestos ajenos. Usa el mes de facturación de Google en America/Los_Angeles; no introduce un reloj de consultas en SisVentas.

Acción autorizada, al superar el umbral desde noviembre:

1. Deshabilitar la instancia RTDB de SisVentas mediante `instances.disable`, sin eliminarla ni cambiar sus reglas.
2. Poner en escala manual0 Cotizador, Asistente, emitirfactura y testtfapp. Quitar sus tags de tráfico: escala0 por sí sola deja accesibles las revisiones etiquetadas.
3. Esperar las operaciones de configuración y verificar el resultado. Guardar sólo metadata de tráfico para recuperación; nunca registrar entornos, secretos ni datos financieros.

Los roles versionados en `security/cost-guard-*.json` no permiten borrar recursos, alterar IAM ni desvincular facturación. El permiso para actualizar Cloud Run se vincula individualmente a los cuatro servicios, no a todos los servicios del proyecto. El permiso para suspender RTDB y leer operaciones está a nivel del proyecto. El titular aprobó expresamente esta identidad, recursos y permisos tras el bloqueo de la revisión automática.

Una base deshabilitada rechaza lecturas/escrituras incluso desde la consola. Mientras esté suspendido no habrá sincronización ni nuevas comisiones. La recuperación es manual por el titular: revisar costo/motivo, reactivar la instancia y restaurar escala/tráfico desde la metadata previa. No reactivar automáticamente al mes siguiente ni mediante un despliegue incidental. No desvincular la facturación como atajo: ese procedimiento puede terminar eliminando recursos.

## Costo y límites

Alertas por correo: sin cargo adicional de Cloud Billing. Estimación comunicada para el controlador: USD0–1/mes, con hasta200 avisos mensuales y ejecución de hasta un minuto por aviso, sin instancia mínima. No es un precio contratado, ni incluye la operación normal de los otros servidores, impuestos o servicios de IA externos. Verificar cuotas gratuitas compartidas, imágenes, compilaciones y consumo observado. Los cambios de código locales no acreditan un costo mensual futuro.

**No es un tope exacto de la factura.** Los avisos Pub/Sub llegan varias veces al día y tienen demora; pueden existir operaciones en curso, cobros tardíos y costos de conservación. Los caps nativos actuales no cubren RTDB y son por un servicio, no por todo SisVentas. No prometer que una suspensión por aviso cerrará la factura exactamente en USD60.

## Comprobación

- Suite vigente y casos `user-triggered-reads.test.cjs`, `commission-job-events.test.cjs`, `cost-guard.test.cjs` con datos ficticios.
- `npm ci` en el controlador y prueba opcional `node --test test/cost-guard-framework.integration.cjs`: HTTP loopback, aviso ficticio de octubre y obtención de credenciales bloqueada.
- Dependencias fijadas. Override de uuid11.1.1 para corregir el aviso de seguridad heredado de CloudEvents; probar el registro real y la serialización HTTP antes de desplegar. `npm audit --omit=dev` sin vulnerabilidades detectadas al preparar.
- Después del despliegue: verificar min0/max1, identidad, tópico, presupuesto exacto y log de aviso de octubre ignorado. Nunca probar una suspensión real usando un aviso falso elegible.
- Revisar transferencia/costo agregado antes/después; no descargar la base entera para medirla. Detalles de facturación y evidencia privada quedan fuera de Git.

Fuentes: [presupuestos y avisos](https://docs.cloud.google.com/billing/docs/how-to/budgets), [precio de Cloud Billing](https://cloud.google.com/billing/v1/pricing), [avisos programáticos y demoras](https://docs.cloud.google.com/billing/docs/how-to/budgets-programmatic-notifications), [deshabilitar RTDB](https://firebase.google.com/docs/reference/rest/database/database-management/rest/v1beta/projects.locations.instances/disable), [escala manual y tags](https://docs.cloud.google.com/run/docs/configuring/services/manual-scaling), [límites nativos](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps).
