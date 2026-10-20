# Circuito laboral acotado · candidato v3.13.19

Implementación y pruebas locales; **no aplicado a producción**. Complementa [PLAN_DOMINIO_LABORAL.md](PLAN_DOMINIO_LABORAL.md). No acredita auditoría completa ni un importe mensual fijo.

El cierre integrado sobre la web publicada v3.13.18, su evidencia y las condiciones operativas vigentes están en [CORTE_CIRCUITO_LABORAL_V31319.md](CORTE_CIRCUITO_LABORAL_V31319.md). Las fuentes y paquetes anteriores no sustituyen el SHA final revisado.

## Contrato

Solicitar/aprobar horas, solicitar gastos laborales y redistribuir comisiones usaban GET/PUT de toda `sisventas`. El adaptador nuevo ejecuta los mismos reducers sobre un conjunto acotado, conservando cálculos, validaciones, claves, estados, pagos e históricos. El PATCH contiene sólo registros modificados.

No se migra el negocio ni se cambia de base. Los índices privados contienen referencias. Una preparación única deriva las firmas originales de Gastos y Solicitudes, incluidos espacios/tipos antiguos y grupos ambiguos; no sustituirla por consultas incompletas `equalTo`.

## Commit y permisos

`sv_labor_guard` es una reserva pequeña con ID, digest, fence y vencimiento. No se renueva reteniendo lecturas. Un único PATCH confirma registros, índices, recibo y liberación; un fence vencido o ajeno rechaza todo. También se confirman las operaciones sin cambios.

OAuth usa `auth_variable_override` para que Firebase aplique las reglas. Un Admin SDK sin override puede saltarlas: nunca es fallback. El proxy cubre referencias/snapshots y rechaza callbacks posteriores al cierre.

El navegador usa `/laboral/escritura` con UID/claims verificados y sus permisos originales. Las escrituras antiguas quedan cerradas tras el corte. El servidor conserva la autorización de cada comando y verifica acceso, contraseña, rol y revisión al commit. Después de adquirir la reserva coteja además el hash completo de permisos capturado al autorizar. Los cambios normales de `sv_permisos` esperan a que termine el guardado para impedir borrar/recrear la misma revisión durante esa comprobación. No se alteran sus valores ni validaciones.

Los scripts Admin de mantenimiento eluden reglas: no pueden escribir estas ramas durante el corte u operaciones coordinadas.

## Flujos

- Pago de gasto, CTA, adjunto y lote se confirman juntos. Corrección/anulación incluye auditoría.
- Aprobación/rechazo y rehabilitación revalidan estado/pagos actuales y confirman Gasto/CTA juntos. Una aprobación vista antes de un rechazo no permite pagar después por un snapshot viejo.
- Incorporación explícita de movimientos históricos, entrega de adelanto y alta de movimiento periódico conservan destinos ocupados, pagos, centavos y base original; la regla periódica y sus registros se confirman juntos. La búsqueda amplia de comisiones legacy conserva temporalmente CAS sobre Gastos para no omitir duplicados antiguos.
- Una nueva operación conserva el total pagado antiguo sin historial como `saldoPagadoLegacy`; no inventa pagos, fechas ni comprobantes. UI y servidor calculan igual.
- Comisión manual conserva destinos ocupados/pagados aun sin control. Se comprueba el tope del grupo completo, incluidos porcentajes de CTA y pagos. Pagar/reducir un grupo histórico excedido no lo recalcula ni bloquea.
- Haberes trabaja por empleado/mes y cuenta, conservando sueldo/bonificación existentes.
- SAC mantiene temporalmente CAS sobre Gastos para no omitir duplicados antiguos; su PATCH sólo crea altas. Acotar esa lectura continúa pendiente.
- Recurrencias comparan base/regla y destino vigentes. Un destino ocupado conserva sus pagos; un mes nuevo no hereda `saldoPagadoLegacy` del anterior.
- Generación por llamada/evento prepara todas sus proyecciones bajo una reserva. El evento reserva duraderamente el intento antes de generar; si falla, descarta negocio y guarda sólo su error con el token correspondiente. Seis entregas simultáneas en dos coordinadores no superan cinco intentos. No hay un reloj de reintento nuevo. Observador periódico y circuito acotado no pueden arrancar juntos.
- Vinculación fiscal usa los mismos módulos revisados. Reserva un despacho privado antes de contactar al proveedor; conserva CAE/PDF y permite sólo vinculación explícita de una emisión conocida. Preflight compara la venta vigente mediante las funciones fiscales canónicas. NC/refacturación mantienen factura original e historial. Una emisión sin respuesta durable queda pendiente de revisión fiscal: nunca se reemite automáticamente. No se llamó a un proveedor fiscal real en estas pruebas.
- Mantenimiento compara las fuentes actuales y confirma cambios/auditoría juntos. No elimina grupos con pagos, base legacy, pagos anulados o auditoría; distingue centavos. Conserva solicitudes con aportes para mantener idempotencia. El script Admin anterior `migrar-adjuntos-gastos.ps1` rechaza Apply/Restore antes de autenticar; su vista previa permanece disponible. Una migración de adjuntos futura requiere el circuito coordinado.

