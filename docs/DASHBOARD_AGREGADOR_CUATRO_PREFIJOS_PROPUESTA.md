# Agregador de actividad y métrica mensual · entrega al montador frontend

Implementado en el checkout aislado sobre `b35fe07cd052f704634a8c0cdec15c49d63488c1`. No modifica UI, index, escritores, importes ni originales. No hay índice nuevo ni lock. Tanto agregador como puerto mensual están desactivados por defecto.

## Contrato del host

`dashboard-activity-aggregate-proposal.js` exporta `create`, `port`, `snapshot` y `same` (UMD/CommonJS). Sus JSDoc definen `CapturedContext`, `PortRequest`, `PortResponse` y `VerifiedPort`, además de validaciones en ejecución. `create({enabled,capture,valid,ports,requireNotices:true}).read()` requiere:

- Una captura síncrona con UID/rol, Auth y DB reales, usuario Auth actual, `permissionRevision`, `permissionSignature`, `sessionEpoch` monotónico incluso para reautenticación del mismo UID, `dataEpoch` obligatorio (entero seguro no negativo) para reinicios de datos aun con los mismos objetos Auth/User, conexión y `connectionEpoch`, zona IANA/locale explícitos, grants, mes `YYYY-MM`, día `YYYY-MM-DD` y etiqueta exacta de empleado.
- `ports.budget.read({schema:1,context})`: resultado del lector existente de Presupuestos con actividad, contadores, badge y avisos completos cuando se exige `requireNotices`.
- `ports.commercial.read({schema:1,context,domain})`: resultado del lector autorizado existente para ventas, pagos u OT.
- `ports.month.read({schema:1,context})`: métrica propia mensual, vinculada a generación/revisión global de Presupuestos.

`port({capture,valid,read})` envuelve un lector real y devuelve `{schema:1,context,value}` únicamente si conserva esa misma captura antes/después. No confiere autoridad: los lectores inyectados siguen verificando permisos frescos. El host no debe envolver memorias parciales ni DTO inventados como si fueran lectores verificados. Los objetos Auth/DB/contexto permanecen locales; no se serializan a una ruta HTTP.

Esta primera versión exige los cuatro prefijos autorizados. Un grant null legítimo se acepta como estado de captura, pero rechaza el paquete de cuatro fuentes ANTES de cualquier lectura; no se inventa un prefijo vacío ni se declara completa una fuente denegada. Un permiso denegado no se transforma en fuente vacía ni en un cero. No implementa reintento ni fallback; ante un error no devuelve resultado parcial. El host puede conservar presentación anterior explícitamente obsoleta, pero no marcar lista una captura rechazada. No se promete abortar físicamente GET ya enviados por lectores independientes.

## Intervalo comprobado

Secuencia: B0 → mes0 → los tres comerciales → mes1 → B1. Cada llamada se valida contra la misma captura. Primero se valida que cada resultado comercial tenga el dominio esperado por posición y su alcance autorizado, antes de leer B1 o comparar revisiones. Se comparan exactamente generación/revisión de los TRES comerciales, aunque individualmente sus lecturas sean válidas. B0/B1 deben ser lecturas verificadas e iguales, incluyendo generación/revisión y consumidores. Las dos métricas mensuales deben ser iguales y estar ancladas a esa revisión global de Presupuestos. El bucket puede tener una revisión menor: no se confunde una revisión puntual antigua válida con una cobertura global distinta.

Sólo después se llama al `Core.merge` existente con los cuatro prefijos, un único contexto y revisiones verificadas por dominio. No se exige que el índice de Presupuestos tenga la misma generación/revisión numérica que el índice comercial: se valida su estabilidad durante el tramo comercial. No se presenta como snapshot atómico frente a escritores privilegiados que omitan el protocolo o reviertan revisiones.

## Puerto mensual SDK/fresh separado

