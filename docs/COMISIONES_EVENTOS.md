# Comisiones por eventos · preparación local

Estado: candidato20, **sin activar**. Producción19 conserva su observador. No se probaron cobros ni comisiones reales; las pruebas financieras usan memoria/emulador.

## Disparo y alcance

Tres funciones de primera generación, us-central1, escucharán exclusivamente campos pequeños:

| Función propuesta | Referencia |
|---|---|
| sisventasCommissionPayment | sisventas/pagos/{payment}/monto |
| sisventasCommissionPaid | sisventas/ventas/{sale}/estadoPago |
| sisventasCommissionEnabled | sisventas/ventas/{sale}/comisionHabilitada |

No escuchar la raíz ni cada producto. Tampoco enviar la venta completa como evento: las imágenes/adjuntos pueden exceder límites de entrega. La ruta directa RTDB→Cloud Run y los disparadores RTDB de segunda generación están marcados Preview en la documentación vigente; se prepara el disparador de primera generación documentado, conservando el cálculo en Cotizador. Ver [RTDB primera generación](https://firebase.google.com/docs/functions/1st-gen/database-events-1st), [contexto](https://firebase.google.com/docs/reference/functions/firebase-functions.eventcontext) y [límites de reintento](https://firebase.google.com/docs/functions/retries).

Fuente: cloud-functions/commission-events. Node22, min0/max1 por función, memoria prevista256MB y timeout60s. Reintento nativo habilitado para la entrega concreta, con corte propio a24h y registro de revisión; nunca un barrido de datos. No se adquieren instancias permanentes. El receptor acota a5 intentos de procesamiento por evento y conserva la reserva vencible y su token, de modo que una ejecución vieja no pueda confirmar otra reserva.

Las funciones sólo reciben la referencia del cambio y entregan metadatos a /internal/commission-event. No leen la base, no llevan secretos de SisVentas y no envían el contenido original del evento. Identidad exclusiva propuesta: sisventas-commission-events, sin roles de proyecto ni claves descargadas. Cotizador verifica criptográficamente el token de Google, audiencia canónica y correo exacto; después instancia, tipo y referencia. No admite un token de usuario ni importes del cuerpo como autoridad. La URL de entrega candidata puede usar un tag del mismo servicio, conservando audiencia canónica.

El cálculo existente vuelve a consultar la venta y los pagos canónicos; aplica corte histórico, costos originales, permisos de configuración, participantes, límite y operaciones create-only. Con IDs canónicos sólo lee las fichas participantes; el caso legado por nombre conserva su control de ambigüedad. Pagos antiguos sin ventaFbKey quedan en revisión, sin recorrer toda Ventas. No se borran/recalculan comisiones anteriores.

sv_commission_events contiene sólo controles internos del receptor; acceso cliente negado por la raíz efectiva y verificado en emulador, también para otro administrador. La validación no se salta para poder guardar. Una revisión requiere conciliación; no transformar un faltante de costos en porcentaje0 ni inventar importes actuales.

## Comprobación antes del corte

1. Fuente revisada/commit limpio, suite vigente y pruebas específicas.
2. Nueva revisión de Cotizador sin tráfico, con receptor habilitado y observador desactivado sólo en esa revisión; producción conserva observador, mínimos y accesos.
3. Prueba nativa separada mediante un registro ficticio nuevo en sv_commission_probe/{nonce}, sin datos de clientes/ventas/pagos. Ruta de prueba exacta, autenticada y habilitada sólo con su referencia configurada; no consulta ni escribe datos comerciales. Función/probeta temporales propias se retiran al verificar la entrega. No usar una venta falsa en la lista real.
4. Verificar los tres disparadores específicos y sus identidades/configuración. Sólo entonces mover el100% y todos los tags existentes al servidor nuevo y configurar mínimo0/facturación por solicitud. Conservar recursos, secretos y la reversión19. No afirmar que un trigger creado ya entregó correctamente un evento.
5. Verificar consultas de Ventas/Presupuestos, no acciones financieras; observar que el observador antiguo ya no mantenga instancias ni lecturas al quedar sin tráfico. Una caída antes del corte deja19 operativo.

La función de corte60 ya autorizada deshabilita la base y los cuatro servicios comerciales; los reenviadores no pueden acceder a datos ni operar si Cotizador está detenido. Puede haber entregas pendientes/reintentos durante hasta24h y cargos de conservación: el presupuesto no es un límite exacto de dinero. La suspensión mantiene sus límites ya documentados y requiere conciliación antes de reactivar; no reproducirla con un aviso falso elegible.

## Costo comprobado y estimación

Catálogo oficial consultado el18/10/2026. Cloud Billing Catalog API es gratuita; se habilitó únicamente esa API para consultar precios. No se habilitó Cloud Scheduler: está deshabilitada y las funciones inventariadas no incluyen recordatorios de agenda desplegados. Esto no sustituye inventariar otras regiones si aparece evidencia de recursos ajenos.

Cotizador actual:1CPU,2GiB, concurrencia1, máximo12, mínimo de servicio1 y cpu-throttling=false. En São Paulo, SKUs9635-6C4B-AC6F y09CF-8129-FE15: USD0,0000216/CPU-s y0,0000024/GiB-s. Una instancia24h durante30 días equivale a **USD68,4288 brutos**, antes del descuento gratuito compartido. No es el valor que ya se facturó ni incluye RTDB.

Objetivo: mínimo0 y cómputo por solicitud. SKUs085C-A237-027A y600C-3782-6708:0,0000336/CPU-s y0,0000035/GiB-s. Como escenario,3.000 entregas de10s con1CPU/2GiB equivalen a USD1,218 de ese cómputo, más solicitudes/transferencia y antes del tramo gratuito. Los reenviadores pequeños tienen reserva estimada **USD0–2/mes** en ese escenario, incluyendo margen para arranque y conservación. Su precio depende de entregas/duración; no es costo de toda la empresa ni garantía de un total mensual menor30.

El catálogo confirma CPU de primera generación C024-9C10-2A5B y memoria F01C-3EA0-06CD; sin instancia mínima no se adquiere un encendido continuo. Los despliegues generan builds/imágenes facturables según sus tramos. Registros y cálculos privados de referencia permanecen en tmp; no se guarda ninguna credencial en Git. [Precios Cloud Run](https://cloud.google.com/run/pricing), [catálogo](https://docs.cloud.google.com/billing/v1/how-tos/catalog-api), [API gratuita](https://cloud.google.com/billing/v1/pricing).

## Evidencia local

- Pruebas de receptor: identidad/audiencia/firma, eventos duplicados/concurrentes, reserva vencida, corte de5 intentos, referencias ajenas, pagos canónicos, faltantes y generación incompleta sin sobrescritura.
- Ruta HTTP real de Cotizador con SDK falso: una comisión ficticia de6 y repetición sin cambios; anónimo/token incorrecto no escriben.
- Verificador oficial Google con claves RSA efímeras:3 casos aceptan/rechazan firmas y claims, sin credenciales/red externa.
- Framework real de primera generación por loopback: procesa un contexto vencido sin obtener credenciales ni consultar servidores.
- RTDB emulado:20 casos comerciales/generación/eventos/permisos aprobados. La primera pasada detectó una transacción abortada antes de recibir estado del SDK; se reutilizó el helper transaccional existente y se repitió con éxito. No ocultar este límite usando sólo memoria.
- Suite propia Cotizador94 aprobadas; npm audit sin vulnerabilidades conocidas tras actualizar busboy3.2.3/grpc-js1.14.6 dentro de sus rangos compatibles. La librería oficial de identidad se fija11.3.1.

Falta comprobar la entrega nativa y aplicar el corte. No está publicada ni activada esta arquitectura por registrar este documento.
