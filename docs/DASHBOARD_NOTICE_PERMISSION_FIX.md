# Centro de avisos independiente de revisarVencidos

Base2a0798a9d25c62bc8c6640c494520c32348695d0, checkout aislado; root intacto. El caso QA es real: changed(notices) delegaba únicamente en verificarVencimientosPptos, cuyo guard real exige presupuestos.revisarVencidos y puede salir sin generar el centro aunque Source ya tenga filas completas. Las cinco reproducciones previas conservan sus cuerpos; no cubrían ese guard porque su fixture lo reemplazaba por true.

Corrección de tres hunks en app activa: verificarVencimientosPptos devuelve true al completar la ruta que genera avisos; el callback de Source llama generarNotificaciones sólo si la revisión no llegó a esa ruta. No se modifica el guard, se amplían permisos ni se inicia red. Las autorizaciones propias del generador siguen aplicándose. Con permiso y sin permiso se genera una vez por entrega. No cambia badge/SHELL/versiones ni contratos remotos.

Regresión añade dos casos al archivo existente: función real _svSesionActivaParaVencimientos, Source real con entrega tardía de una fila de revisión autorizada, con/sin revisarVencidos. Verifica estado Source ready, fila generada, un render por entrega y sólo una lectura demandada. Baseline2a:1roja/6PASS; candidato7PASS (las cinco anteriores intactas). El fixture permite seleccionar kind=notices; sus cinco cuerpos se compararon byte a byte contra2a. El doble de callpoints devuelve ahora true al simular ruta completada; expectativas intactas.

50focalesPASS,0FAIL/SKIP; node check y diff check correctos. Logs privados tmp/notice-permission-{red,green}.private.log. Sin general, navegador, producción ni datos reales; QA conserva su reproducción browser para repetir tras integración. La revisión previa de error/retiro estaba limitada por el guard simulado, no certificaba esta combinación real de permisos.

Patch docs/patches/dashboard-notices-permission-over-2a.patch: sólo app y dos pruebas. Aplicar cuando root cierre su freeze; luego repetir QA browser real y focales. No declara publicación ni cierre completo.
