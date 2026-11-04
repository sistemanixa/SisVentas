# Asistente: procedencia y límites del inventario de corte

## Validación de lectores sin reabrir mutaciones · excepción local posterior a1c12e793

Se resuelve la dependencia circular de aceptación previa a reapertura mediante
una allowlist exacta en commercial-admission.allowsPausedRead: POST
/laboral/capacidades, /clientes/historial y /clientes/historial/cliente pasan a sus
handlers existentes con la admisión pausada. No se agregan endpoints, nuevos
permisos ni handlers alternativos. Paths con slash final o sufijos no se admiten.
POST /cuentas/preparar **sigue cerrado**: su bootstrap puede crear un ámbito y no
se usa como comprobación de lectura. Las demás mutaciones y eventos siguen503.
Este bloque sustituye la afirmación previa de que todos los POST H7/capacidades
quedan503 durante la pausa.

Revisión de ruta: capacidades autoriza con el gateway existente, exige body
vacío y sólo lee getters capability/capabilities; no invoca execute/create.
Historial usa client-history-http-adapter y Query.page o Client.resolve,
Access.authorize/readOriginal/readClient y fuentes de lectura/query. Conserva
FreshAuth, permisos, prohibición Ver como, validación de body/query,
configuración, identidad y cobertura originales. No entra al guard ni instala
índices/ámbitos. El encabezado de capacidades describe las capacidades de la
revisión, no acredita que la admisión mutante esté abierta; un POST mutante
continúa503 aunque los getters indiquen enabled=true.

Orden futuro de aceptación: mantener pausadas todas las entradas comerciales y
la admisión fiscal, drenar/conciliar y obtener snapshot estable; conservar el
fence SDK independiente sdkAdmissionPaused=true. Instalar/verificar el conjunto
emparejado de índices/reglas/configuración bajo la exclusión autorizada. Cuando
ese conjunto tenga ready/cobertura válidos, comprobar los tres POST de lectura
anteriores sin quitar SV_COMMERCIAL_ADMISSION_PAUSED ni el fence SDK. Ready=true
es condición de lectura H7/Accounts, no prueba de exclusión: no usar ready=false
como único bloqueo en esa fase. Comprobar Accounts mediante lectores GET
existentes con reglas y snapshot; nunca invocar /cuentas/preparar para validarlo.
Mantener asimismo cerrados escritores privilegiados ajenos al SDK. Ante cualquier
fallo, conservar pausas; la reapertura requiere evidencias finales y autorización
del corte, no se deduce de estas lecturas ni del paso de pruebas ficticias.

Prueba nueva commercial-admission-readonly.test.cjs ejecuta bootstrap/router
completos con servicios/adaptadores reales, Auth y fuentes ficticias mínimas;
sólo sustituye transporte/DB y el acceso al backend por RAM. Usa el constructor
real de runtime con flags explícitos en la fixture porque sus módulos Node
importados no heredan el process.env del VM. Los índices se preparan en RAM
antes de las solicitudes; cada llamada compara estado antes/después y exige
0commits/0guard. Red/proveedor/credenciales/listener están bloqueados. Comprueba
positivos de capacidades/H7/cliente y negativos de Auth revocada, contraseña
pendiente/reset, rol inactivo, Ver como, body inyectado, configuración/permiso/
cobertura inválidos y rutas hermanas mutantes cerradas.

71/71focales PASS, incluidos los39anteriores y adapters/access H7 existentes;
sintaxis JS y diff correctos. Un primer fixture omitía pasar flags explícitos
al constructor Node y apuntaba al padre de cobertura en vez del dominio ventas;
se corrigieron ambas entradas ficticias, sin relajar validaciones productivas.
Cambian index.js, commercial-admission.js, prueba propia paused (la ruta H7 deja
de contarse como bloqueada), prueba nueva readonly y este documento. Sin cambio
de otros adaptadores, backend compartido, despliegue ni índices/registros reales.
Requiere nueva puerta integral desde SHA limpio, separada de la puerta15.

## Pausa de admisión Cotizador preparada localmente · 04/11/2026

`SV_COMMERCIAL_ADMISSION_PAUSED` se captura al iniciar cada proceso/revisión.
Ausente o cadena exacta false conserva la admisión anterior; true, vacío y
cualquier otro valor cierran la admisión por defecto seguro. No acepta override
del body. No se aplicó esta configuración a ningún servicio remoto.

El router real de cotizador/index.js resuelve primero OPTIONS con CORS y luego
el dominio privado /privado/finanzas con su autorización existente intacta.
Después, la pausa rechaza los POST comerciales antes de leer body o ejecutar
handlers:503, Retry-After:5, retryable=true y SV_COMMERCIAL_ADMISSION_PAUSED.
Incluye entrada común aunque un handler no pase por LaborGuard; no se modifica
Guard, store, permisos, reglas ni índices. Los eventos /internal/commission-event
y -probe reciben503, nunca ACK exitoso, para que el emisor conserve su reintento.
Otros POST que sólo consultan, como Historial, también quedan503 durante esta
ventana conservadora. Los GET siguen su circuito actual; no se atribuye al flag
un cierre universal de efectos que no entren por POST o por este proceso.

