# Últimas cinco personales por la ruta existente

Hunks contra root limpio `b9a4416d1b7673e928424aca710e828fd80e0385`. Aplicar `docs/patches/creator-latest-activity-transport.patch` y copiar `test/dashboard-sales-creator-latest-transport.test.cjs`. No importar el historial completo de la rama delegada. No modifica modelos Pages/helper, app, índice, endpoints, reglas, configuración remota ni originales.

## Contrato e integración

El lector actual de actividad ventas llama a `CreatorLatest.readLatest` con el alcance autorizado, creador fresco y mes del calendario ya verificado. `locale` viene de la cobertura de actividad y `expectedLocale` del contexto configurado capturado; ambos ya se contrastan entre sí en el lector. No se usa el locale por defecto de Node.

Conserva B0/B1 de autoridad, permisos, identidad/nombre, calendario, Pages config/cobertura y actividad. Adicionalmente registra hashes de todas las lecturas del helper y vuelve a verificar grupo mensual, total y filas seleccionadas. Un cambio del grupo o de una fila sin cambio de cobertura retira sólo la capacidad latest; un cambio de autoridad/cobertura conserva el rechazo global existente. Cada intento explícito lee de nuevo, sin caché de resultados ni fallback a originales.

La respuesta existente `ventas/actividad-v2` añade `creatorLatest`:

```js
{
  schema: 1, complete: true, creator, month, scope,
  generation, revision, locale, orderContract, count,
  rows: [{key, number, client, clientRecordKey, rawDate, totalCents}]
}
```

Las seis propiedades de cada fila son una proyección explícita. No se devuelve la fila Pages completa, notas, CAE, `creatorOrder`, hash del creador, referencias ni evidencia interna. `rawDate` conserva la fecha original; `totalCents` conserva precisión. Las anuladas siguen el helper mensual existente. `count` es el tamaño mensual certificado, no la cantidad de filas del DTO.

El contrato de orden de la entrega 90 se conserva literalmente:

`raw-locale-desc_loader-time-desc_ts-desc_js-index-first-asc_other-codepoint-asc_v1`

Ordena fecha raw descendente según locale explícito; empate por fecha de cargador descendente, timestamp descendente y clave estable (índices JS primero ascendentes y otras claves por punto Unicode). El último desempate es deliberado: no se afirma equivalencia con orden histórico de inserción para empates completos.

Si falta evidencia, falla una lectura opcional o el locale no está soportado, devuelve `{schema:1,complete:false}`, sin filas. El contador y las cinco de actividad global siguen disponibles según sus propias pruebas; no se presentan éstas como personales. El grupo vacío certificado sí devuelve `complete:true`, `count:0`, `rows:[]`.

## Consumidores existentes

- HTTP valida identidad padre y todos los campos del DTO frente a creador/mes/locale/alcance capturados, contrato de orden exacto, cardinalidad, claves, seis campos por fila y duplicados. Un DTO inválido se retira sólo como capacidad latest.
- El agregado expone `salesAuthorLatest` y `salesAuthorLatestComplete`. Reutiliza la segunda llamada ventas que ya verificaba el contador y certifica ambos DTO por separado contra B0/B1 y el sello de actividad. Si sólo latest está disponible, esa misma segunda llamada la verifica. No crea un tercer GET. Un cambio de latest no retira un contador estable.
- El mismo `dashboard-activity-host.v1.js`, modo `ownMonthly`, propaga esos campos desde su única respuesta ventas validada por servidor/HTTP. Conserva un GET, deduplicación, retiro por cambio de contexto, errores y reintentos explícitos. No cambia a Aggregate ni consulta otros dominios.
- Los modos anteriores y la optimización mensual embebida se conservan: sin capacidades personales, 5 llamadas del agregado con mensual embebido y 7 con puerto mensual separado; con capacidad personal completa, una llamada ventas adicional ya compartida por contador/latest. `dashboardComplete` continúa `false`: root monta y verifica UI.

## Verificación y límites

Snapshot privado de b9 más cuatro archivos parcheados; pruebas nuevas mediante `SV_CREATOR_LATEST_TRANSPORT_SOURCE`. Comando focal:

```powershell
node --test test/dashboard-sales-creator-latest-transport.test.cjs test/commercial-creator-latest.test.cjs test/dashboard-commercial-activity-proposal.test.cjs test/dashboard-commercial-activity-snapshot-races.test.cjs test/dashboard-activity-host.test.cjs test/dashboard-activity-own-monthly-host.test.cjs test/dashboard-aggregate-month-independent.test.cjs test/dashboard-aggregate-embedded-month.test.cjs
```

Resultado final: **138 PASS, 0 FAIL, 0 SKIP**, con 12 pruebas nuevas. Incluye 60/501 miembros, 10 ventas recientes de otro creador, anuladas, vacío certificado, privacidad, actor/permisos/calendario/cobertura concurrentes, grupo cambiado a igual revisión, fila corrupta, fallo/reintento de lectura y el mismo host real ownMonthly. El recorrido de 501 llega del preparador/lector real a HTTP y Aggregate; el fetch es simulado, no una prueba de red o Cloud Run. Log privado: `tmp/sdk-proof/creator-latest-green.log`.

La regresión ampliada original dio 158 PASS / 3 FAIL / 0 SKIP sobre 161 casos, antes de agregar el caso de vacío. Los tres fallos se reprodujeron sin ninguno de los cuatro hunks sobre b9 (52 PASS / 3 FAIL): expectativas anteriores de puerto mensual separado y 7 frente a 5 llamadas. En particular, `dashboard-http-ports-proposal.test.cjs` esperaba 7 llamadas y obtuvo 5 también sin los hunks. No se modificaron pruebas ni expectativas para ocultarlos; root coordina la adaptación de los fixtures de puerto separado. Logs privados: `tmp/sdk-proof/creator-latest-transport-focused.log` y `creator-latest-b9-baseline.log`. La selección vigente incluye `dashboard-aggregate-embedded-month.test.cjs`.

Costo: lee el grupo completo creador/mes, incluso con 501 miembros; no se afirma tamaño constante en bytes. Devuelve y consulta a lo sumo cinco filas Pages seleccionadas, que se releen para verificar estabilidad (hasta diez lecturas puntuales). El grupo se lee dos veces; header/total también se verifican. No hay lecturas de raíces originales ni reconstrucción automática. No se ejecutó puerta general, navegador, datos reales ni despliegue.
