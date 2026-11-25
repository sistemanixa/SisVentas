# Montaje del host de comandos de Compras

```js
const host = require('./purchase-command-host').create({
  authorize, store, guard, cohort,
  numbering,                  // opcional: si falta crea Numbering genuino
  initialInventoryReference,  // opcional: si falta crea E desde ausencia B genuina
  orderDelete: purchaseDeleteService, // handler revisado existente; no sustituir
  enabled: false,
  queryPage: store.queryPage,
  now: Date.now
});
await host.capabilities(); // {version:1,installed,ready,generation,commands}
await host.readiness();    // lo anterior + missing interno, sin documentos/secretos
await host.handle(pathname, req, body);
```

17 rutas exactas, exportadas como routes/byPath inmutables, con maxBytes para que el dueño de index aplique los límites existentes. Manual, inventario, generación y trece acciones se componen mediante sus fábricas reales. Cancelar preparación conserva el nombre público listPreparationCancel y acción interna listCancelPreparation. Desconocidos/prototipos/aliases no se despachan. El host no agrega autenticación alternativa ni acepta fábricas, callbacks o autoridad desde body.

Las cinco referencias prospectivas se crean adentro con enum de propósito fijo; no se acepta un mapa externo de puertos de propósito desconocido. InitialInventoryReference opcional exige marca privada E. Numbering opcional exige marca privada de su módulo, enabled real y la misma mappedAdmission; no sirven métodos imitados ni serializados. Esto agrega Numbering.isAuthority sin alterar reserve/assertFresh/snapshot.

Requisitos de capability ready: cohorte nativa instalada y firmada, deps genuinas, Guard con clientAccounts/clientHistory/saleFinancialDependencies verdaderos, Operational activo y preparado, configuración remota de esas proyecciones y cobertura financiera válida, contador exacto de la misma generación/pins, config/fence OrderC preparados y sin inventario inválido. El dueño del Guard expone stockOrderProjections y operationalSummaries como booleanos readonly de su configuración REAL ya suministrada al constructor; no habilitar nada desde el host ni asignar true como parche. Sin esos flags el host queda no listo.

El cohort nativo es obligatorio para leer capacidad: ausencia de factory, error de red, installed desconocido o retorno mal formado rechazan; jamás se convierten en installed:false. Sólo el cohort nativo determina ausencia autoritativa OFF. Instalado queda sticky. No se devuelve missing por capabilities; se reserva para diagnóstico interno.

handle no repite el preflight remoto de capabilities antes de cada escritura: comprueba deps estáticas y deja a los comandos repetir admisión, fuentes, permisos, número y CAS bajo su lease real. Así evita duplicar consultas por el montaje. Config inválida o tardíamente revocada falla en el comando sin fallback SDK ni escritura parcial.

El borrado revisado existente se delega al handler nativo incluso con migración OFF, conservando su autorización/revisión/guard. Sólo una respuesta confirmada recibe operationId del body para el transporte compartido. No se reimplementa el borrado ni se amplía su revisión.

El principal conserva index/routing, lectura de body, cache/versiones, runtime/Guard/Store y publicación. El host no instala marcadores, no hace bootstrap, no activa Financial/History, no modifica Rules ni original comercial alguno. Las rutas y el cliente sólo deben anunciarse listos tras integrar los hooks y verificar emulador.

Pruebas de composición/readiness del host: 13 PASS con marcadores/autoridades E/B genuinos y guard de interfaz que no ejecuta transacciones. Comprueban configuración incompleta, falsificación de Numbering, errores de red/instalación, sticky installed, no duplicación de preflight y delegación del delete revisado. No se confunden con las pruebas previas de comandos+Guard/Store real; falta el montaje del principal para esa prueba final.