Excepción exacta POST /laboral/operacion: durante pausa usa
commercial-admission.resolveReadOnly, con authorize real del gateway (sesión,
rol activo, circuito habilitado y veto Ver como). Lee únicamente el recibo
solicitado y comprueba actorUid/digest. Si existe, devuelve confirmed/rejected
sólo según resultado explícito; ausente o sin resultado reconocible devuelve
pending. No invoca gateway.resolve ni guard.run: el resolve normal puede crear
un recibo de cancelación y no es una consulta pura. Esta excepción no cancela
intentos, adquiere leases ni crea recibos; no declarar rechazo a partir de una
ausencia que podría preceder a un POST aceptado aún en vuelo. Sin pausa, el
resolve previo conserva su comportamiento.

Paso concreto futuro de corte: preparar esta versión compatible en todas las
revisiones/rutas comerciales pertinentes; aplicar admisión pausada sólo bajo
el corte autorizado y comprobar rechazos. Conservar ready=true mientras se
drenan solicitudes previamente aceptadas y se concilian/vinculan jobs fiscales
por el circuito autorizado del frente fiscal. **Este flag no cancela peticiones
ya aceptadas ni prueba drenaje.** Obtener evidencia final estable y luego
freeze SDK/ready=false según el plan coordinado. Las revisiones/tags que no
ejecuten el flag y escritores privilegiados ajenos requieren cierre propio;
este cambio local no los modifica. El dominio privado sigue independiente.

Verificación focal:8pruebas nuevas del callback HTTP real con fakes y Auth/gateway
reales más22regresiones de router/guard/eventos,30/30PASS. Incluyen default,
flags inválidos, POST genéricos de roles/usuarios/clientes/finanzas/eventos sin
body/handler/efectos, permisos privados, OPTIONS/GET y recuperación sin commits.
Las rutas hipotéticas/desconocidas también se bloquean por entrada común; esa
comprobación no certifica implementaciones de handlers inexistentes en index.
Dos casos inicialmente no cargaron por resolución local de Playwright; repetidos
con NODE_PATH=C:/SisVentas/cotizador/node_modules ya instalado aprobaron, sin
instalar dependencias. node --check de index/helper/test y diff correctos.
Pendiente puerta integral coordinada sobre paquete final; no se ejecuta otra
suite completa en paralelo ni se anuncia corte remoto desde estos resultados.

Corrección de revisión: se retiró el fallback typeof del router; la constante
commercialAdmissionPaused es dependencia obligatoria inicializada por el módulo.
Las fixtures vigentes que extraen sólo el callback ahora declaran explícitamente
commercialAdmissionPaused=false: client-history-index-route.test.cjs,
ot-delete-index-route.test.cjs, purchase-delete-index-route.test.cjs y
sale-delete-index-route.test.cjs. Sólo cambió ese binding; sus aserciones de
seguridad y comportamiento permanecen intactas. No se modificaron instantáneas
históricas excluidas. Dockerfile incorpora COPY commercial-admission.js.

El lookup además rechaza actor.viewing, actor._viewAs o actor.realUid distinto
de uid cuando el autorizador expone esos indicadores, antes de leer el recibo.
No acepta actor/uid/contexto aportado por body: sólo id/digest. El gateway actual
retorna uid/claims y veta query verComo; no se afirma que exponga todos los estados
de presentación del frontend. Esos estados no conceden identidad ni permisos;
el helper no construye un actor a partir de ellos. FreshAuth/revocación y rol
activo siguen dependiendo del autorizador existente. No se amplían permisos ni
se devuelve result, claves del recibo, importes o payload: sólo ok/status.

Validación posterior:39/39PASS, incluyendo12propias, bootstrap del módulo real
con flags ausente/false/true/inválido, Auth revocada sin lecturas privadas,
contextos viewing/_viewAs/realUid ajeno con0lecturas, cuerpo sin actor y resultado
mínimo con0commits. El bootstrap no abre listener, red ni credenciales; utiliza
fakes locales con dependencias ya instaladas. Sintaxis y diff correctos. Esta
corrección agrega como archivos de alcance Dockerfile y las cuatro fixtures
citadas, además de index/helper/test/doc propios; no cambia backend compartido
Guard/store/reglas ni inicia un despliegue.

## Inventario Functions ambas generaciones · 04/11/2026

`gcloud functions list --project=nixa-sisventas` con proyección de campos
sanitizados devuelve ocho funciones activas:cinco Gen2 y tres Gen1. Gen1 no trae
environment en esa respuesta; entryPoint/eventTrigger/status y describe sin
--gen2 las identifican. No se habilitaron APIs. Regiones extraídas de sus nombres
de recurso, no deducidas por cercanía a Cotizador.

