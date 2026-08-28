const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.3.2.js'), 'utf8');

test('clientes agrupa una sola vez mediante índices reutilizables', () => {
  assert.match(app, /function reconstruirCacheClientes\(\)/);
  assert.match(app, /var lista = _clientesGruposCache\.slice\(\)/);
  assert.match(app, /var total\s+= _clientesGruposCache\.length/);
  assert.doesNotMatch(app, /function clienteRaizRegistro[\s\S]{0,900}\(clientesData \|\| \[\]\)\.find/);
});

test('clientes conserva la grilla al navegar a otro módulo', () => {
  assert.match(app, /if \(id !== 'productos'\) return;/);
  assert.doesNotMatch(app, /\['productos', 'clientes'\]\.indexOf\(id\)/);
  assert.match(app, /_clientesUltimoRenderVersion === _clientesCacheVersion/);
});

test('clientes pinta el estado de carga antes del trabajo pesado y difiere tareas secundarias', () => {
  assert.match(app, /function mostrarEstadoCargaClientes\(texto\)/);
  assert.match(app, /tbody\.setAttribute\('aria-busy', 'true'\)/);
  assert.match(app, /Podés seguir usando el sistema mientras se prepara la lista/);
  assert.match(app, /requestAnimationFrame\(function\(\) \{\s*\/\/ Un segundo cuadro/);
  assert.match(app, /requestIdleCallback\(completar, \{ timeout:700 \}\)/);
  assert.match(app, /requestIdleCallback\(tareasSecundariasClientes, \{ timeout:900 \}\)/);
});

test('el KPI de deuda indexa pagos una vez y no recorre todo el historial por venta', () => {
  assert.match(app, /var indicePagosCanonicos = _svCrearIndicePagosVentas\(listaPagos\)/);
  assert.match(app, /_svPagosIndiceVenta\(indicePagosCanonicos, venta\)\.filter\(_svPagoValido\)/);
  assert.doesNotMatch(app, /function montoPagado\(venta\) \{\s*var globalesCanonicos = _svPagosGlobalesVenta/);
  assert.match(app, /requestIdleCallback\(refrescarKpisClientes, \{ timeout:700 \}\)/);
});
