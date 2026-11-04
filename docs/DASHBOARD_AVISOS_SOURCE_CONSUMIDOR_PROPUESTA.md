# Consumidor de avisos de Source — aislado, flag OFF

Base del patch: `f23a5124`. No se editó root, su app ni su backend. Archivos de la entrega: nuevo `js/core/dashboard-budget-notice-consumer-proposal.js`, test propio y patch `docs/patches/dashboard-budget-notice-consumer.patch`.

## Instalación a coordinar con root

Cargar Legacy y el adaptador existentes antes del consumidor. La creación usa la misma captura y validación de la fuente, sin inventar épocas, usuarios ni permisos:

```js
window._svBudgetNoticeConsumerHost = SVDashboardBudgetNoticeConsumer.create({
  capture: captureBudgetContext,
  valid: isBudgetContextCurrent,
  source: budgetSource,
  enabled: () => window.SV_BUDGET_NOTICES_LOCAL === true
});
```

Los nombres captureBudgetContext/isBudgetContextCurrent/budgetSource representan los puertos existentes que root debe conectar. El consumidor viene deshabilitado si no se proporciona enabled. No modifica index/versiones/Service Worker ni instala el host automáticamente.

`peek()` sólo llama `source.peek('notices')` y al adaptador. Nunca ensure/refresh, fetch, SDK, reloj ni polling. La descarga corresponde al host por acción/evento. El flag estricto OFF conserva las funciones legacy y no consulta siquiera Source desde esos renderers. ON no usa pptoData, aunque contenga un array parcial, y no lo modifica.

El resultado conserva status/error/revalidating y añade rows/complete de la vista de candidatos. rows=null es desconocido, no un cero. Una fuente vacía certificada entrega [] y sí permite cero. Sólo se retiene un clon local de la entrega actual de Source, fijado a su secuencia y contexto, necesario para _alertado48h cuando falla localStorage. No es otra colección/caché global ni se persiste. La firma, epochs, User/auth/db, zona y grants deben seguir coincidiendo; un dato retirado de esa entrega no puede readaptarse como nuevo en el siguiente render. El snapshot/DTO original permanece intacto.

Una revalidación bajo la misma autoridad puede conservar las filas previas. Un error de red o SV_BUDGET_SDK_RETIRED por cambio de conexión conserva el clon ya validado y el error, sin declarar una lectura nueva ni readaptar usando una época de conexión inventada. Los metadatos de conexión sólo se exigen al adaptar entregas nuevas, mediante el adaptador existente que permanece intacto. 401/403, retiro de Source/autoridad, pérdida de permiso o cambio de sesión/dataEpoch no reutilizan ese dato. No hay fallback a legacy ni a otro transporte ante error. La selección de transporte continúa siendo previa y ajena al consumidor.

## Callpoints del patch

- generarNotificaciones selecciona localmente las filas de `host.peek()` con flag ON; conserva el resto del generador real, parser histórico, leyendas, IDs, horizonte y acciones canónicas fbKey ya integradas en f23.
- verificarVencimientosPptos alimenta sus dos filtros con la misma vista. Sin dato válido retira el contador anterior dejando texto vacío, nunca escribe cero, y actualiza los demás avisos. Los marcados usan sólo el clon adaptado y el almacenamiento local ya existente, sin escrituras comerciales.
- Readiness requiere dashboardBudgetNotices para el centro sólo cuando corresponde leer Presupuestos. Incluye el centro en el renderer de Readiness sólo con flag ON y proyecta el estado/error del consumidor en esa fuente ya existente, sin crear handles, marcar ready, invalidar Source ni iniciar cargas. Incluso un candidato mal formado que el productor hubiera marcado ready se presenta como error/incompleto. Con filas previas válidas no agrega missing sólo por un error: conserva ready anterior y muestra el error inline, sin sv-data-pending que oculte la página. Sin dato válido o con fallo de decoder sí conserva missing. El mensaje visible es el texto breve existente, sin datos internos del error.

La consulta del consumidor desde Readiness sigue siendo síncrona y de sólo lectura; no reemplaza ni completa la colección presupuestos. El host puede renderizar al cambiar Source, pero ese callback no debe descargar desde el renderer. Los formularios/detalles siguen por el GET puntual ya implementado.

## Evidencia

`test/dashboard-budget-notice-consumer.test.cjs`: **18 PASS, 0 FAIL, 0 SKIP** contra la copia de f23 con el patch. Usa Source y Readiness reales y extrae las funciones completas reales del app actual. DOM, permisos, reloj, almacenamiento y lecturas del host son puertos ficticios: no equivale a prueba Chrome ni a autorización de servidor.

Casos: OFF estricto, global parcial/prohibido, paridad de revisión/aprobado/vencimientos/sin respuesta, números negativos y audit, rollover/año corto, horizontes 0/1/2/30, marcas sólo en clon, vacío certificado, pending/error sin dato, revalidación, 401/403, pérdida de permisos/validez, User/session/dataEpoch/firma, conexión, respuesta tardía y Source viejo, error de decodificación, error de red con snapshot anterior, Source listo→sólo cambia conexión→refresh SDK_RETIRED con el mismo clon/revisión y error, arranque frío sin conexión, retiro de autoridad tras ese error y renderer real de Readiness sin ocultar la página y con banner inline. El número de lecturas sólo aumenta cuando el test llama explícitamente al host; nunca por generarNotificaciones, vencimientos o Readiness.

Log privado: `tmp/sdk-proof/notice-consumer-connection-focus.log`. Reproducir con SV_BUDGET_CONSUMER_ROOT apuntando a la copia congelada con patch aplicado y `node --test test/dashboard-budget-notice-consumer.test.cjs`. Sin variable, el test usa las funciones activas y aplica las inyecciones equivalentes en memoria cuando el checkout aún no las tiene; no escribe su app. No se ejecutó puerta general, otro backend ni producción. Flag OFF hasta importación y QA conjunta de root.