| Función / entrada | Generación y región | Revisión o versión | Disparador | Clasificación de fuente exacta |
|---|---|---|---|---|
| emitirFactura | Gen2, southamerica-east1 | emitirfactura-00033-vib | HTTP | Escritor fiscal de ventas, jobs fiscales, auditoría y coordinación; proyecciones comerciales condicionales |
| testTFApp | Gen2, southamerica-east1 | testtfapp-00009-rux | HTTP | Consulta autenticada de estado del proveedor; sin escritura comercial propia |
| correoSolicitudConfirmada | Gen2, us-central1 | correosolicitudconfirmada-00005-yoh | RTDB created, sv_catalogo_solicitudes_atencion/{id} | Lee solicitud/evento, envía SMTP y escribe estado técnico de correo |
| correoSolicitudDeclinada | Gen2, us-central1 | correosolicituddeclinada-00004-los | RTDB created, sv_catalogo_solicitudes_declinacion/{id} | Mismo código de correo; no modifica originales comerciales |
| sisventasCostGuard | Gen2, us-central1 | sisventascostguard-00002-gaw | Pub/Sub, sisventas-cost-guard-60 | Sin escritura de registros comerciales; puede deshabilitar RTDB y modificar tráfico/escalado Cloud Run |
| sisventasCommissionPayment / sisventasCommissionEventForward | Gen1, us-central1 | versionId1 | RTDB ref.write, sisventas/pagos/{payment}/monto | Forwarder autenticado del circuito escritor de comisiones; no excluir por no escribir RTDB directamente |
| sisventasCommissionEnabled / sisventasCommissionEventForward | Gen1, us-central1 | versionId1 | RTDB ref.write, sisventas/ventas/{sale}/comisionHabilitada | Mismo forwarder |
| sisventasCommissionPaid / sisventasCommissionEventForward | Gen1, us-central1 | versionId1 | RTDB ref.write, sisventas/ventas/{sale}/estadoPago | Mismo forwarder |

Los disparadores RTDB apuntan a nixa-sisventas-default-rtdb; los Gen1 tienen
failurePolicy.retry. No aparecen configuracionPush, registrarDispositivoPush,
desregistrarDispositivoPush, despacharEventoNotificacion, notificarOtAsignada,
notificarReclamoAsignado, notificarPresupuestoPendiente ni recordatoriosAgendaPush
en este listado. Su presencia como exports condicionales del ZIP de40KB no
demuestra despliegue. No se encontró otra función desplegada con esos handlers.
Esto delimita Cloud Functions del proyecto en esta observación, no Scheduler,
servicios externos, extensiones u otras herramientas fuera de ese inventario.

### Gen1: procedencia y entrega exactas

Los describe de las tres funciones confirman entrada sisventasCommissionEventForward,
versión1 y builds us-central1:

- Payment:4ecdf19a-6135-4444-94ca-57220cb3816b (SUCCESS consultado).
- Enabled:0ef6a88d-bafa-4ee9-a7eb-c61d7ba6cf47.
- Paid:a339e83f-84ec-409c-bb40-2ed53a231392.

El build Payment no proporcionó source/sourceProvenance útil. Se obtuvo cada
fuente mediante generateDownloadUrl con versionId1 explícita; no se registraron
URLs firmadas ni tokens. La descarga se limitó a Content-Length positivo≤20MiB.
Los tres ZIP tienen19.258bytes y SHA256 idéntico:
`5e01b056b276746540d28917e276a1be3b8590cd8ea13b9fbad3e13980d9d46f`.
Objetos exactos devueltos por esa API bajo storage.googleapis.com:

- /gcf-sources-171899432710-us-central1/sisventasCommissionPayment-076d12c6-3edf-47c7-9014-6bf144428cf6/version-1/function-source.zip
- /gcf-sources-171899432710-us-central1/sisventasCommissionEnabled-f67f0575-fca8-4b50-ad52-5574ac07020d/version-1/function-source.zip
- /gcf-sources-171899432710-us-central1/sisventasCommissionPaid-76ca8f8a-3c7f-4f14-85e0-c34b00c03d86/version-1/function-source.zip

Copias privadas C:/SisVentas/tmp/sisventasCommission{Payment,Enabled,Paid}-v1-source.private.zip.
Contienen index.js y forwarder.js más metadatos de paquete. No usan Admin/DB:
GoogleAuth obtiene identidad de servicio y forwarder.js:19 hace POST autenticado
a deliveryURL+/internal/commission-event; sólo probe usa sufijo -probe. Valida
tipo/recurso de evento y rutas de pagos/ventas antes de reenviar; no transporta
los valores comerciales y eventos mayores a24horas quedan para conciliación.

