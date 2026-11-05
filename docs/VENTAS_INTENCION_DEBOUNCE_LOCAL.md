# Ventas: intención escrita durante el debounce · parche acotado

Base conjunta revisada: `fdd161713870a951542f47cab26e2445dc7af43d`. Rama aislada `codex/sales-search-intent-repaint`. La fuente conjunta y su puerta activa no se modifican. Sólo cambia funcionalmente `js/modules/sales-indexed-host.v1.js`; se conservan las URLs3.19.5. Sin builders, puerta global, backend, versión, SW, ventana8765, datos reales, push o publicación.

## Defecto confirmado

Con una página verificada y la consulta histórica A pendiente, escribir B cancela A y muestra coincidencias locales de B. Durante los120ms anteriores a confirmar B en `_filtrosVentas`, un consumidor puede repintar (por ejemplo `sortTabla` llama a `_aplicarFiltrosVentas`). `renderList` o `ensure` veía todavía A como filtro confirmado y arrancaba otra consulta A. Su respuesta podía sustituir el preview B y quitarle la etiqueta provisoria.

Reproducción inicial con host/reader reales en memoria: preview1 de `Cliente ficticio 0`; repintado antes de confirmar el texto; respuesta final20 de `Gerardo Toyos`,24 lecturas adicionales, importes sin cambios. Las tres pruebas nuevas iniciales dieron0PASS/3FAIL; antes de liberar las respuestas retenidas se observaron3 lecturas extra por repintado.

También se reprodujo en HTML/app3.19.5 reales: input nativo, sortTabla síncrono, microtasks antes del timer120ms sin reemplazarlo, backend ficticio340 ventas (320actuales/20históricas). Antes del parche, la misma prueba de navegador falla al encontrar GET nuevos de configuración/cobertura donde debe haber cero. No se relajan sus expectativas.

## Cambio mínimo

El preview conserva `inputText`. Antes de incrementar epoch o iniciar un lector, `load` compara esa intención con el texto confirmado y el valor visible del input. Si el input aún contiene B pero el filtro sigue en A, sólo repinta el preview; no hace IO ni modifica el cursor. Cuando el timer confirma B, la consulta normal puede continuar. La condición deja funcionar los cambios programáticos que ya actualizaron el input.

No se cambian el debounce nativo, reader, ownership, límites50, totales, cálculos económicos ni permisos. El repintado conserva su control de actor; un cambio de revisión de permisos retira el preview. Volver a una consulta ya verificada recupera su página sin una consulta histórica innecesaria.

## Validación

- Fuente anterior:0PASS/3FAIL en las pruebas iniciales de repintado/ensure/restauración; navegador0PASS/1FAIL por IO extra. Logs rojos conservados.
- Fuente corregida:46PASS/0FAIL/0SKIP combinando5 nuevos casos de intención,19 de retención y22 del reader. Incluyen cursor publicado de página2, vuelta a página1 sólo al confirmar la nueva búsqueda, totales sin relectura y retirada por cambio de permisos.
- Mismo navegador real:1PASS/0FAIL. El texto A queda confirmado mientras se escribe B; ordenar en ese momento produce0GET adicionales, conserva preview/foco/importes, no repite A y luego publica B. El estado ficticio del backend queda idéntico. SW bloqueado en el fixture: no certifica un upgrade ni una ventana de usuario.
- Syntax y diff checks del alcance. Sin nueva puerta global ni repetición de builders.

Logs privados ignorados de esta copia: `tmp/search-intent-red.private.log`, `tmp/search-intent-browser-red.private.log`, `tmp/search-intent-focal-final.private.log` y `tmp/search-intent-browser-green.private.log`.

## Revisión conjunta sólo lectura

La caché retenida de ownership proviene de respuestas completas HTTP y exige validación nueva200/304; no se llena desde la página50. El host conserva esa página por separado, y los totales provienen del resumen con actor/revisión/generación. Las lecturas tardías del reader comprueban contexto y época; el retorno completo comprueba también revisión de permisos, base/servicio y revocación concurrente. La optimización económica comparte sólo dentro de una llamada y no añade caché entre lecturas. Esta revisión no equivale a probar todos los circuitos financieros.

Se confirmó el contrato de espejo de `commission-generation.test.cjs:111` y `scripts/sync-commission-models.cjs`: el helper económico debe sincronizarse en la copia backend local antes del siguiente congelamiento. Ese paso y la materialización coherente de todos los inputs RAW pertenecen al coordinador; no se ejecutan desde esta rama. La puerta en fdd16171 conserva sus resultados propios y no se convierte en verde por este focal.
