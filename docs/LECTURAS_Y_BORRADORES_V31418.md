# Lecturas y borradores · candidata v3.14.18

La implementación está comprobada con datos ficticios. El estado de publicación
se registra en CONTEXTO_ACTUAL; este documento no acredita un despliegue.

## Agenda y Dashboard

Ambas pantallas comparten una fuente RTDB mientras exista un consumidor visible,
autorizado y vigente. El cambio síncrono de página/rango conserva esa fuente.
Cada consumidor mantiene su página, ruta y permiso; el transporte conserva UID,
objeto Auth, rol/revisión, ambas épocas, vista, perfil, SDK y primer plano.
Antes de decodificar se retiran consumidores inválidos. Un push se decodifica
una vez; la baja final se hace en microtask y no deja una escucha por reloj.

Dashboard conserva todos los eventos futuros para sus contadores y muestra los
ocho primeros según el renderer anterior. No se limita la raíz por fecha:
el contrato anterior acepta fechas antiguas no canónicas y una query por
`fecha` no es equivalente. El filtro de Agenda conserva su implementación.

Se retiró el GET independiente con TTL30s de Dashboard. Los renders por cambios
de otros datos no reabren la fuente lista ni fallida. Después de ocultar/salir,
también se bloquea la reapertura causada por esos renders: requiere Consultar,
Reintentar o una entrada explícita a la página. Carga/error/pausa mantienen KPI
desconocidos; sólo una respuesta confirmada permite mostrar cero. Un retiro
normal no se registra como fallo real.

## Histórico del dólar

El lector se inicia desde la solapa Dólar. El alcance inicial es el período del
gráfico; utiliza claves padre YYYY-MM-DD con `orderByKey/startAt/endAt`, sin
índice ni regla nueva. Cambiar un control del gráfico solicita ese período.
Todo el historial conserva formatos antiguos, orden, importes y paginación;
al navegar el gráfico en ese modo se reutiliza el resultado autorizado.

Inicio de sesión, Configuración general y regreso visible no consultan el
histórico. Los estados de carga/error/vacío se distinguen. Cambios de usuario,
Auth, permisos, épocas, vista, SDK, página, panel o alcance descartan respuestas
antes de `val()`. Los cuerpos de guardado manual y de cálculos del gráfico se
conservan. No se agrega polling ni productor de cotizaciones.

## Relevamientos

El listado comparte una fuente por contexto y se retira al ocultar/salir/cambiar
identidad, permisos o épocas. Volver visible no consulta por sí solo. Un error
mantiene reintento manual y un vacío sólo se muestra tras respuesta confirmada.

El borrador IndexedDB captura la clave del propietario antes de esperar. Abrir,
persistir, preparar fotos y guardar conservan contexto y generación. El ACK
tardío de A no borra el borrador ni actualiza la pantalla de B. Doble clic comparte
el envío; se preservan formato de almacenamiento, validación, campos y resumen.
Una persistencia local puede completar al salir si sigue siendo el mismo usuario.
Una escritura RTDB ya enviada no se presenta como abortada: se descarta su efecto
de interfaz si el contexto dejó de ser vigente.

Si RTDB confirmó pero falló borrar el borrador IndexedDB, se informa que ya está
guardado y se ofrece Completar guardado local. Si el contenido no cambió, ese
reintento sólo limpia el borrador y no repite la escritura remota, incluso sin
conexión. Editar el borrador requiere otra escritura explícita del mismo ID.
La confirmación local queda vinculada al contenido y propietario originales.

La primera descarga de la lista todavía incluye fotos y detalle; esta corrección
de ciclo de vida no equivale a una proyección compacta de historial.

## Bonificaciones: comparación de hijos ausentes

En el comparador del lote, el hijo que no existe en una de las dos versiones de
CTA se representa como `null`, igual que una hoja ausente de RTDB. Antes se pasaba
`undefined` al normalizador estricto, que rechazaba una entrada nueva legítima.
Se modifica sólo esa comparación. Un `undefined` real dentro de un payload sigue
siendo inválido. Se conservan CAS, leases, recibos, permisos, reglas y cálculos.
No se cambian bonificaciones, pagos, sueldos ni comisiones existentes.

Los16 casos nuevos cubren altas, bajas, matriz de permisos, replay, revocación,
metadatos protegidos y carrera de dos escritores (uno confirma y otro entra en
conflicto). Con las regresiones financieras focales suman182 aprobados; la suite
del servicio suma94 aprobados. Es cobertura ficticia, no una operación real.

## Límites del cierre

La optimización de las primeras descargas financieras exige proyecciones con
pertenencia, saldos acumulados, registros antiguos y escritores coordinados.
No se recorta un historial de pagos para acelerar una tabla. El inventario de
familias y el bloqueo externo de OT/garantías permanecen en
[CIERRE_PENDIENTES_2026-10-24.md](CIERRE_PENDIENTES_2026-10-24.md).
