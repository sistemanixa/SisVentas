# Puerto HTTP cliente Dashboard · default OFF

Archivo nuevo `js/core/dashboard-http-ports-proposal.js`. Global UMD `SVDashboardHTTPPortsProposal`; CommonJS exporta `{create, ROUTES}`. No modifica app, index, endpoints, Source, SDK ni reglas. Depende de `dashboard-activity-aggregate-proposal` y su Core existente, que se cargan antes.

## Factory y montaje del host

```js
const context = SVDashboardHostContext.create(root); // host root831ea79b
const http = SVDashboardHTTPPortsProposal.create({
  enabled: true, // omitido => OFF
  host: root,
  baseURL: root.SISVENTAS_FUNCTIONS.cotizadorProveedor,
  capture: context.capture,
  valid: context.valid,
  requestMs: 10000
});
// Source: read(kind) con kind 'dashboard' o 'notices'.
const readForSource = kind => http.read(kind);
// Agregador: puertos tipados schema1/context/value.
const ports = http.ports; // .budget.read, .commercial.read, .month.read
```

El host preselecciona authorized-server mediante su decisión de transporte existente. Este módulo no decide acceso, no importa RTDB ni intenta fallback. No debe invocarse si la decisión es denied. La URL es entrada confiable del bootstrap, nunca de formularios, rutas, query strings ni mensajes del usuario. Debe coincidir exactamente con la configuración `SISVENTAS_FUNCTIONS.cotizadorProveedor` del host y permanecer igual durante la lectura. Se preserva su prefijo de función/path al añadir rutas fijas. Se rechazan credenciales, query, fragmento, whitespace, escapes y segmentos dot. HTTP sólo existe para loopback explícitamente habilitado en tests; producción exige HTTPS.

La captura usa Aggregate.snapshot/same: User real por referencia, Auth/UID/rol, permissionSignature/revision, sessionEpoch, dataEpoch, connectionEpoch, DB, grants y calendario/etiqueta/zona/locale. Si el host aporta configSignature separado también se fija durante la operación. El campo de configuración canónico de Aggregate sigue llamándose permissionSignature. No hay defaults de epochs: dataEpoch proviene de `SVDataReadiness.snapshotEpoch()` mediante el contexto root, no de un contador ficticio. `valid` conserva su criterio de autoridad; transporte comprueba además conexión y connectionEpoch. No se permite Ver como ni UID distinto al User.

## Cinco GET existentes, cuerpos directos

- `/commercial/dashboard/presupuestos/actividad-v2`
- `/commercial/dashboard/presupuestos/avisos`
- `/commercial/dashboard/ventas/actividad-v2`
- `/commercial/dashboard/pagos/actividad-v2`
- `/commercial/dashboard/ordenes_trabajo/actividad-v2`

Las rutas son constantes internas. No hay API de URL/path libre. Los requests tipados rechazan campos adicionales, dominios desconocidos y baseURL/query/body externos. Cada GET llama al User fijado `getIdToken()` sin forceRefresh: el SDK reutiliza o renueva automáticamente un token válido y el servidor verifica revocación. La renovación forzada corresponde sólo a la recuperación explícita existente del host. El cliente comprueba nuevamente la captura antes de enviar y después de recibir/decodificar. Authorization va sólo en header Bearer; nunca en query ni logs. Fetch usa GET, cache:no-store, credentials:omit, redirect:error y referrerPolicy:no-referrer, sin body. Exige HTTP200, no redirección y URL final coincidente. El plazo de 100 a30.000ms incluye token, fetch y JSON; aborta y descarta continuaciones tardías incluso cuando un transporte ficticio ignora AbortSignal. Los errores de proveedor se sustituyen por mensajes estáticos; 401/403 conservan statusCode, sin decodificar el cuerpo de error, reintento ni fallback.

La respuesta real de index es el resultado directo: no `{ok,result}`. Actividad/schema2 conserva su prefijo intacto después de validar identidad, permisos, dominio/scope, instante/orden, precisión monetaria, cobertura y badge/fecha. OT sigue sin importe/propietario asignado. Avisos schema1 se validan completos, con17 campos públicos por fila y noticeLegacy actual; se normalizan a Source schema2 con `notices:{complete:true,rows}`. No se transporta sourceHash ni se inventan filas desde el prefijo reciente.

`http.read('dashboard')` y `ports.budget.read({schema:1,context})` hacen sólo UN GET de actividad Presupuestos (actividad/KPI/badge/monthly), sin descargar centro ni agregar notices.complete. `http.read('notices')` hace sólo el GET de avisos cuando el host lo solicita por acción/evento real; su revisión pertenece a ese consumidor independiente y no se une implícitamente con Dashboard. `ports.commercial.read({schema:1,context,domain})` acepta únicamente ventas/pagos/ordenes_trabajo. Todos los puertos devuelven `{schema:1,context,value}` tras revalidar la captura. No se guarda una caché de resultados.

## Monthly autorizado de Costos

`ports.month.read({schema:1,context})` hace únicamente el GET de actividad Presupuestos y exige su campo `monthly`. Respeta all del administrador y scope propio de los otros roles; no inventa monthly global, no obtiene la métrica de cinco filas y no consulta RTDB tras missing/denied. Se verificó contra el campo REAL de `e24fa2b89ec6c11130f1417e0eb4fc5a871247b7`, idéntico al resultado del Monthport existente en el fixture.

Contrato esperado del campo, sin crear otro endpoint:

