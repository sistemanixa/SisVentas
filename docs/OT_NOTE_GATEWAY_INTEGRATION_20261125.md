# Notas OT: montaje nativo local

Base revisada: `62bf0ee4`. Este bloque no cambia index, aplicación, Guard, Store,
Docker, Rules ni activación. Sólo monta el puente de notas ya entregado en
`f123dd3016ba606b4002293da5309aeed3cd27a7`.

## Constructor y admisión

`createLaborWriteGateway({auth, db, guard, store, enabled, inventoryCohort=null})`
recibe la instancia genuina de `inventory-cohort-runtime` desde el servidor.
Ausencia del argumento conserva el comportamiento anterior. Una instancia
malformada falla; no se interpreta como OFF. Una cohorte proporcionada se consulta
dentro del lease y nuevamente antes del commit. Instalación presente exige
`assertAdmission` en ambas fases; cambios de instalación abortan.

Con instalación presente, cualquier escritura genérica OT debe pasar el contrato
estricto de una nota. Otros cambios OT fallan sin SDK alternativo. La composición
de materiales corresponde a Root en otro bloque; no se implementa aquí.

## Wire, recibo y respuesta

Se conserva `atomic`, `path:''`, un único leaf de nota y exactamente los hashes
de OT/id y de la nota original. El input y su digest no cambian. El actor privado
se transforma por el puente nativo antes de `scope.update`. La comparación se
realiza contra la OT autorizada completa, sin repetir lecturas CAS de sus hojas.

El recibo incluye `{ok:true, committed:true, operationId, noteCanonical:true}`;
no contiene texto, fotos ni una copia de la nota. Después del commit, incluso
en replay, Gateway hace `store.readAsUser(notePath, actor)` y agrega `note` a la
respuesta. Un fallo de esa lectura se informa como confirmación incierta 503,
porque la escritura puede estar confirmada. No se vuelve a preparar ni auditar.

`SVLaborWrites.writeOTNote` conserva sus tres campos de resultado anteriores
en OFF. Con respuesta canónica o recuperación devuelve además
`{noteCanonical:true, note}` y actualiza el objeto `after` para callers actuales.
Normalmente no lee mediante SDK. Si Recovery confirma sin payload, hace sólo un
GET del leaf de la nota, comprobando que la sesión siga vigente antes y después.
No reenvía POST. Una nota desaparecida/recreada de forma incompatible exige
recargar la OT, sin aplicar estado local obsoleto.

## Excepción cliente para materiales

`atomic` admite el purpose literal `ot-materials`. Sólo para ese purpose permite
crear el leaf exacto `sisventas/notificaciones_admin/<safeKey>` sin una lectura
baseline de la notificación. No permite descendientes, claves reservadas ni
otros registros sin baseline. Esto no concede autoridad de OT ni implementa el
servidor de materiales: ese montaje y su policy genuina siguen siendo de Root.

## Evidencia y límites

Regresión inicial: 124 PASS, cero fallos (notas estrechas, puente nativo,
labor-writes y Metadata). La fixture propia de recuperación ahora exige un único
GET del leaf; antes prohibía toda lectura SDK. Se conservan sus aserciones de un
POST, un commit, un audit y digest wire idéntico.

Regresión adyacente: 45 PASS (Gateway, Recovery, normalización y retorno a
presupuesto). Cuatro pruebas Chrome headless de presentación Recovery no
arrancaron en la primera invocación por falta de NODE_PATH; al usar las
dependencias instaladas pasaron las cuatro. HTTP sólo loopback y fetch externo
interceptado con datos ficticios. No se cambió ningún test de esos grupos.

Corrida conjunta posterior: 194 PASS, cero fallos. Incluye los 124 anteriores,
los 45 adyacentes y 25 casos nuevos de Gateway/Guard/Store REST con admisión real
de `inventory-cohort-runtime`, firmas y pins de un paquete ficticio. Incluye
rechazo por autor/UID/rol extraños, CAS, revocaciones, edición legacy intacta,
OFF y ausencia inválida, replay sin preparar otra vez, y postread denegado con
recibo persistente. Un replay lee la versión actual autorizada, incluso si fue
corregida después del primer commit. Esos 194 se superponen a las corridas
anteriores; no se suman como pruebas distintas.

Corrida final conjunta: 235 PASS, cero fallos, cancelaciones ni omisiones.
Incluye los 194 anteriores y 41 pruebas nuevas de cliente/canónica/Recovery y
la excepción de notificaciones. Registro local no versionado:
`C:/SisVentas/tmp/ot-note-gateway-complete-20261125.log`.

Cliente acredita cero GET normal, un GET exacto al recuperar, sesión cambiada
sin proyectar la nota, canónica ausente/incompatible sin éxito aparente, y
notificaciones sin extender la excepción a otros paths/purposes.

La prueba de cambio de sesión después del POST respeta el contrato existente
de Recovery: primero retiene la confirmación incierta y después consulta el
recibo; no se cambia ese protocolo para forzar un rechazo inmediato.

Las cuatro pruebas de Chrome se validaron por separado y no forman parte de
esas 235. Syntax y diff-check PASS. Datos ficticios y Store REST interceptado;
no acredita Rules remotas, emulador, publicación ni instalación de la cohorte.
