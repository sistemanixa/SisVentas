# Carrera de preparación inicial de OT · corrección aislada

Base del checkout: `93511fc9c7d9ece45616afafdec050f7f77492a5` (Comisiones entregado, sin modificar). Rama `codex/ot-opening-timing-review`. Alcance de producto: únicamente el bloque `ordentrabajo` de `showPage` en `js/app.v3.19.3.js`.

## Causa

La entrada al módulo agenda a 30 ms `_svPrepararVistaModulo(..., preparar)`. Su callback llama a `volverListaOT`, que pone `otActualId=null`, sin comprobar si después de agendarlo comenzó una apertura diferente. `verOT('next')` oculta/inertiza el detalle mientras espera el origen y conserva la identidad anterior hasta confirmar la nueva. Una preparación inicial que llega durante esa espera puede borrar esa identidad.

La prueba original deja 100 ms antes de reabrir `old`; esa espera no expresa una barrera de finalización de la preparación. No se cambió ni su tiempo de 300 ms ni su expectativa `old`. El log del gate original no tenía traza del callback; la reproducción controlada demuestra el cruce que produce exactamente `old -> null`, sin atribuir a una causa concreta del sistema operativo el momento del gate.

La nueva prueba conserva las funciones reales y retiene únicamente el callback de preparación para liberar el mismo código en dos órdenes. Antes del arreglo: 2 PASS / 2 FAIL. Orden sin cruce: PASS en 390/1280. Callback inicial liberado cuando la apertura siguiente espera: FAIL en ambos anchos, con `null !== old`. La traza sitúa el setter en `showPage` -> callback de entrada -> `volverListaOT`, línea base 11347.

## Cambio

Se captura el token de apertura de OT al agendar la preparación. El callback se descarta si cambió ese token, si la página ya no está activa o si la entrada es directa. Cuando no hubo apertura posterior, conserva la preparación normal de la lista. `volverListaOT` y `volverDesdeDetalleOT` no se modifican; el retorno explícito continúa operativo.

No se cambia el guard de sesión/permisos, el lector de origen, formularios ni operaciones financieras. No se editó Comisiones, index, versionado ni activos de integración. No se copió la app entera de otra rama: el diff de producto es sólo 7 líneas agregadas y 1 reemplazada en ese bloque. El coordinador integra el commit antes de crear su nueva app inmutable, conservando su delta ARCA.

## Validación

Node 22.23.4 y Chrome headless, HTTP sólo en loopback y backend ficticio:

`node --test test/ot-entry-timer-race.integration.cjs test/ot-detail-opening-native.test.cjs`

20 PASS / 0 FAIL / 0 SKIP / exit 0: las 12 pruebas originales sin alterar más ocho controladas. Incluye 390/1280, orden previo a apertura, callback tardío, entrada normal sin apertura posterior, retorno explícito y abandono de módulo. Cada sesión comprueba cero comandos/escrituras y estado ficticio original intacto. `node --check` de app y prueba, más `git diff --check`.

Evidencia local excluida de Git: `tmp/ot-timing/controlled-before.log` y `tmp/ot-timing/focal-after.log`. No se repitió gate global, no se tocó la ventana del titular ni datos reales, y no hubo push/publicación. Esto valida el flujo focal, no todos los formularios de OT ni la aceptación del paquete integrado.
