const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appPath = path.join(root, 'js', 'app.v2.0.334.js');
const source = fs.readFileSync(appPath, 'utf8');

function cargarFuncionesIndice() {
  const inicio = source.indexOf('function _svTxtClave');
  const fin = source.indexOf('function _svPagosGlobalesVenta', inicio);
  assert.ok(inicio >= 0 && fin > inicio, 'debe encontrarse el bloque de relaciones de pagos');
  const context = {};
  vm.createContext(context);
  vm.runInContext(source.slice(inicio, fin), context);
  return context;
}

test('la búsqueda aplica mínimo de caracteres, debounce y estado visible', () => {
  assert.match(source, /texto\.length < 3/);
  assert.match(source, /setTimeout\(function\(\) \{[\s\S]*?\}, 300\);/);
  assert.match(source, /Mínimo 3 caracteres/);
  assert.match(source, /Buscando\.\.\./);
  assert.match(source, /resultado['"]? \+ \(total === 1/);
});

test('el índice devuelve los mismos pagos que la relación histórica', () => {
  const api = cargarFuncionesIndice();
  const ventas = Array.from({ length: 200 }, (_, i) => ({
    fbKey: `key-${i}`,
    id: `V-${1000 + i}`
  }));
  const pagos = [];
  ventas.forEach((venta, i) => {
    pagos.push(i % 2
      ? { ventaFbKey: venta.fbKey, monto: i + 1 }
      : { ventaId: venta.id, monto: i + 1 });
  });
  pagos.push({ ventaId: 'V-999999', monto: 1 });

  const indice = api._svCrearIndicePagosVentas(pagos);
  ventas.forEach((venta) => {
    const esperado = api._svPagosGlobalesRelacionadosVenta(venta, pagos);
    const obtenido = api._svPagosIndiceVenta(indice, venta);
    assert.equal(obtenido.length, esperado.length);
    assert.ok(esperado.every((pago) => obtenido.includes(pago)));
  });
});

test('el filtrado ocurre antes del orden y sólo calcula la pestaña activa', () => {
  const inicio = source.indexOf('function _aplicarFiltrosVentas()');
  const fin = source.indexOf('function _actualizarBannerFiltroVentas()', inicio);
  const bloque = source.slice(inicio, fin);
  assert.ok(bloque.indexOf('if (f.texto)') < bloque.indexOf('resultado.sort(function'), 'debe filtrar texto antes de ordenar');
  assert.doesNotMatch(bloque, /const mapasTab/);
  assert.match(bloque, /if \(f\.tab === 'cobrar'\)/);
  assert.match(bloque, /renderVentasTabla\(resultado\.slice\(inicio, fin\), estadoPagoVenta\)/);
});