## Respuesta perdida

Un intento incierto conserva su Promise y bloquea nuevos guardados financieros hasta una consulta explícita, sin polling. `sessionStorage` sólo guarda UID/ID/digest; payloads viven en memoria. `/laboral/operacion` confirma el recibo o cierra definitivamente el intento bajo la reserva: un POST tardío no puede registrar otro pago. Recibo ausente no significa rechazo. El aviso centra, bloquea fondo/scroll/foco y no continúa UI de otra sesión.

Los recibos de comandos/servidor guardan sólo un acuse pequeño; no duplican ventas, facturas o adjuntos retornados al usuario. La preparación inicial conserva únicamente conteos y hashes en su resultado. Esperar una consulta explícita de recuperación no mantiene el transporte Firebase activo en segundo plano.

## Corte obligatorio

Preparar pruebas, commit/push y paquetes no requiere activar el circuito. La **activación** espera una ventana de mantenimiento de escrituras financieras autorizada y la evidencia de cierre siguiente; no sustituirla por esperar cinco minutos.

1. Cerrar el inventario de escritores y aprobar suite, backend, reglas completas/emulador y UI aislada. Revisar SHA completo y checkout público limpio. Preparar la función con `scripts/stage-guarded-invoice-function.cjs`: primero plan; `--apply` sólo crea el paquete local privado, con manifiestos y hashes. No instala ni despliega.
2. Antes de aplicar, leer/respaldar las reglas remotas vigentes y generar la candidata desde ese JSON/hash explícito. Registrar servicios, revisiones, tráfico, tags, instancias mínimas y escritores externos al repositorio. No ejecutar scripts Admin de mantenimiento durante la ventana.
3. Confirmar que no hay pagos, comisiones o emisiones fiscales en curso. Conservar el resultado y el acuse terminal de cualquier operación anterior; una respuesta perdida o un 504 no acredita que no se guardó. Una emisión incierta se verifica, nunca se vuelve a emitir para probar.
4. Preparar revisiones nuevas de `cotizador` (`LABOR_SCOPED_ENABLED=true`) y del servicio de `emitirFactura`, con guard habilitado, sin fallback Admin y `LABOR_SCOPED_READ_ONLY=true`. Verificar que son las últimas y redirigir el 100% del tráfico y **todos** los tags antiguos al código protegido, o retirar los tags que ya no deban existir. Conservar los endpoints necesarios. El handler `testTFApp` sólo consulta estado fiscal y no necesita cambiar para este corte. La migración de tráfico conserva solicitudes en curso; no es un drenaje. [Gestión de tráfico](https://cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration), [funciones gen2 y Cloud Run](https://docs.cloud.google.com/functions/docs/managing).
5. Aplicar las reglas candidatas únicamente dentro del corte autorizado para cerrar también clientes anteriores. Retirar las revisiones Admin antiguas de ambos servicios: ya no pueden tener tráfico ni tags, ni ser la última/única revisión. Esperar cada operación de eliminación terminada sin error y registrar el cierre de sus instancias, además de los acuses terminales pendientes. El borrado es irreversible; conservar fuente/configuración e imagen revisadas para diagnóstico, sin reactivar código anterior. [Eliminar revisiones](https://docs.cloud.google.com/run/docs/managing/revisions), [operación de borrado](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.services.revisions/delete).
6. **Puerta de drenaje:** no queda ninguna revisión anterior invocable, instancia anterior activa/ociosa ni operación Admin financiera sin resolver. El timeout HTTP no detiene el contenedor. Escalar a cero permite terminar solicitudes y no alcanza tags aislados. El apagado del contenedor tiene SIGTERM y después SIGKILL; tampoco revierte una escritura ya recibida por RTDB. Las métricas pueden respaldar el cierre, pero tienen demora: una serie ausente no vale como cero. Si falta evidencia de terminación/acuse, mantener el modo de revisión y detener el bootstrap. [Timeout](https://docs.cloud.google.com/run/docs/configuring/request-timeout), [deshabilitar servicio](https://docs.cloud.google.com/run/docs/managing/services), [apagado](https://docs.cloud.google.com/run/docs/container-contract#shutdown), [escrituras RTDB](https://firebase.google.com/docs/reference/rest/database/#section-query-parameters), [demora de métricas](https://docs.cloud.google.com/monitoring/api/metrics_gcp_p_z).
7. Sólo con drenaje acreditado, ejecutar explícitamente `scripts/bootstrap-labor-scoped.cjs --apply --expected-rules-hash SHA256`. Crea índices/configuración/recibo, sin copiar ni sustituir negocio. Rechaza una preparación previa o índice mayor a 8 MiB. Si no cabe en 60 s, detener y preparar un procedimiento sobre estado congelado, sin relajar exclusión ni descargar la raíz. Comprobar cobertura/hashes y datos de negocio intactos antes de retirar el modo de revisión de las revisiones protegidas.
8. Publicar Hosting desde SHA limpio mediante `deploy-secure-hosting.cjs`, contrastar activos y sólo entonces actualizar `sisventas/config/version`. Conservar contexto/borradores. Verificar sesión, lecturas y sincronización sin guardar operaciones ficticias en producción; esto no equivale a probar operaciones financieras reales.

La transacción raíz anterior tiene cinco intentos con GET/PUT de 90 s y puede seguir tras el timeout del servicio (`cotizador/labor-transaction.js`). Como defensa adicional se evaluó un marcador `sisventas/config/laborCutFence` para cambiar el ETag antes del bootstrap: invalidaría PUT condicionados con un ETag anterior después de retirar sus procesos. **Es una propuesta sin helper ni pruebas; no es un paso implementado ni automático.** No protege un PATCH/UPDATE Admin incondicional ya aceptado. Firebase documenta que esas escrituras no pueden cancelarse al llegar al servidor; ni borrar revisiones ni un marcador demuestra por sí solo su finalización. No ampliar IAM ni deshabilitar toda la base como atajo de este procedimiento.

Medición única de las dos ramas para dimensionar el corte: 6,853 MB, 227 gastos y 8 solicitudes; índice de 51.122 bytes y 363 referencias. Estimación antes de franquicias: aproximadamente USD 0,007 de descarga para el bootstrap y USD 0,00026/mes por ese índice. No incluye construcción, cómputo, logs, recibos futuros ni otras transferencias; no es una factura ni exige leer los 96 MB de la raíz.

Tras el corte **no** usar `LABOR_SCOPED_ENABLED=false` ni volver a Admin/PUT raíz. Contención segura: conservar reglas/proxy y `LABOR_SCOPED_READ_ONLY=true`, que permite lecturas/comprobación de intentos y bloquea guardados nuevos. Corregir hacia adelante; no restaurar respaldos sobre operaciones nuevas.

## Costo y cobertura

Sin servicios/bases/instancias mínimas adicionales; cobro por solicitud. Preparación: lectura única de dos ramas y referencias pequeñas. Informar tamaño/costo estimado antes de aplicarla; cómputo, construcción y transferencia son variables.

[Firebase Pricing](https://firebase.google.com/pricing), consultado20/10/2026: RTDB USD1/GB descargado y USD5/GB almacenado después de franquicias. Ejemplos:100MB≈USD0,10 transferidos y8MB≈USD0,04/mes almacenados; no son tamaños medidos, impuestos ni una factura mensual. Recibos también ocupan almacenamiento: su retención/limpieza debe ser explícita, sin barrido por reloj.

La integridad del índice requiere preparación completa y cierre de escritores. Se detectan referencias falsas/buckets malformados y miembros anteriores conocidos ausentes; una comisión completamente omitida no se descubre sin leer la fuente. No afirmar esa cobertura sin comprobar la preparación.
