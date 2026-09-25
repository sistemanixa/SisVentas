const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/app.v3.7.7.js', 'utf8');

function extract(name, next) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('\nfunction ' + next + '(', start);
  return source.slice(start, end);
}

test('Nissei compara contra el menor costo local aunque el stock local no esté verificado', () => {
  const context = {
    window: { TIPO_CAMBIO_CONFIG: { oficial: 1540 } },
    proveedoresData: [],
    costoRealProveedorProducto: pv => Number(pv.costoRealArs || pv.precio) || 0
  };
  vm.runInNewContext(extract('costoExteriorVigenteARS', 'precioVentaDesdeCostoUnitarioProducto'), context);
  vm.runInNewContext(extract('origenProveedorProducto', 'distintivoProveedorExterior'), context);
  vm.runInNewContext(extract('referenciaCostoLocalComparacion', 'enlaceUrlProveedorProducto'), context);

  const referencia = context.referenciaCostoLocalComparacion([
    { costo: 278602.50, proveedor: { nombre: 'BIOSEGUR', pais: 'Argentina', disponibilidadProveedor: 'no_verificado' } },
    { costo: 352594, proveedor: { nombre: 'MERCADO LIBRE', pais: 'Argentina', disponibilidadProveedor: 'sin_stock' } },
    { costo: 300938.26, proveedor: { nombre: 'NISSEI PARAGUAY', pais: 'Paraguay', disponibilidadProveedor: 'no_verificado' } }
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(referencia)), { confirmada: false, menor: 278602.50 });
  const html = context.mejoraCostoExteriorHTML(300938.26, referencia.menor, {
    precio: 300938.26,
    disponibilidadProveedor: 'no_verificado'
  }, referencia.confirmada);
  assert.match(html, /Mayor costo/);
  assert.match(html, /22\.335,76/);
  assert.match(html, /8\.0%/);
  assert.match(html, /stock local no confirmado/);
});