```text
schema:1, uid, role, permissionRevision,
generation, revision, policyHash,
scope:(context.grants.presupuestos === 'all' ? 'all' : 'u_'+uid), month:context.month, employeeLabel:context.employeeLabel,
records, converted, conversionPercent,
bucketRevision, absenceCertified, complete:true
```

Identidad/revisión global coinciden con actividad Presupuestos y la captura. Scope autorizado: all con grant global, u_UID con grant propio; etiqueta/mes exactos, contadores enteros no negativos, converted<=records y porcentaje canónico. bucketRevision puede ser menor que la revisión global; null sólo con ausencia certificada y ambos contadores cero. policyHash debe existir. Sin campo se entrega `SV_DASHBOARD_HTTP_MONTH_MISSING`; las fallas de permiso siguen 401/403. Costos ya obtiene scope/nombre/mes desde autoridad y calendario server: no se agregan parámetros de usuario ni se relajan permisos para hacer coincidir etiquetas. Un desacuerdo de captura se rechaza.

El host configura el agregador con requireNotices:false para Dashboard. La composición B0/mes0/comerciales/mes1/B1 usa siete GET (sin avisos); el agregador conserva sus verificaciones de revisión/epoch. No se introduce lock ni se afirma snapshot atómico frente a bypass privilegiado. Mis ventas por autor sigue null/no completo; Dashboard y colección original no se declaran completos.

## Evidencia y límites

`test/fixtures/dashboard-http-readers-e24.json` contiene respuestas ficticias generadas invocando los cinco lectores reales en un checkout limpio e24fa2b8 (rutas/index sin cambios frente a f23a5124), con hashes de los tres lectores y de index. El campo monthly del vendedor proviene del lector server real e24, no de una inyección sintética. La validación de scope ya contempla la corrección administrativa solicitada después: all para administrador; la repetición del fixture administrativo queda sujeta al delta canónico de Costos. Incluye un oracle del Monthport existente y se comprobó igualdad exacta al generarlo. Los casos negativos eliminan o corrompen deliberadamente ese campo.

Foco del delta separado: 60 PASS, cero FAIL/SKIP (34 HTTP y26 agregado/epoch/merge). Cubre defaultOFF, los cinco payloads directos, normalización de avisos, composición del agregado, denegación/missing monthly sin otra fuente, 401/403, cambio tardío de User/Auth/UID/rol/config/revisión/epochs/DB/grants/fecha/base, token sin forceRefresh, deadline que incluye token y fetch no cooperativo, rutas/base rechazadas, dominio equivocado, Legacy/filas17 inválidos, revisión de avisos inválida y errores sin exponer payloads/tokens.

Dos pruebas adicionales PASS con fetch real y servidor efímero loopback: cinco rutas fijas, GET sin body/query/referrer, autenticación por header, 401/403 sin fallback y redirección no seguida. El servidor sólo devuelve esos fixtures ficticios y se cierra al terminar; no es un servicio nuevo de la aplicación. Ejecutar con `SV_DASHBOARD_HTTP_LOOPBACK=1` y Node `--test test/dashboard-http-ports-loopback.integration.cjs`.

Logs privados: `C:/SisVentas/tmp/dashboard-http-ports-focal.private.log` y `dashboard-http-ports-loopback.private.log`. No se ejecutó puerta general, no se publicó ni se probó CORS del navegador contra el servicio desplegado. Sigue pendiente el montaje real del host y UI junto con sus consumidores y readiness; root831 aporta el contexto, esta entrega aporta exclusivamente factory/puertos. No se modificó la integración raíz.

SHA256: focal 4586AC5CC90E8E47F139CFBA1333B3804126DBDA2A40A577047152848563B8C7; loopback 1DB9A1F14C4C75FBA05D90C56D286E91D423CBA48E472D95402319989A939CE3; fixture 15C0F08C7E9C23B12858E4B075F2FBB90ECD7C248DFF513A42AB4FDDC8DB4150.

## Delta mínimo sobre 6356affe · token y consumidores separados

La traza nueva falló sobre 6356: Dashboard iniciaba dos GET y renovaba forzadamente. Se cambiaron únicamente dos comportamientos del cliente: getIdToken(true) pasa a getIdToken(), y budget(c) pasa a devolver sólo actividad Presupuestos. La API pública, cinco rutas, identidad/captura, validación, errores, deadlines y ausencia de fallback se conservan. No se agrega un modo combinado opt-in porque no hace falta para este montaje.

Source.dashboard: un GET actividad, un acceso al token SDK sin force y sin campo notices añadido. Source.notices: un GET avisos explícito, token sin force y normalización schema2/notices.complete/rows preservada. El puerto tipado budget tiene exactamente la misma lectura independiente de actividad. El host debe usar Aggregate.create({...,requireNotices:false}); la prueba de composición lo verifica, no solicita avisos y no declara consumidores/centro global completos.

Evidencia del delta: 60 focales y dos HTTP loopback PASS, cero FAIL/SKIP. Logs privados dashboard-http-separated-red.private.log, dashboard-http-separated-focal.private.log y dashboard-http-separated-loopback.private.log. No se repitió la general ni se modificó host/root/app/index/endpoints/fixture mensual o permisos.

SHA256 delta: rojo EA19BC5CCE4188545AE4E472FE2A826A712DC72E387251670D9831CA5E50A119; focal FD70E9832ABBFB438F47437105884440DD34A56680CBE3A7C54A08FADEAABBF8; loopback 770AB598451FFC16C805676986972FABACB909E9D9F990DCB6D3346D2DD3532A.
