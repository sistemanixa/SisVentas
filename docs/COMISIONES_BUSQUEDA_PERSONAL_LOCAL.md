# Búsqueda de comisiones personales · entrega local

Base: `05be68ac4cbc92feb0318b849449d80bb4a48a9e`. Worktree aislado `personal-commission-search`, rama `codex/personal-commission-search`.

## Defecto y alcance

Los controles `com-f-buscar` y `com-f-estado` existen fuera del botón `admin-only` y permanecen visibles en la vista personal. Se comprobó con HTML de index, CSS app, action-permissions y commissions reales en Chromium aislado, roles técnico/administrativo y anchos 390/1280. No se abrió la aplicación del titular ni se conectó Firebase.

`renderPersonalCommissionList` ignoraba ambos controles. Ahora filtra después de `itemsDetalleSeguro`: conserva el alcance del empleado propio o la gestión delegada ya autorizada. Busca únicamente identificador seguro de venta y cliente; el nombre del empleado participa sólo cuando esa columna ya es visible al gestor delegado. No busca descripciones financieras crudas, porcentajes ni ganancias. El estado reutiliza la misma función de coincidencia que la vista administrativa, aplicada a cada participación personal.

El render continúa usando las columnas seguras y el monto persistido. No modifica registros, cálculos, aprobaciones, pagos ni distribución. Los KPI personales siguen enmascarados. No añade HTTP por tecla ni amplía la fuente/historia descargada. Un filtro sin coincidencias tiene mensaje específico; los errores y la espera de fuente conservan prioridad.

## Evidencia

- Nueve pruebas nuevas ejecutadas contra las funciones de la base sin parche: 0 PASS / 9 FAIL. Fuente de base tomada con git show y sustituida sólo en memoria del harness.
- Mismas nueve pruebas con el parche: 9 PASS / 0 FAIL. Cubren técnico, vendedor, administrativo, gestor delegado, Ver como, estados, caption histórico, otro empleado, texto financiero como oráculo, actualización de datos, error de fuente, limpieza de sesión e importes originales.
- Focal conjunto con privacidad, lectura pasiva, retornos, concurrencia y KPI: 82 PASS / 0 FAIL / 0 SKIP.
- Chromium aislado: 4 PASS / 0 FAIL, controles visibles e interacción real de texto/estado en 390/1280 para técnico/administrativo. Red bloqueada; sólo fixtures ficticios. Ejecutar con Playwright disponible y `SV_CHROME_PATH` si hace falta seleccionar un navegador instalado: `node --test test/personal-commission-search.integration.cjs`.
- `node --check` del módulo y ambos tests; `git diff --check` sin errores.
- Suite vigente sobre fuente funcional final, Node 22.23.4: 9.539 casos / 9.507 PASS / 1 FAIL / 31 SKIP / exit 1. Único fallo: `ot-detail-opening-native.test.cjs`, «OT previa queda oculta e inert durante 300ms de lectura 390», esperaba `old` y obtuvo `null`. Se conservó el fallo sin cambiar OT ni expectativas. Repetición aislada del archivo: 12 PASS / 0 FAIL / 0 SKIP / exit 0. Esto no convierte retroactivamente la suite en verde ni demuestra ausencia de intermitencia. El coordinador debe considerar este resultado al validar el paquete integrado. La ejecución inicial restringida se interrumpió por bloqueos de loopback (`ERR_NETWORK_ACCESS_DENIED`).

Logs locales excluidos de Git en `tmp/personal-commission-search/`: baseline-red.log, focal-final.log, current-gate.log (interrumpido), current-gate-final.log y ot-isolated-repeat.log. SHA256 del gate final: `56c995af26ab17c0c62016134abcacb12360e73d62d214489677133002f6bd69`.

## Límites e integración

No prueba cada formulario ni operaciones financieras. El navegador valida un fragmento real del módulo con datos ficticios; no certifica arranque autenticado, producción ni publicación. No se modificaron app inmutable, index, lectores, ownership, avisos de versión ni caches. El coordinador debe integrar el módulo y ajustar las referencias inmutables/cache-bust junto con CONTEXTO_ACTUAL. Sin push ni acción remota.