`dashboard-budget-month-port-proposal.js` exporta `create`, `createFresh` y `hash`. No edita el SDK ajeno. Se comprobó con los lectores/DTO/reglas originales de `4dec3f6648c3cb4ae922a047624da4bb1a6a8529`, en checkout de referencia separado y limpio.

La ruta de datos es `months/u_UID/hash([employeeLabel,YYYY-MM])`, con `monthProof` del mismo bucket. El UID del alcance siempre viene de la sesión; la etiqueta sólo filtra y jamás sustituye propietario, comisión o identidad. Se preservan el filtro exacto por empleado y prefijo ISO de fecha, los estados del denominador y el redondeo del porcentaje legacy. No se deriva la métrica de cinco filas ni de `counts` históricos. En QA hubo 54 presupuestos del mes y cinco eventos de actividad.

Se valida el header propio `read/UID` antes/después, sus permisos/revisión/generación, el hash normalizado del bucket y los límites de los contadores; bucket, prueba e indicador de ausencia se releen antes de terminar. Para un cero se exige ausencia de ambos, `coverage/scopeAbsenceIsZero === true` y dos consultas al índice YA EXISTENTE `monthMembers/u_UID/hash(...)`, cada una `orderByKey().limitToFirst(1)`, sin miembros. Si faltan conteos/prueba pero queda un miembro, se rechaza. Una ausencia legítima de diciembre se distinguió de eliminar metadatos poblados de noviembre. Eliminar también todos los miembros mediante bypass privilegiado sigue fuera del contrato de índice completo/cercado.

`createFresh` tiene allowlist propia: header de UID actual, dos puntos mensuales propios, ese indicador booleano y consulta de UN miembro sólo para verificar ausencia. Deniega raíces, ámbitos ajenos, consultas sobre conteos, cursores y otros parámetros. Usa HTTP GET `cache:no-store`, token actual y comprueba usuario/epoch antes/después de obtener token y recibir respuesta. No usa caché SDK como prueba de frescura. No cambia el TZ global.

`dashboard-budget-month-rules.proposal.cjs.extendStandalone(base)` extiende únicamente las reglas standalone restrictivas entregadas por el llamador; conserva su autoridad fresca de header/rol/perfil/revisión/módulos/reset. Las rutas mensuales sólo permiten scope propio; los miembros requieren límite uno y ninguna otra cota. No habilita escrituras ni padres y rechaza una base inesperada o reglas preexistentes en esos caminos. Es una propuesta de QA, no un combinador/desplegador productivo.

## Conexión mínima por el frontend root

Después de cargar los dos módulos nuevos, enlazar las fábricas existentes, sin tocar `pptoData`:

```js
const A = SVDashboardActivityAggregateProposal;
const M = SVDashboardBudgetMonthPortProposal;
const ports = {
  budget: A.port({capture, valid, read: () => budgetSDK.read({activity:true, badge:true, notices:true})}),
  commercial: A.port({capture, valid, read: ({domain}) => verifiedCommercialRead(domain)}),
  month: M.create({enabled:true, capture, valid, readFresh: freshMonthlyRead})
};
const aggregate = A.create({enabled:true, capture, valid, ports});
const packet = await aggregate.read();
```

`capture`, `valid`, `budgetSDK`, `verifiedCommercialRead` y `freshMonthlyRead` son puertos reales del host, no globals nuevos de la aplicación. El host captura mes/día/etiqueta junto con la sesión y aplica su readiness únicamente después de recibir el paquete; ante logout, cambio de epoch/usuario/rol/permisos/grants/zona/mes o reconexión invalida la captura. Montar juntos `packet.activity`, `packet.monthly`, `packet.counts`, `packet.badge` y candidatos `packet.notices` mediante los renderizadores existentes; no reemplazar las reglas del modelo de avisos por filas de actividad.

`consumersComplete`/`budgetNoticesComplete` sólo describen ese paquete cuando se exigieron avisos completos. Siempre se devuelve `originalCollectionComplete:false`, `notificationCenterComplete:false` y `dashboardComplete:false`.

