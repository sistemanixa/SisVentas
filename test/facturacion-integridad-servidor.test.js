const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'cloud-functions', 'emitir-factura', 'index.js'), 'utf8');

function cargarPreparador() {
  const inicioRedondeo = source.indexOf('function redondearDinero');
  const fin = source.indexOf('function setCors', inicioRedondeo);
  assert.ok(inicioRedondeo > 0 && fin > inicioRedondeo);
  return Function(source.slice(inicioRedondeo, fin) + '; return prepararDetalleFiscal;')();
}

test('servidor acepta únicamente un contrato fiscal que reproduce el total exacto', () => {
  const preparar = cargarPreparador();
  const resultado = preparar({
    totalFiscalEsperado: 2487029,
    items: [
      { cod: 'A', desc: 'Equipo', qty: 1, punit: 2487029, precioUnitarioSinIvaFiscal: 2055395.87 }
    ]
  });
  assert.equal(resultado.neto, 2055395.87);
  assert.equal(resultado.total, 2487029);
});

test('servidor bloquea antes de emitir si los renglones difieren de la venta', () => {
  const preparar = cargarPreparador();
  assert.throws(() => preparar({
    totalFiscalEsperado: 2487029,
    items: [{ cod: 'A', qty: 1, precioUnitarioSinIvaFiscal: 1788078.88 }]
  }), /Integridad fiscal/);
});
