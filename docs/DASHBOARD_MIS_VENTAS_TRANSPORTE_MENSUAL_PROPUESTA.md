# Mensual por creador a través de actividad existente

Entrega por hunks contra root `d5afe8ce98b731e5d1b176564d43f6eb51d86f16`, que ya contiene el modelo Pages de `c8e713c9`. No aplicar el commit completo del checkout delegado sobre root: usar `docs/patches/creator-month-activity-transport.patch` y copiar la prueba nueva. No cambia `commercial-pages-model.js`, app, índice, proyecciones, endpoints, reglas ni datos externos.

## Integración concreta

El parche modifica únicamente:

- `cotizador/dashboard-commercial-activity-reader-proposal.js`: constructor acepta `getAsOfDay`; para ventas lee `sv_commercial_pages/v1/totals/{scope}` en B0/B1, conserva pin de autoridad/nombre/permisos, reloj y contexto, y exige Pages actual, generación coincidente, revisión válida y ámbito certificado antes de `Pages.creatorMonthCount`. La revisión del DTO es la revisión de cobertura Pages que acota ese total; el total puede tener una revisión anterior legítima. Totales corruptos/legacy/ausentes dejan sólo esta capacidad incompleta. Una carrera de metadata o autoridad rechaza la lectura.
- `js/core/dashboard-http-ports-proposal.js`: valida el DTO opcional frente al creador/mes/alcance capturados; un DTO ausente/inválido no bloquea actividad ni se interpreta como cero.
- `js/core/dashboard-activity-aggregate-proposal.js`: si la primera respuesta trae capacidad completa, vuelve a llamar al puerto existente de ventas después del intervalo presupuestos/comercial. Exige igualdad del DTO Pages y del sello de actividad entre ambas respuestas. Discrepancias retiran sólo el mensual; retiro de autoridad/contexto rechaza todo. No hay llamada extra cuando falta la capacidad.

En el montaje existente `cotizador/index.js`, root debe agregar `getAsOfDay:dashboardAsOfDay` a la llamada ya existente `dashboardCommercialActivity=...createReader(...)`. Este archivo no fue editado por el delegado. La omisión del callback deja la capacidad incompleta de forma compatible. No se admite un mes ni creador enviado por query/body.

DTO completo, dentro de la respuesta actual `/commercial/dashboard/ventas/actividad-v2`:

```js
creatorMonthly: {
  schema: 1, complete: true,
  creator: actor.name, month: '2026-11', scope: 'all' /* o u_UID */,
  generation: pagesCoverage.generation, revision: pagesCoverage.revision,
  count: 501
}
```

Capacidad incompleta: `{schema:1, complete:false}`, sin `count`. El agregado entrega `salesAuthorMonthly:null`/`salesAuthorMonthlyComplete:false`; si B0/B1 certifica el DTO, expone ese DTO y `true`. `dashboardComplete` sigue `false`.

El creador sigue siendo el texto exacto de la identidad autorizada, contrastado con `employeeLabel` capturado en el cliente; no usa UID/owner como sustituto. `scope` limita la visibilidad autorizada existente y no cambia el filtro de creador. Si el rótulo legado del cliente no coincide con la identidad fresca, no se certifica el mensual. Se conserva el modelo ya revisado: prioridad de autoría real, mes raw, anuladas incluidas. No cambia las filas recientes.

## Validación reproducible

Prueba nueva: `test/dashboard-sales-creator-month-transport.test.cjs`. En root, con los hunks aplicados:

```powershell
node --test test/dashboard-sales-creator-month-transport.test.cjs test/dashboard-commercial-activity-proposal.test.cjs test/dashboard-commercial-activity-snapshot-races.test.cjs test/dashboard-http-ports-proposal.test.cjs test/dashboard-activity-aggregate-proposal.test.cjs test/dashboard-activity-aggregate-data-epoch.test.cjs
```

En el checkout delegado se ejecutó contra snapshot privado de root más esos hunks mediante `SV_CREATOR_TRANSPORT_SOURCE`. 90 PASS, 0 FAIL, 0 SKIP (10 nuevas + 80 existentes sin alterar). El caso integrado prepara Pages/actividad con fuentes ficticias completas y pasa el lector real por decodificación HTTP y agregado: 501 creadas por u, las cinco recientes creadas por v. El transporte HTTP de ese caso es un fetch simulado con resultados reales del lector; no es una prueba de red, Cloud Run ni navegador. Incluye permisos/nombre/mes/cobertura concurrentes, ausencia legacy, cardinalidad corrupta, cero certificado y ámbito propio/global. Log privado: `tmp/sdk-proof/creator-month-transport-focused.log`. Sin suite general ni producción.

Costo añadido: dos lecturas puntuales del total Pages del ámbito por lectura de actividad ventas. El agregado con capacidad completa hace una segunda llamada a la misma ruta existente (8 GET de su recorrido HTTP frente a 7 sin capacidad); cada llamada sigue consultando sólo cinco filas recientes. El total contiene el mapa derivado de creadores/meses del ámbito, no originales; su tamaño no se afirma constante en bytes.

## Pendiente: últimas cinco personales

El contador no aporta claves ni orden personal. El prefijo global/owner de cinco filas puede pertenecer enteramente a otro creador, como demuestra el fixture. No se puede filtrarlo para prometer las cinco personales.

Con los índices actuales, la lectura mínima correcta requeriría recorrer páginas **completas del ámbito autorizado**, con evidencia estable Pages/actividad B0/B1, obteniendo para cada candidato autoría exacta y fecha raw suficiente para reproducir el filtro mensual y el orden real del renderer. Hoy las filas públicas de actividad carecen de esa evidencia; `row.author`/fecha normalizada tampoco preservan el helper y el mes raw. Harían falta lecturas puntuales autorizadas de los originales candidatos o una ampliación explícitamente acordada de los DTO existentes. El orden personal legacy usa `fecha`, distinto del orden por instante de actividad: no basta detenerse cuando aparezcan cinco coincidencias en actividad. Sin un índice compatible, puede necesitarse todo el ámbito/mes para probar que no faltan anteriores en el orden personal. No se agregó ese recorrido ni una descarga completa implícita. Mantener la capacidad de últimas cinco personales pendiente.