**Ventas por autor sigue pendiente:** `renderDashAdministrativo` también filtra ventas por `ventaResponsableComercialReporte(v) === currentUser` y fecha ISO del mes. Esa función toma creador y fallback de audit, independientemente de comisión; no equivale a `Pages.ownerUid`. El paquete devuelve `salesAuthorMonthly:null` y `salesAuthorMonthlyComplete:false`. No mostrar cero, usar precios/propietario Pages ni extender proyectores para resolverlo aquí. Root continuará con una fuente acotada de reporte/autores; este paquete no certifica ese indicador ni la colección original global.

## Evidencia

- 31 focales PASS, cero FAIL/SKIP: trece casos del agregado, seis del merge y doce comerciales existentes. Fuentes/builder/guard reales con transporte ficticio; tres prefijos válidos pero obtenidos a ambos lados de una escritura comercial real se rechazan. Una escritura real de Presupuestos entre B0/B1 se rechaza. Incluye mutación de bucket sin cambio de cabecera, revocación real de configuración, mismo UID con otro epoch/usuario, firma de permisos y reconexión, y metadatos faltantes frente a ausencia.
- Cuatro casos RTDB PASS, cero FAIL/SKIP: SDK original 4dec con actividad/badge/notices completos + puerto mensual fresh + lectores comerciales reales. Reglas restrictivas, JWT del emulador; denegaciones de padres, originales, ámbitos ajenos, miembros sin límite y escritura. Revocar permiso bloquea la siguiente lectura fresh. Retirar epoch mientras espera el token impide iniciar GET (cero llamadas de red en ese caso).
- Namespace final `demo-activity-aggregate-20296` vaciado y verificado; emulador propio detenido. Los verificadores del backend comercial son ficticios y las reglas son standalone locales, no evidencia de reglas productivas.
- Logs privados fuera de Git: `C:/SisVentas/tmp/activity-aggregate-focal.private.log` y `activity-aggregate-native.private.log`. No se repite la puerta general de integración ni se afirma UI montada.

Siguiente paso del root: importar esta entrega, conectar puertos reales y readiness en su freeze, renderizar los consumidores juntos y validar arranque/retorno desde Notificaciones con HTML real. Quedan vigentes las precondiciones de corte de escritores privilegiados y publicación/seguridad; no se desplegó ni publicó nada.

SHA256 focal: 88535FCAEB2D3C2E4F30FE7F6E9CBAF0F21F6113F03584AA6B4480953AD15E0D. SHA256 RTDB: A4FF4CFE8F4343CE318A01DC302126F82897ACD83B289F15F153647966C904A2.

## Delta sobre 29e524eb · retiro de datos y validación temprana

Se agrega dataEpoch a CapturedContext, campos de snapshot/same y resultado. Es obligatorio, entero seguro no negativo y sin default: el host debe incrementarlo en cada reinicio/invalidez de datos aunque conserve UID, Auth y User. El puerto mensual y el adaptador de puertos heredan el mismo retiro porque usan snapshot/same compartidos. No se modifica Source, SDK existente, DTO, permisos ni reglas.

Siete reproducciones nuevas fallaron en 29e524eb: dataEpoch cambiado durante lectura con Auth/User idénticos, dominio comercial intercambiado que antes llegaba hasta B1, cuatro grants null que antes iniciaban lecturas y validación de enteros seguros ausente. Con el delta pasan las siete. Foco completo: 26 PASS, cero FAIL/SKIP (13 agregador previos, siete nuevos y seis merge). No se repitió general ni emulador; los cuatro RTDB anteriores son evidencia de 29e, no de una repetición nueva. Mis ventas sigue null/no completo.

Logs privados: activity-aggregate-data-epoch-red.private.log SHA256 7A0C1DEAB47ECDB547FF49F992DF5BD1B89AA0EB123D5E2587DA9F5CA54A1B6E; activity-aggregate-data-epoch-focal.private.log SHA256 E362244A857DFF836C4ECCC073A59D5ABC907706335D26B2459417565B893156.

