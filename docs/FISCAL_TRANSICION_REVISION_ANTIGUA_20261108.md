# Retiro de emisores fiscales anteriores: evidencia y límite

Revisión estática sobre `10aecd47a71954ccffb455c956c011bc90e62325` y documentación
pública oficial consultada el 08/11/2026. No se consultó el proyecto remoto, no
se construyó/desplegó nada, no se emitió/canceló factura ni se modificaron jobs.
Este documento no autoriza ninguna acción de infraestructura.

## Qué garantiza el código retenido

`cloud-functions/emitir-factura/index.js:459-465` espera `begin` antes de enviar
al proveedor. `labor-bridge.cjs:95-100` espera la reserva durable con claim antes
de devolver `dispatch:true`. Por tanto, para ESTE código exacto y sólo esta vía:

- Una ejecución que termina antes de reservar el job no llegó al envío externo.
- Si pudo enviar, ya existe un job durable. Que quede `despachada` no demuestra
  rechazo: también puede significar autorización externa cuya respuesta se perdió.
- El preflight libera su lease antes de reservar; `complete` persiste resultado
  fuera de ese lease. Guard vacío no implica ausencia de handlers.
- `attachment` sí pasa por `guard.run`. La compatibilidad del fence de versión
  debe probarse también para un lease adquirido antes de cambiar configuración.
- La pausa por variable de entorno sólo alcanza revisiones que la incorporan;
  no modifica la memoria de revisiones antiguas ni requests que ya la cruzaron.

No extrapolar la primera propiedad a revisiones más antiguas sin verificar su
digest y código. Una revisión que emitiera antes de reservar exigiría evidencia
externa adicional: inventario de jobs por sí solo no cubriría esas operaciones.

## Señales de plataforma

Google indica que el estado `RETIRED` de una revisión no vigente corresponde al
retiro de su infraestructura. Es una señal positiva más útil que asignar cero
tráfico. No equivale a `Active:false`, cuyo contrato sólo expresa si puede recibir
tráfico. Tampoco usar `desiredReplicas:0`: sólo cuenta mínimos provisionados,
no todas las instancias creadas por autoscaling.

Fuentes: [Administrar revisiones](https://docs.cloud.google.com/run/docs/managing/revisions),
[API v1 de revisión](https://docs.cloud.google.com/run/docs/reference/rest/v1/namespaces.revisions).

El timeout HTTP devuelve 504 pero puede dejar al contenedor procesando. No usar
el tiempo máximo de respuesta como prueba de terminación.
[Timeout de solicitudes](https://docs.cloud.google.com/run/docs/configuring/request-timeout).

El contrato describe SIGTERM seguido por SIGKILL tras el período de cierre.
Eso no fija cuándo Cloud Run retirará una revisión al quitarle tráfico ni permite
inferir desde un log de SIGTERM que ya terminó todo el conjunto de instancias.
[Contrato de contenedores](https://docs.cloud.google.com/run/docs/container-contract#instance-shutdown).

DELETE de revisión es irreversible y la API v2 devuelve una operación asíncrona.
No propongo borrarla para probar el sistema: un 404 o una operación completada
no traen en esa referencia una garantía explícita de conciliación del proveedor.
[Eliminar revisión](https://docs.cloud.google.com/run/docs/reference/rest/v2/projects.locations.services.revisions/delete).

## Secuencia mínima a evaluar por el publicador

1. Inventariar revisiones fiscales concretas, UID/digest y código de reserva
   anterior al envío; identificar todas sus entradas, tags y rutas. No basta
   mirar la distribución del servicio principal de Cotizador.
2. Con la autorización correspondiente, dirigir nuevas admisiones a una revisión
   compatible pausada y retirar todas las entradas antiguas. Mantener consulta y
   recuperación disponibles. No tratar este cambio de ruta como prueba de drenaje.
3. Leer el estado real de CADA revisión antigua y acreditar `RETIRED` con identidad
   coincidente y sin nuevas entradas. No inventar un booleano `drained`, contador
   retroactivo, plazo fijo, ausencia de logs o ausencia de guard como sustituto.
   Si no aparece una señal equivalente verificable, el drenaje no queda probado.
4. Tras ese límite, inventariar completamente los jobs durables y clasificar los
   autorizados pendientes de vincular, rechazados y despachados inciertos. No
   expirar, borrar ni volver a enviar un despachado. Resolver con consulta al
   proveedor por identidad fiscal/autorización de lectura; conservar el resultado
   y vincular mediante el writer compatible y sus proyecciones.
5. Releer originales/coberturas bajo el fence del corte después de esas acciones;
   ninguna actualización tardía debe poder entrar por una revisión vieja. Sólo
   entonces continuar el corte coordinado. No afirmar que el proveedor externo
   canceló un trabajo porque su contenedor haya terminado.

Alternativa sin demostrar terminación: un fence monotónico de escrituras puede
probar que una revisión vieja no puede modificar originales aunque termine
después. Es una garantía DISTINTA del drenaje y requiere probar acquire y commit
con escritor viejo, lease previo al corte, resultado durable posterior y resume
compatible. No certificar equivalencia ni activarlo a partir de este documento.

## Matriz mínima ficticia

Antes de job / después de reserva y antes de fetch / después de envío y antes de
respuesta / resultado recibido antes de persistir / persistencia sin attachment /
attachment iniciado antes del cambio de fence. En cada corte: ningún nuevo envío
por recuperación, evidencia durable conservada y exactamente una vinculación
compatible. Las consultas tardías previas a preflight también deben quedar
bloqueadas por el fence al intentar adquirir; no sólo requests ya visibles como job.

La observación positiva de retiro y la conciliación de emisiones son dos pruebas
separadas. Este análisis define qué falta demostrar; no declara realizado el corte
ni resuelto el bloqueo de producción.