Se consultaron exclusivamente las tres opciones no secretas de destino en cada
función: COMMISSION_EVENT_INSTANCE=nixa-sisventas-default-rtdb y TARGET/DELIVERY_URL
ambos https://cotizador-is54pr4fha-rj.a.run.app, sin etiqueta antigua. No se
leyeron otras variables ni secretos. La fuente limita destinos a ese host o
URLs etiquetadas de él. **Son accesos indirectos al escritor de comisiones**:
incluir triggers, reintentos/eventos pendientes y endpoint receptor en inventario,
pausa y drenaje; bloquear sólo los clientes SDK no cierra esta vía. No se invocó
el receptor ni se verificaron resultados de eventos reales. La escritura final
de originales/proyecciones corresponde al receptor Cotizador y requiere su
propia procedencia y análisis; este paquete no prueba qué versión atiende una
entrega futura ni todos los efectos de su handler.

### emitirFactura: fuente remota distinta y escritor vigente

Cloud Functions confirma entrada emitirFactura, revisión emitirfactura-00033-vib,
build e2ad684d-01ba-40f4-a638-cefce187d2ba (SUCCESS). La anotación de revisión
vincula ese build y esta fuente exacta, coincidente con buildConfig.source:
`gs://gcf-v2-sources-171899432710-southamerica-east1/emitirFactura/function-source.zip#1793679139918303`.
Imagen:
`southamerica-east1-docker.pkg.dev/nixa-sisventas/gcf-artifacts/nixa--sisventas__southamerica--east1__emitir_factura@sha256:6d699fcc37623c1395c0d07af22c393ec36812867fcdf9789a1d911e955a449d`.
El build no devolvió procedencia Git útil. ZIP153.373bytes, generación
1793679139918303, privado en C:/SisVentas/tmp/emitirfactura-00033-vib-source.private.zip;
SHA256 `c1d5f1298309e9566aecc1c9f67bd6e91c5da487e30cd612dd7b59901f519b7e`.

Se examinó esta fuente y sus dependencias vendorizadas, sin asumir equivalencia
con el paquete local preparado. index.js llama fiscalBridge.begin/rejected/complete
y resume; labor-bridge.cjs:34–62 adjunta mediante guard datos a sisventas/ventas:
emisionesFiscales, factura, notaCredito, facturaAnulada/fecha/autor,
historialFiscal, idNotaCredito y audit. Mantiene jobs durables en
sv_fiscal_emissions mediante transacciones. index.js:548 agrega log_actividad.
La coordinación usa sv_labor_guard/recibos y el commit condicionado del store.
vendor/labor/labor-guard.js:171 puede aumentar proyecciones commercialPages,
según configuración. No clasificar este servicio como simple proxy ni retirarlo
del snapshot sólo porque su mutación sea fiscal.

El runtime remoto del ZIP pasa commercialPages a createLaborGuard, pero no
clientAccounts/clientHistory y el guard vendorizado no recibe esos parámetros.
Esto no demuestra por sí solo un fallo con las capacidades actuales, pero sí
impide usar esa revisión como prueba de coordinación integral futura de Accounts/H7.
No se certifica la activación de proyecciones a partir de código condicional ni
se atribuyen cambios de pagos/gastos/comisiones a este handler sin trazado.

### Correo y CostGuard: fuentes vinculadas y alcance separado

Cloud Functions enlaza estos storageSource exactos en bucket
gcf-v2-sources-171899432710-us-central1:

| Objeto/generación | Bytes | Build |
|---|---:|---|
| correoSolicitudConfirmada/function-source.zip#1791817849703337 |36711|71e2ab6d-0db8-4dd4-9992-1205cd4b7335|
| correoSolicitudDeclinada/function-source.zip#1791817920606055 |36711|3a774f34-11c9-4c6c-a180-0986d2b950c2|
| sisventasCostGuard/function-source.zip#1792361526082736 |19998|3aace571-8ed1-4405-a5c4-c3d4989868fc|

Los ZIP de correo son idénticos, SHA256
`06bcf1841a67fc9e67cec9f09ad2c9df50b8011e58afe2e8f441f6fc4dfd549a`.
index.js lee el evento y mail.cjs:13–20 transacciona/setea sólo
sv_catalogo_solicitudes_correo/{id}/{type}; lee sv_catalogo_solicitudes/{id} y
envía SMTP. No escribe agenda/OT/ventas/pagos/gastos/comisiones ni sus proyecciones.

ZIP CostGuard SHA256
`6fac6cabf0636696d2c4dafcc42155b1b66f1ac04f24e1ad3803dbbe748a1ce3`.
Su policy.cjs valida presupuesto/notificación, puede deshabilitar la instancia
RTDB y cambiar escalado/tráfico de cotizador/asistente/emitirfactura/testtfapp.
No escribe originales comerciales, pero sí puede afectar disponibilidad y
tráfico durante un corte. La inspección estática no prueba que el umbral o
presupuesto estén configurados efectivamente hoy. No se consultaron valores de
presupuesto/credenciales ni se ejecutó ninguna acción del guard.