## Repetición nativa integrada 859afaf9 · referencia y Legacy actuales

Se adaptó solamente el harness nativo para cargar TODOS los módulos funcionales y fixtures de una referencia aislada, limpia y fijada en `859afaf945ab29175b8f35dbf17519f4a762123f`, en lugar de mezclar fuentes locales con el SDK 4dec. No se modificó ninguna fuente funcional, DTO, regla, proyector, servicio o índice. La comparación de `js/core`, `cotizador` y `security` entre ese SHA y `c269609a0dc03887b4429036b666a6e7f8a891ae` no mostró diferencias. No se editó la integración raíz.

Resultado final: cuatro PASS, cero FAIL/SKIP, Node22.23.4, emulador propio RTDB4.11.2 loopback9197, namespace `demo-activity-aggregate-18312`, raíz vacía verificada y emulador propio detenido. Se mantuvieron exactamente los cuatro cuerpos de prueba/expectativas de 68bbf02a, salvo el título de referencia y normalización de LF/CRLF para comparar: hash de cuerpos `d2ca7b353e55ccab9d7b7f54277a0863b48868e2c8b5148ed3ccb5a3a618bd40`. El harness comprueba esa igualdad automáticamente.

El manifiesto privado registra 57 dependencias efectivamente cargadas desde 859, sus SHA256 de bytes, SHA del harness, referencia Git limpia antes/después y Legacy actual capturado/validado. Incluye las dos reglas restrictivas, transportes HTTP fresh, SDK, agregador, puerto mensual, builders y espejos canónicos backend `commercial-models`. Legacy cliente/servidor coinciden en `a74a1567d5c22ecc83f5cb5605b4cae38017e0d9753461a35df6ded25463720f`.

Evidencia: paquete con avisos completos, 54 presupuestos mensuales frente a cinco eventos, cero originales; denegaciones reales de raíces, scopes ajenos, miembros sin límite y escrituras. La revocación se comprueba por HTTP fresco, epoch retirado durante token no inicia GET, y se distingue ausencia certificada de conteos/pruebas perdidos con miembros todavía presentes. Mis ventas por autor y Dashboard siguen no completos.

Artefactos privados fuera de Git:

- `C:/SisVentas/tmp/activity-aggregate-integrated859-manifest.private.json`, SHA256 `BD45EE95AB6BE56CC3D1AFED97C80BD724F84C99CAE975B257E2D4A82D958F6E`.
- `C:/SisVentas/tmp/activity-aggregate-integrated859-native.private.log`, SHA256 `6A4B5F37E8F8E7A73AADD93E82945B3AA299D9C5631E244A3EFA1EF71DC8AE44`.

Reproducir el harness con `SV_ACTIVITY_AGGREGATE_EMULATOR=1`, `SV_ACTIVITY_AGGREGATE_QA_PORT=9197`, `FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9197`, `SV_ACTIVITY_SDK_CONTRACT_ROOT` apuntando a checkout limpio de 859, `SV_ACTIVITY_ADMIN_MODULE` al SDK Admin local y `SV_ACTIVITY_REFERENCE_MANIFEST` a un destino privado. El harness exige SHA exacto y manifiesto explícito; no acepta silenciosamente otra referencia. La primera ejecución encontró9089 ocupado y no cumplía el requisito de emulador propio; se conservó por separado como `activity-aggregate-integrated859-first-shared-port*`, no como evidencia final. Su namespace quedó vacío; el proceso ajeno no se detuvo.

Límites: reglas standalone ficticias, tokens de emulador y verificador comercial ficticio; no acreditan producción, UI montada, corte privilegiado ni seguridad global. No se ejecutó puerta general ni se cambió el contrato de Source/filas/header. No se implementó la faceta Mis ventas.
