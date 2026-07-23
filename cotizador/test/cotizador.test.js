const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const cargarOriginal = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'playwright') return { chromium:{} };
  if (request === 'firebase-admin') {
    return {
      apps:[{}],
      initializeApp:function(){},
      credential:{ applicationDefault:function(){ return {}; } },
      database:function(){ return { ref:function(){ return {}; } }; }
    };
  }
  return cargarOriginal.call(this, request, parent, isMain);
};
const {
  parsePrecioArs,
  extraerPrecioBiosegur,
  extraerPrecioEtiquetado,
  validarIdentidadProducto,
  validarMonedaPrecio,
  validarSaltoPrecio
} = require('../index');
Module._load = cargarOriginal;

test('interpreta formato argentino sin multiplicar por dólar', () => {
  assert.equal(parsePrecioArs('$ 4.933,50'), 4933.5);
  assert.equal(parsePrecioArs('$ 107.071,90'), 107071.9);
});

test('Biosegur sólo acepta el precio principal o etiquetado', () => {
  assert.equal(extraerPrecioBiosegur('Balun P401\n$ 4.933,50\n+ IVA 21%'), 4933.5);
  assert.equal(extraerPrecioBiosegur('USD referencia $ 1.500\nCuotas $ 20.000'), 0);
});

test('otros proveedores requieren una etiqueta de precio inequívoca', () => {
  assert.equal(extraerPrecioEtiquetado('Precio mayorista: $ 83.660,20\nOtros datos'), 83660.2);
  assert.equal(extraerPrecioEtiquetado('Envío $ 8.000\nSaldo $ 5.000'), 0);
});

test('la identidad acepta el mismo modelo y rechaza otro producto', () => {
  assert.equal(validarIdentidadProducto(
    'BALUN HD HIKVISION 1H18S/E - PAR',
    'Balun Hd Hikvision 1H18S/E - 100% Cobre Alta Performance - Par'
  ).ok, true);
  assert.equal(validarIdentidadProducto(
    'BALUN HD HIKVISION 1H18S/E - PAR',
    'Fuente switching Dahua 12V 2A'
  ).ok, false);
});

test('rechaza moneda USD aunque el importe tenga símbolo peso', () => {
  assert.equal(validarMonedaPrecio('$ 90,00', 'USD').ok, false);
  assert.equal(validarMonedaPrecio('Precio US$ 90,00', '').ok, false);
  assert.equal(validarMonedaPrecio('$ 90.000,00', 'ARS').ok, true);
});

test('el salto extremo queda bloqueado como última barrera', () => {
  assert.equal(validarSaltoPrecio(110000, 100000).ok, true);
  assert.equal(validarSaltoPrecio(500000, 100000).ok, false);
  assert.equal(validarSaltoPrecio(10000, 100000).ok, false);
});