Todos los ZIP permanecen en tmp privado, fuera de Git. No se invocaron funciones,
leyeron registros comerciales, enviaron correos ni ejecutaron eventos, IAM,
despliegues, instalación o modificaciones de infraestructura. Las afirmaciones
de escritura se basan en fuente vinculada a versiones/revisiones observadas;
no equivalen a trazas de operaciones reales ni demuestran drenaje efectivo.

## Ampliación readonly: testtfapp-00009-rux · 04/11/2026

Región `southamerica-east1` confirmada por label del servicio `testtfapp`.
Cloud Run informa una única entrada de tráfico:100% a `testtfapp-00009-rux`,
latestRevision=true, sin etiquetas en esa respuesta. URL observada, no invocada:
`https://testtfapp-is54pr4fha-rj.a.run.app`.

Procedencia:

- Imagen de revisión:
  `southamerica-east1-docker.pkg.dev/nixa-sisventas/gcf-artifacts/nixa--sisventas__southamerica--east1__test_t_f_app@sha256:5292c317d10eb353b95d5332adc173425dc24865983164e67aab9d1ddfeb95d2`.
- Anotación build-id del contenedor worker:
  `db0c8801-bb03-4f0a-bc7f-979d09d8d9af`. Cloud Build SUCCESS; su respuesta
  seleccionada no incluye results.images ni procedencia Git, por lo que no se
  afirma una segunda comparación del digest contra resultados del build.
- Anotación build-source-location:
  `gs://gcf-v2-sources-171899432710-southamerica-east1/testTFApp/function-source.zip#1792080582577358`.
  Metadatos del objeto:40.293bytes, generación1792080582577358. Se descargó sólo
  ese ZIP identificado a `C:/SisVentas/tmp/testtfapp-00009-rux-source.private.zip`.
  SHA256 de sus bytes:
  `252f8205a065a2cc78ccc77c0c43c3ccdfd9e6916616a6fcdf419dc5b1f9df50`.
- Cloud Functions Gen2 `testTFApp` informa ACTIVE, build idéntico, el mismo
  bucket/objeto/generación, serviceConfig.service=testtfapp y
  serviceConfig.revision=testtfapp-00009-rux. **buildConfig.entryPoint=testTFApp**.
  Esa vinculación permite distinguir el handler ejecutado de los otros exports
  incluidos en el paquete; no se deduce la entrada por el nombre del servicio.

El ZIP contiene index.js, package.json, package-lock.json, security-storage.cjs
y service-auth.cjs. En index.js:537–572, testTFApp permite OPTIONS/POST,
autoriza mediante chequearAuth(...,'fiscal-test') y hace POST al endpoint fijo
`https://www.tusfacturas.app/app/api/v2/estado_servicios/alertas`; devuelve estado
de facturación o error. No despacha según rutas ni llama a emitirFactura.
chequearAuth (166–168) delega a service-auth.cjs, que verifica ID token y lee
sv_chat_roles, sv_permisos y sv_access_resets. No hay escritura RTDB en este
camino; la inicialización global sólo prepara Admin/DB y definiciones de funciones.

**Clasificación:** proxy autenticado de consulta de estado del proveedor, sin
escrituras propias de agenda, OT, ventas, pagos, gastos, comisiones u otros
originales comerciales en el handler testTFApp examinado. No es una prueba de
ausencia de efectos internos de auditoría/uso en el proveedor remoto o Auth.

Límite esencial: el mismo index.js también exporta emitirFactura, que actualiza
sisventas/ventas/.../factura y agrega log_actividad (522–523), y contiene
funciones push condicionales con escrituras de dispositivos/eventos. No excluir
el ZIP completo ni otros servicios como si fueran de sólo lectura: esas otras
entradas necesitan su propio inventario. La exclusión se limita al servicio,
revisión y entryPoint aquí vinculados, bajo los metadatos observados. No se
invocaron endpoints, leyeron originales/credenciales, instalaron dependencias,
descargaron contenedores, modificaron IAM ni desplegaron cambios. El ZIP queda
privado en tmp, fuera de Git.

Revisión readonly del 04/11/2026. Este documento pertenece al frente de revisión
de escritores; no modifica CONTEXTO_ACTUAL, fuentes congeladas ni autoriza un
corte. La observación es puntual y debe renovarse si cambia la revisión.

## Procedencia exacta observada

- Proyecto: `nixa-sisventas`. Región `southamerica-east1`, identificada por
  `cloud.googleapis.com/location` al listar servicios, no inferida del nombre.
- Revisión lista: `asistente-calendar-2d8b0cf0`.
- Imagen: `southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/asistente@sha256:ce29187e7da14d9205111d49f4a2c6fe2ddf0a2bc664f630c693bf68b8e8197f`.
- Anotación `run.googleapis.com/build-id`, contenedor `asistente-1`:
  `b28b6d6d-8b66-4970-a1b3-1ed4e0be7268`. Cloud Build informa SUCCESS y el
  mismo digest de imagen. Su respuesta no proporciona una procedencia Git.
