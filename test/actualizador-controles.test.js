const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.312.js', 'utf8');

test('el actualizador ofrece detener y mostrar resultados durante el análisis', () => {
  assert.match(app, /function detenerActualizadorMasivoPrecios\(\)/);
  assert.match(app, /btn-detener-actualizador/);
  assert.match(app, /Detener análisis/);
  assert.match(app, /Los resultados aparecerán aquí mientras se analiza/);
  assert.match(app, /id="actualizador-precios-fallos" style="display:block/);
  assert.match(app, /modal\._abortController\.abort\(\)/);
});

test('los resultados parciales y los ya recibidos al detenerse se conservan para revisión', () => {
  assert.match(app, /Resultados parciales — todavía no se guardó nada/);
  assert.match(app, /Resultados detenidos — todavía no se guardó nada/);
  assert.match(app, /actualizadorItemsSesionParaTipos\(_actualizadorSesionPrecios\.fallos/);
});

test('los resultados parciales permiten aplicar los precios ya verificados', () => {
  const inicio = app.indexOf('function mostrarResultadosActualizador');
  const fin = app.indexOf('async function detenerActualizadorMasivoPrecios', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const funcion = app.slice(inicio, fin);
  assert.match(funcion, /Aplicar ' \+ candidatos\.length \+ ' verificado/);
  assert.match(funcion, /aplicarVistaPreviaActualizador\(\)/);
  assert.match(funcion, /modal\.dataset\.ejecutando === '1'/);
});

test('eliminar un producto depura la sesión y vuelve a pintar la revisión', () => {
  const inicio = app.indexOf('async function eliminarProductoFallidoActualizador');
  const fin = app.indexOf('// Conserva el avance mientras la pagina', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const funcion = app.slice(inicio, fin);
  assert.match(funcion, /_actualizadorSesionPrecios\.fallos/);
  assert.match(funcion, /mostrarVistaPreviaActualizador\(/);
  assert.match(funcion, /Producto eliminado del catálogo y de esta revisión/);
});

test('detener análisis queda junto a las acciones inferiores del proceso', () => {
  const apertura = app.indexOf('function abrirActualizadorMasivoPrecios');
  const inicio = app.indexOf("overlay.innerHTML =", apertura);
  const fin = app.indexOf("document.body.appendChild(overlay)", inicio);
  const modal = app.slice(inicio, fin);
  assert.equal((modal.match(/id=\"btn-detener-actualizador\"/g) || []).length, 1);
  assert.doesNotMatch(modal, /btn-resultados-actualizador/);
  assert.match(modal, /btn-detener-actualizador[\s\S]{0,600}Minimizar/);
});

test('el panel conserva su altura y el producto actual no crece con nombres largos', () => {
  const apertura = app.indexOf('function abrirActualizadorMasivoPrecios');
  const inicio = app.indexOf('overlay.innerHTML =', apertura);
  const fin = app.indexOf('document.body.appendChild(overlay)', inicio);
  const modal = app.slice(inicio, fin);
  assert.match(modal, /height:min\(680px,calc\(100vh - 32px\)\)/);
  assert.match(modal, /id="actualizador-precios-producto" style="height:48px;box-sizing:border-box;overflow:hidden/);
});

test('la ventana abierta del actualizador se puede arrastrar sin afectar sus controles', () => {
  assert.match(app, /function iniciarArrastrePanelActualizador\(evento\)/);
  const inicio = app.indexOf('function iniciarArrastrePanelActualizador');
  const fin = app.indexOf('function editarProductoFallidoActualizador', inicio);
  const funcion = app.slice(inicio, fin);
  assert.match(funcion, /closest\('button,a,input,select,textarea,label'\)/);
  assert.match(funcion, /panel\.style\.position = 'fixed'/);
  assert.match(funcion, /Math\.max\(8, window\.innerWidth - rect\.width - 8\)/);
  assert.match(app, /onpointerdown="iniciarArrastrePanelActualizador\(event\)"/);
});

test('los resultados seguros se guardan por bloque y el cambio de nombre se reintenta al instante', () => {
  assert.match(app, /async function guardarCandidatosSegurosActualizador/);
  assert.match(app, /await guardarCandidatosSegurosActualizador\(candidatosBloque\)/);
  assert.match(app, /await reintentarProductoConNombreCorregidoActualizador\(fbKey\)/);
  assert.match(app, /await guardarCandidatosSegurosActualizador\(\[candidato\]\)/);
  assert.match(app, /Cambiar nombre/);
  assert.doesNotMatch(app.slice(app.indexOf('function actualizadorHtmlFallos'), app.indexOf('function mostrarVistaPreviaActualizador')), /Abrir proveedor/);
});

test('los productos inexistentes se distinguen y pueden eliminarse en una sola acción', () => {
  assert.match(app, /function eliminarProductosNoDisponiblesActualizador/);
  assert.match(app, /data-actualizador-no-disponible/);
  assert.match(app, /Ya no existen en el proveedor/);
  assert.match(app, /Eliminar seleccionados/);
  assert.match(app, /FB_PATHS\.productos\), updates/);
});

test('eliminar sincroniza de inmediato los KPI y contadores del actualizador', () => {
  assert.match(app, /function sincronizarActualizadorTrasEliminarProductos\(ids, modal\)/);
  assert.match(app, /delete prodData\[clave\]/);
  assert.match(app, /actualizadorRefrescarResumen\(modal\)/);
  assert.match(app, /actualizarResumenActualizadorEnSegundoPlano\(\)/);
  assert.match(app, /sincronizarActualizadorTrasEliminarProductos\(\[fbKey\], modalActualizador\)/);
  assert.match(app, /sincronizarActualizadorTrasEliminarProductos\(ids, modal\)/);
});

test('los contadores de resultados se recalculan al resolver un fallo manualmente', () => {
  assert.match(app, /function actualizadorSincronizarContadoresResultados\(modal\)/);
  assert.match(app, /actualizador-precios-fallidos-contador/);
  assert.match(app, /actualizador-precios-exitosos/);
  const inicio = app.indexOf('function mostrarVistaPreviaActualizador');
  const fin = app.indexOf('async function aplicarVistaPreviaActualizador', inicio);
  assert.match(app.slice(inicio, fin), /actualizadorSincronizarContadoresResultados\(modal\)/);
  assert.match(app, /precio.*guardado.*automáticamente/);
});

test('corregir un nombre bloquea la fila y muestra que la verificación está en curso', () => {
  assert.match(app, /function actualizadorMarcarProductoVerificando\(fbKey, verificando\)/);
  assert.match(app, /_actualizadorSesionPrecios\.verificando\[fbKey\] = true/);
  assert.match(app, /data-actualizador-accion/);
  assert.match(app, /data-actualizador-estado/);
  assert.match(app, /Verificando nombre y precio\. Esperá/);
  assert.match(app, /finally \{\s*delete _actualizadorSesionPrecios\.verificando\[fbKey\]/);
});

test('un nombre detectado por el proveedor se puede aplicar sin volver a escribirlo', () => {
  assert.match(app, /async function cambiarNombreProductoFallidoActualizador\(fbKey, nombreSugerido\)/);
  assert.match(app, /var nombre = String\(nombreSugerido \|\| ''\)\.trim\(\)/);
  assert.match(app, /nombreProveedor:String\(\(resultado && resultado\.tituloProveedor\) \|\| ''\)\.trim\(\)/);
  assert.match(app, /Nombre encontrado en el proveedor/);
  assert.match(app, /Usar nombre encontrado/);
  assert.match(app, /this\.dataset\.nombreSugerido/);
});

test('cambiar un proveedor no reconstruye el tablero completo en el mismo clic', () => {
  const inicio = app.indexOf('function configurarProveedorActualizador');
  const fin = app.indexOf('function proveedoresSeleccionadosActualizador', inicio);
  assert.ok(inicio >= 0 && fin > inicio);
  const configurador = app.slice(inicio, fin);
  assert.doesNotMatch(configurador, /renderModuloActualizadorPrecios\(\)/);
  assert.match(configurador, /requestAnimationFrame/);
  assert.match(configurador, /Selección guardada/);
});

test('tildar proveedores recompone los KPI desde la caché sin reiniciarlos', () => {
  assert.match(app, /function actualizadorPintarResumenDesdeCache\(cache, finalizado\)/);
  const inicio = app.indexOf('function configurarProveedorActualizador');
  const fin = app.indexOf('function proveedoresSeleccionadosActualizador', inicio);
  const configurador = app.slice(inicio, fin);
  assert.match(configurador, /_actualizadorResumenCache\.listo \|\| _actualizadorResumenCache\.enCurso/);
  assert.match(configurador, /actualizadorRecorrerCambioSeleccionCache\(_actualizadorResumenCache, seleccionAntes, seleccion\)/);
  const incremental = app.slice(app.indexOf('function iniciarResumenActualizadorIncremental'), app.indexOf('function renderModuloActualizadorPreciosAhora'));
  assert.doesNotMatch(incremental, /seleccion\[tipo\] === false/);
  assert.match(incremental, /cache\.enCurso = !finalizado/);
});

test('los KPI avanzan al recorrer los vínculos reales cambiados, no con una animación artificial', () => {
  assert.match(app, /function actualizadorRecorrerCambioSeleccionCache\(cache, seleccionAntes, seleccionDespues\)/);
  assert.match(app, /function actualizadorTotalesSeleccionCache\(cache, seleccion\)/);
  assert.match(app, /var limite = Math\.min\(indice \+ 12, cambios\.length\)/);
  assert.match(app, /setTimeout\(siguiente, 16\)/);
  assert.doesNotMatch(app, /function actualizadorAnimarKpi\(/);
  const inicio = app.indexOf('function configurarProveedorActualizador');
  const fin = app.indexOf('function proveedoresSeleccionadosActualizador', inicio);
  assert.match(app.slice(inicio, fin), /actualizadorRecorrerCambioSeleccionCache\(_actualizadorResumenCache, seleccionAntes, seleccion\)/);
});

test('la ventana chica recorre el mismo cambio real de proveedores antes de actualizar su lista', () => {
  assert.match(app, /function actualizadorRecorrerCambioSeleccionModal\(modal, cache, seleccionAntes, seleccionDespues\)/);
  assert.match(app, /var limite = Math\.min\(indice \+ 12, cambios\.length\)/);
  assert.match(app, /actualizadorRecorrerCambioSeleccionModal\(modal, _actualizadorResumenCache, seleccionAntes, seleccion\)/);
  assert.match(app, /var resumen = actualizadorRefrescarResumen\(modal\)/);
});

test('la revisión detallada del módulo se difiere hasta que el navegador está libre', () => {
  assert.match(app, /function renderModuloActualizadorPreciosAhora[\s\S]*renderDetallesActualizador/);
  assert.match(app, /function renderModuloActualizadorPreciosBasico/);
  assert.match(app, /function actualizarResumenActualizadorEnSegundoPlano/);
  assert.match(app, /function iniciarResumenActualizadorIncremental/);
  assert.match(app, /setTimeout\(actualizarResumenActualizadorEnSegundoPlano, 0\)/);
  assert.match(app, /var limite = Math\.min\(indice \+ 15, productos\.length\)/);
  assert.match(app, /setTimeout\(siguiente, 16\)/);
  assert.match(app, /La revisión detallada se abre a demanda/);
});
