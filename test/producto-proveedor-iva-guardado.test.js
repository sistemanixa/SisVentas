const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('js/app.v3.3.15.js', 'utf8');
const inicio = app.indexOf('function completarReferenciaProveedorProducto(');
const fin = app.indexOf('\nfunction ', inicio + 1);
const contexto = vm.createContext({
  obtenerDolarReferenciaProducto: () => ({ valor: 1530, tipo: 'oficial' }),
  normalizarUrlProveedorProducto: valor => valor,
  factorIvaProveedorProducto: pv => pv.sinIva ? 1 + (pv.ivaAlicuota ?? 21) / 100 : 1
});
vm.runInContext(app.slice(inicio, fin), contexto);

test('proveedor cotizado sin alícuota puede persistirse sin undefined y conserva su costo', () => {
  const original = { nombre: 'FREE ELECTRON', precio: 115803.22, sinIva: false, ivaAlicuota: undefined };
  const resultado = contexto.completarReferenciaProveedorProducto(original, 'https://www.free-electron.com.ar/producto.html', 'cotizador');
  assert.equal(Object.hasOwn(resultado, 'ivaAlicuota'), false);
  assert.equal(resultado.costoRealArs, 115803.22);
  for (const valor of Object.values(resultado)) assert.notEqual(valor, undefined);
  assert.equal(Object.hasOwn(original, 'ivaAlicuota'), true);
});

test('normalizar proveedor preserva las alícuotas explícitas, incluida la tasa cero', () => {
  for (const tasa of [0, 10.5, 21, null]) {
    const resultado = contexto.completarReferenciaProveedorProducto({ nombre:'Proveedor', precio:1000, sinIva:true, ivaAlicuota:tasa }, 'https://proveedor.com/producto', 'cotizador');
    assert.equal(resultado.ivaAlicuota, tasa);
    assert.equal(resultado.costoRealArs, Math.round(1000 * (1 + (tasa ?? 21) / 100) * 100) / 100);
  }
});