- Anotación `run.googleapis.com/build-source-location`:
  `gs://run-sources-nixa-sisventas-southamerica-east1/services/asistente/1792643481.340958-403fba1a50bf4b08866817e12ae245ab.zip#1792643482107555`.
  Se verificaron tamaño **31.020 bytes** y generación **1792643482107555** antes
  de descargar únicamente ese archivo identificado. No se descargó el contenedor.
- Copia privada local: `C:/SisVentas/tmp/asistente-calendar-2d8b0cf0-source.private.zip`;
  no incorporarla a Git. Contiene index.js, admin.cjs, audio.cjs,
  service-auth.cjs, statement-import.cjs, usage-limit.cjs, package.json,
  package-lock.json y .gitignore. El inicio declarado es `node index.js`.

El commit `2d8b0cf0` corresponde a cambios de frontend; el nombre de revisión no
prueba que ese commit contenga esta fuente. La copia anterior
`tmp/asistente-source/index.js` no sirve como sustituto de la fuente vinculada.

## Escrituras y servicios encontrados en esta fuente

`index.js:19` admite sólo POST a `/`, `/learn`, `/purchase-import`,
`/statement-import` y `/transcribe`; OPTIONS se resuelve antes. El resto devuelve
404. El archivo no contiene rutas Calendar/agenda. El proxy llama a Anthropic
(`index.js:48–60`); transcripción llama a Google Speech (`audio.cjs`). Las
propuestas de reglas y la normalización de extractos se devuelven al solicitante;
no se persisten como cambios comerciales desde este servicio.

La única escritura RTDB encontrada en los módulos del paquete es la transacción
de cuotas `sv_server_ai_usage` (`usage-limit.cjs:8–17`). service-auth.cjs y
audio.cjs leen roles, permisos y marcas de acceso; admin.cjs inicializa el SDK.
statement-import.cjs exporta construcción de payload y normalización, sin
transporte ni persistencia. No se encontró escritor de agenda, OT, ventas o
pagos, ni integración Google Calendar en esta fuente.

Esto permite excluir esta revisión del inventario de escritores comerciales
directos. No certifica otras revisiones, etiquetas, URLs antiguas, otros
servicios, clientes instalados, herramientas privadas ni efectos posteriores
que un cliente decida aplicar a partir de la respuesta de IA. No se invocaron
APIs funcionales, leyeron registros comerciales, desplegaron servicios ni
modificaron IAM/reglas/configuraciones.

## Revisión de herramientas de preparación y corte

1. `scripts/lib/commercial-cut-evidence.cjs` exige dominios, fences, proyecciones
   y circuitos, y rechaza omitir un escritor **ya declarado** para un dominio.
   Devuelve expresamente `scope: offline-consistency-only`,
   `remoteVerified: false`, `activationAuthorized: false`. Correcto como
   consistencia offline; no es una puerta remota completa. No hay inventario
   externo obligatorio de servicios/regiones/revisiones/etiquetas/URLs o clientes
   antiguos, fecha de observación ni contraste con archivos de prueba: acepta
   hashes de 64 caracteres sin leer ni autenticar sus artefactos. Un escritor
   omitido de todo el manifiesto no puede ser detectado por esa comprobación.
2. `scripts/lib/client-account-preparation.cjs` verifica siete entradas y sus
   huellas, reconciliación y destino de cuentas declarado ausente. No demuestra
   que las entradas sean completas/remotas ni que exista pausa y drenaje efectivos;
   `accountDestination: null` es un argumento, no una consulta. Devuelve una
   propuesta `activation` con ready true separada del parche; no aplica nada.
   Extraer esa propuesta y tomar verify=true como permiso sería incorrecto.
3. `scripts/lib/commercial-write-cut-rules.cjs` sólo compone reglas offline y lo
   declara. No consume el manifiesto de evidencia ni acredita el cierre de
   escritores privilegiados, que no queda demostrado por reglas SDK.
4. `scripts/apply-commercial-ownership-rules.cjs` es un aplicador histórico de
   ownership, no el aplicador del nuevo corte integral. Con --apply exige hash
   candidato, base remota exacta, compilación y contraste posterior; no exige
   manifiesto de escritores, evidencia de URLs antiguas, paquete compatible ni
   pausa/drenaje. No reutilizarlo como puerta de activación integral. Su salida
   alreadyApplied usa applied=true incluso sin --apply cuando las reglas ya
   coinciden: informa equivalencia de reglas, no autorización del nuevo corte.

Conclusión de revisión: las herramientas offline no declaran activación
autorizada, pero **no exigen por sí solas evidencia de todos los accesos antiguos**.
Falta una puerta operativa que contraste inventario remoto fresco y exhaustivo,
artefactos reales y paquete exacto; incluya todos los endpoints/revisiones con
acceso privilegiado, clientes anteriores y scripts privados; y compruebe pausa,
drenaje y exclusión de las siete fuentes antes del commit técnico. Los resultados
de emulador/offline no reemplazan esas pruebas ni autorizan activar capacidades.
Estos son límites de las herramientas inspeccionadas, no una prueba de que un
escritor omitido haya modificado datos en producción. No se ejecutó el aplicador.

