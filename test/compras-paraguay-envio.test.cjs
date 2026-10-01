const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = require('./helpers/active-app').readActiveApp().source;
function funcion(nombre) {
  const inicio = app.indexOf('function ' + nombre + '(');
  const fin = app.indexOf('\nfunction ', inicio + 1);
  return app.slice(inicio, fin);
}
const ctx = vm.createContext({
  URL, window: { TIPO_CAMBIO_CONFIG: { oficial:1545 } },
  obtenerDolarReferenciaProducto: () => ({ valor:1545, tipo:'oficial' }),
  normalizarUrlProveedorProducto: valor => valor,
  factorIvaProveedorProducto: pv => pv.sinIva ? 1.21 : 1
});
for (const nombre of ['costoEnvioProveedorProducto', 'costoRealProveedorProducto', 'costoExteriorVigenteARS', 'completarReferenciaProveedorProducto']) vm.runInContext(funcion(nombre), ctx);
const base = { nombre:'COMPRAS PARAGUAY', url:'https://www.comprasparaguai.com.br/producto__5064641/', precio:922365, precioOriginal:597, monedaOriginal:'USD', conversion:{}, costoEnvioArs:10000 };

test('envío suma al costo, conserva precio web y persiste sin sumarse dos veces', () => {
  let pv = ctx.completarReferenciaProveedorProducto(base, '', 'consulta-url-exacta');
  assert.equal(pv.costoRealArs, 932365);
  assert.equal(pv.precio, 922365);
  assert.equal(pv.precioOriginal, 597);
  for (let i=0; i<3; i++) pv = ctx.completarReferenciaProveedorProducto(JSON.parse(JSON.stringify(pv)), '', 'consulta-url-exacta');
  assert.equal(pv.costoRealArs, 932365);
  assert.equal(pv.costoEnvioArs, 10000);
  assert.equal(ctx.costoRealProveedorProducto(pv), 932365);
});

test('actualizar precio o retirar envío recalcula sin perder la referencia USD', () => {
  let pv = ctx.completarReferenciaProveedorProducto({...base, precio:927000, precioOriginal:600}, '', 'consulta-url-exacta');
  assert.equal(pv.costoRealArs, 937000);
  pv = ctx.completarReferenciaProveedorProducto({...pv, costoEnvioArs:0}, '', 'consulta-url-exacta');
  assert.equal(pv.costoRealArs, 927000);
  assert.equal(pv.precioOriginal, 600);
});

test('comparación exterior suma envío con dólar vigente', () => {
  ctx.window.TIPO_CAMBIO_CONFIG.oficial = 1600;
  assert.equal(ctx.costoExteriorVigenteARS(base), 965200);
  ctx.window.TIPO_CAMBIO_CONFIG.oficial = 1545;
});

test('envío no agrega IVA adicional y no afecta otros proveedores ni hosts similares', () => {
  assert.equal(ctx.completarReferenciaProveedorProducto({...base, precio:1000, sinIva:true}, '', 'consulta-url-exacta').costoRealArs, 11210);
  for (const url of ['https://flytec.com.py/producto', 'https://comprasparaguai.com.br.ejemplo.com/producto']) {
    assert.equal(ctx.completarReferenciaProveedorProducto({...base, url}, '', 'consulta-url-exacta').costoRealArs, 922365);
  }
  for (const costoEnvioArs of [-1, Infinity, NaN]) assert.equal(ctx.costoEnvioProveedorProducto({...base, costoEnvioArs}), 0);
});
