const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync('js/app.v2.0.290.js', 'utf8');
const start = source.indexOf('function _cantidadItemVenta');
const end = source.indexOf('window.creditoHistoricoDisponible = creditoHistoricoDisponible;', start);
assert.notEqual(start, -1, 'helpers de crédito no encontrados');
assert.notEqual(end, -1, 'fin de helpers de crédito no encontrado');

const context = { Math, Object, String, Number, Array, parseFloat, parseInt, Error, Date, window: {} };
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

function raizBase() {
  return {
    ventas: {
      origen: {
        id: '#V-000100',
        items: [
          { cod: 'SEN-1', desc: 'Sensor cableado', qty: 10, punit: 100, disc: 10 },
          { cod: 'SIR-1', desc: 'Sirena', qty: 2, punit: 250, disc: 0 }
        ]
      }
    }
  };
}

function ventaCredito(key, creditos) {
  return { id: '#V-000200', fecha: '07/08/2026', ts: 1, items: [], creditosHistoricos: creditos, fbKey: key };
}

function credito(index, cantidad, precio = 90) {
  return { ventaOrigenKey: 'origen', ventaOrigenId: '#V-000100', itemOrigenIndex: index, productoCodigo: index ? 'SIR-1' : 'SEN-1', productoDescripcion: index ? 'Sirena' : 'Sensor cableado', cantidad, precioHistoricoUnitario: precio, importe: -(cantidad * precio) };
}

test('crédito total y trazabilidad bilateral', () => {
  const raiz = raizBase();
  const result = context._aplicarCreditosHistoricosEnRaiz(raiz, ventaCredito('destino', [credito(0, 10)]), 'destino');
  assert.equal(context.creditoHistoricoDisponible(result.ventas.origen, 0, 0), 0);
  assert.equal(Object.keys(result.ventas.origen.creditosEmitidos).length, 1);
  assert.equal(Object.keys(result.ventas.destino.creditosOrigen).length, 1);
  assert.equal(result.ventas.destino.creditosOrigen['destino__origen__0'].importe, -900);
});

test('crédito parcial y segundo crédito por el remanente', () => {
  const raiz = raizBase();
  context._aplicarCreditosHistoricosEnRaiz(raiz, ventaCredito('destino1', [credito(0, 3)]), 'destino1');
  assert.equal(context.creditoHistoricoDisponible(raiz.ventas.origen, 0, 0), 7);
  context._aplicarCreditosHistoricosEnRaiz(raiz, ventaCredito('destino2', [credito(0, 7)]), 'destino2');
  assert.equal(context.creditoHistoricoDisponible(raiz.ventas.origen, 0, 0), 0);
});

test('no permite exceder el disponible ni en dos operaciones concurrentes simuladas', () => {
  const raiz = raizBase();
  context._aplicarCreditosHistoricosEnRaiz(raiz, ventaCredito('destino1', [credito(0, 6)]), 'destino1');
  assert.throws(() => context._aplicarCreditosHistoricosEnRaiz(raiz, ventaCredito('destino2', [credito(0, 5)]), 'destino2'), /supera el remanente/);
  assert.equal(raiz.ventas.destino2, undefined);
});

test('admite varios productos origen en una venta destino', () => {
  const raiz = raizBase();
  context._aplicarCreditosHistoricosEnRaiz(raiz, ventaCredito('destino', [credito(0, 2), credito(1, 1, 250)]), 'destino');
  assert.equal(Object.keys(raiz.ventas.destino.creditosOrigen).length, 2);
  assert.equal(context.creditoHistoricoDisponible(raiz.ventas.origen, 0, 0), 8);
  assert.equal(context.creditoHistoricoDisponible(raiz.ventas.origen, 1, 0), 1);
});

test('retry con la misma venta destino es idempotente', () => {
  const raiz = raizBase();
  const venta = ventaCredito('destino', [credito(0, 4)]);
  context._aplicarCreditosHistoricosEnRaiz(raiz, venta, 'destino');
  context._aplicarCreditosHistoricosEnRaiz(raiz, venta, 'destino');
  assert.equal(context.creditoHistoricoDisponible(raiz.ventas.origen, 0, 0), 6);
  assert.equal(Object.keys(raiz.ventas.origen.creditosEmitidos).length, 1);
});

test('el valor histórico usa descuento original y participa como crédito neto sujeto al IVA de destino', () => {
  const item = { qty: 1, punit: 100, disc: 10 };
  assert.equal(context._precioHistoricoNetoUnitario(item), 90);
  const subtotalDestino = 1000 - 90;
  assert.equal(Math.round(subtotalDestino * 0.21), 191);
});

test('el editor guarda referencia de origen en el ítem y en la venta destino', () => {
  assert.match(source, /item\.creditoOrigen = \{/);
  assert.match(source, /nuevaVenta\.creditosHistoricos = nuevaVenta\.items/);
  assert.match(source, /destino\.creditosOrigen\[clave\] = vinculo/);
  assert.match(source, /origen\.creditosEmitidos\[clave\] = vinculo/);
});