## Cierre local mediante archivos explícitos

Se añadió `scripts/lib/commercial-cut-file-evidence.cjs`, separado del validador
compartido y de cualquier aplicador. API: `validate(bundle, options)`. No tiene
CLI de despliegue ni red, descubrimiento de archivos, lectura de credenciales o
escrituras. Sólo abre los archivos indicados explícitamente por el llamador;
usar exclusivamente evidencias previamente sanitizadas, nunca originales ni
credenciales. Admite archivos públicos o privados fuera del checkout; no copia
sus contenidos al repositorio ni los devuelve en el resultado.

Contrato schema 2 (sustituye schema1; este último se rechaza):

- Cada referencia de archivo es `{path, sha256}`: ruta absoluta, hash SHA256 de
  bytes exactos, archivo regular hasta20MiB. Rechaza enlaces simbólicos finales;
  no se presenta como un sandbox contra directorios padres enlazados. Las rutas
  son entradas confiables y explícitas del operador, sin enumeración recursiva.
- bundle contiene únicamente schema, manifest, baseline, inventory, declarations,
  pause, fiscal y artifacts. Los documentos de evidencia se aportan como
  referencias de archivo (manifest, baseline, inventory, pause, fiscal); declarations es
  un array y artifacts es la lista de referencias de archivos probatorios.
- options exige expectedBaselineSha256, now (epoch ms) y maxAgeMs positivo hasta
  24horas. La huella basal se aporta por separado; debe coincidir con los bytes
  del archivo basal y observed.rulesSha256 del manifiesto. Es hash de bytes,
  no el hash semántico JSON de otros scripts. No sustituir una convención por otra.
- manifest conserva el contrato de commercial-cut-evidence. Todos sus hashes
  Sha256 deben corresponder a archivos leídos y contrastados de artifacts,
  salvo projectionSha256, que el validador compartido calcula sobre las
  proyecciones canónicas del propio manifiesto.
- inventory contiene schema, observedAt ISO, baselineSha256, scopes y accesses.
  Cada scope declara id, kind, complete=true y proofSha256. Se exigen al menos
  cloud-run, functions, browser y private-tools; los id deben identificar los
  ámbitos realmente inventariados (proyecto/región/servicio según corresponda).
  La evidencia de complete debe listar sus ámbitos y método de descubrimiento.
  Cada access contiene id, scopeId, revision, url, trafficPercent, tag y
  proofSha256. Incluir cada URL/etiqueta antigua aunque tenga tráfico0; en
  navegador/herramientas identificar versión o huella y punto de acceso.
- declarations debe coincidir exactamente por id con accesses. Cada entrada
  contiene id, accessSha256 (hash JSON canónico del access observado), writerIds
  y excludedProofSha256. Debe asociar escritores del manifiesto o justificar
  exclusión con archivo probatorio; al asociar escritores, excludedProofSha256
  es null. No admite escritores del manifiesto sin acceso asociado.
- pause contiene schema, baselineSha256, inventorySha256, manifestSha256,
  pausedAt, drainedAt, sources y accesses. Vincula los archivos exactos de
  inventario/manifiesto; exige observación≤pausa≤drenaje≤now y frescura. Las siete
  fuentes sales/payments/budgets/customers/users/identities/permissions requieren
  name, paused=true, drained=true y proofSha256. Cada acceso observado requiere
  id, paused=true, inFlight=0 y proofSha256; los accesos excluidos también deben
  quedar contabilizados en esta evidencia conservadora del corte.

El resultado conserva remoteVerified=false y activationAuthorized=false, con
scope=offline-files-and-declared-observations-only. La comparación detecta un
acceso antiguo observado y omitido de declarations; no puede descubrir uno
omitido también del inventario observado. Los archivos probatorios quedan
vinculados por contenido, pero sus afirmaciones no son verificadas remotamente
ni firmadas por esta herramienta. complete/paused/drained son afirmaciones
aportadas con evidencia, no una adquisición efectiva de bloqueo. Nunca tomar
este resultado como permiso para ejecutar ownership/apply o activar flags.

Verificación ficticia:23casos nuevos más20del validador compartido,43/43PASS;
node --check de ambos archivos nuevos y git diff --check sin errores. No se
ejecutaron aplicadores, consultas de red ni operaciones sobre datos reales.

### Evidencia fiscal obligatoria integrada (schema2)

La reproducción ficticia old→new documentada privadamente por el frente fiscal
confirmó que un job despachada sin resultado o un resultado durable pendiente
pueden coexistir con sv_labor_guard vacío. No se usa guardEmpty como sustituto
del drenaje HTTP, de la clasificación completa de jobs ni de su conciliación.
No se cambia el runtime ni se expiran/reemiten jobs ambiguos para obtener ceros.

