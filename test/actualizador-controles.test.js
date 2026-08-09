const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.312.js', 'utf8');

test('el actualizador ofrece detener y mostrar resultados durante el análisis', () => {
  assert.match(app, /function detenerActualizadorMasivoPrecios\(\)/);
  assert.match(app, /btn-detener-actualizador/);
  assert.match(app, /Detener análisis/);
  assert.match(app, /btn-resultados-actualizador/);
  assert.match(app, /Mostrar resultados/);
  assert.match(app, /modal\._abortController\.abort\(\)/);
});

test('los resultados parciales y los ya recibidos al detenerse se conservan para revisión', () => {
  assert.match(app, /Resultados parciales — todavía no se guardó nada/);
  assert.match(app, /Resultados detenidos — todavía no se guardó nada/);
  assert.match(app, /actualizadorItemsSesionParaTipos\(_actualizadorSesionPrecios\.fallos/);
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

test('la revisión detallada del módulo se difiere hasta que el navegador está libre', () => {
  assert.match(app, /function renderModuloActualizadorPreciosAhora[\s\S]*renderDetallesActualizador/);
  assert.match(app, /requestIdleCallback\(renderDetallesActualizador, \{ timeout:1500 \}\)/);
  assert.match(app, /requestIdleCallback\(calcularResumen, \{ timeout:2000 \}\)/);
});