bundle.fiscal exige referencia absoluta `{path,sha256}` de un JSON minimizado,
sin payloads fiscales, clientes, CAE ni originales. El documento debe contener
exactamente:

- schema=1; baselineSha256, inventorySha256, manifestSha256 y pauseSha256
  coincidentes con los archivos exactos de esta validación.
- observedAt ISO posterior o igual al drainedAt de la pausa, no futuro y fresco
  según maxAgeMs; la pausa también conserva su propia validación de antigüedad.
- admissionBlocked=true y admissionAccessIds con exactamente todos los id del
  inventario, sin omisiones, añadidos ni duplicados. Evidencia conservadora:
  incluso un acceso excluido debe quedar contabilizado. El bloqueo debe abarcar
  revisión principal, etiquetas, rutas y entradas retry/worker pertinentes.
- activeRequests=0, ambiguousJobs=0, pendingAttachments=0, explícitamente números.
  Ausente, null, string, false, negativo o positivo no equivalen a cero. Requests
  refiere a ejecución HTTP aceptada, incluso entre preflight y reserva; no se
  inventa una colección sv_fiscal_requests ni se infiere drenaje por una espera.
- jobInventoryComplete=true, markersReconciled=true, resultsReconciled=true y
  guardEmpty=true. AmbiguousJobs incluye despachada sin resultado, estados
  desconocidos/corruptos y relaciones contradictorias no resueltas. Un resultado
  durable sin marcador coincidente mantiene pendingAttachments o ambigüedad;
  necesita conciliación/recuperación autorizada, nunca reemisión automática.
- admissionProofSha256, requestsProofSha256, jobInventorySha256,
  reconciliationProofSha256 y guardProofSha256 deben identificar archivos
  explícitos de artifacts, cuyos bytes se leen y verifican. Se permiten resúmenes
  minimizados y huellas/conteos; no ingresar originales ni credenciales.

El inventario fiscal debe conservar y clasificar historia terminal válida, no
borrarla para conseguir cero: rechazada sin resultado se distingue de autorización
incierta; un marcador histórico válido puede seguir conciliado aunque después
se haya reemplazado la factura actual. La evidencia debe provenir de observación
final estable mientras la admisión continúa bloqueada y debe revalidarse antes
de reabrir escritores. Este validador verifica estructura, vínculos, hashes y
afirmaciones aportadas; no inspecciona jobs reales ni acredita que se haya tomado
un bloqueo remoto. La veracidad y exhaustividad del observador siguen siendo
límites explícitos.

La salida añade fiscalSha256 y schema2, manteniendo remoteVerified=false y
activationAuthorized=false. No hay contrato alternativo ni aplicador nuevo.
Validación actual:56casos de archivos (incluidos33nuevos fiscales) más20del
validador compartido,76/76PASS; sintaxis JS y git diff --check correctos. Los
negativos incluyen cada estado, vínculos basales/de pausa/inventario/manifiesto,
antigüedad, prueba ausente/alterada y accesos antiguos omitidos. Sin red ni lectura
de jobs reales en esta ampliación.

### Contraste del inventario fiscal minimizado con el resumen

Corrección posterior dentro del mismo schema2: jobInventorySha256 ya no admite
un texto genérico como prueba. Debe identificar en artifacts un archivo JSON
minimizado con exactamente schema, observedAt, baselineSha256, inventorySha256,
manifestSha256, complete, ambiguousJobs, pendingAttachments, markersReconciled
y resultsReconciled. schema debe ser1; los tres vínculos deben coincidir con la
baseline y archivos de inventario/manifiesto exactos de la puerta.

complete debe coincidir estrictamente con fiscal.jobInventoryComplete;
ambiguousJobs, pendingAttachments, markersReconciled y resultsReconciled deben
coincidir estrictamente con sus campos homónimos del resumen fiscal. Así se
exigen true/0 numérico, sin coerción ni valores ausentes. Una declaración fiscal
de cero se rechaza si el archivo de inventario declara un job ambiguo o pendiente,
o conciliación incompleta, aunque el hash del archivo sea válido.

observedAt debe ser una cadena de fecha válida, no futura, posterior o igual al
drenaje, fresca según maxAgeMs y exactamente igual a fiscal.observedAt. El
resumen fiscal debe representar esa misma observación final, no una fecha nueva
que haga parecer vigente un inventario anterior. No se computan conteos desde
jobs raw ni se inventa su clasificación: estas cifras minimizadas deben provenir
de conciliación autorizada externa. El validador sólo comprueba la consistencia
de esos documentos y sus bytes; mantiene remoteVerified=false y
activationAuthorized=false.

Regresión actual:97/97PASS (los76anteriores más21negativos nuevos), con casos de
ambigüedad1/resumen0, pendiente1, conciliaciones false, tipos incorrectos,
observación obsoleta/previa al drenaje/futura/distinta, baseline/inventario/
manifiesto distintos y prueba de texto noJSON. Sintaxis y diff correctos. Sólo
se modificaron este documento, el validador propio y su prueba ficticia.
