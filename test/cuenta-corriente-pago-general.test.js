const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function sourceOfFunction(name) {
  const start = app.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'No se encontró ' + name);
  const firstBrace = app.indexOf('{', start);
  let depth = 0;
  for (let i = firstBrace; i < app.length; i++) {
    if (app[i] === '{') depth++;
    if (app[i] === '}' && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error('Función incompleta: ' + name);
}

test('el pago de cuenta se imputa primero a la venta más antigua y admite saldo parcial', () => {
  const sandbox = {
    window: { _ccNombreActual: 'Cliente', _ccClienteKeyActual: 'c1', _ccMapActual: { c1: { clienteFbKey: 'c1' } } },
    ventasList: [
      { fbKey:'v-nueva', id:'V-2', clienteFbKey:'c1', fecha:'20/08/2026', total:100, totalPagado:0 },
      { fbKey:'v-vieja', id:'V-1', clienteFbKey:'c1', fecha:'10/08/2026', total:80, totalPagado:0 }
    ],
    ventaValidaParaMetricas: () => true,
    _svSaldoPendienteVenta: venta => venta.total - venta.totalPagado,
    _svTxtNombre: valor => String(valor || '').toLowerCase(),
    Math, parseFloat, String
  };
  vm.runInNewContext(sourceOfFunction('_ccVentasPendientesActuales') + '\n' + sourceOfFunction('_ccPlanImputacion'), sandbox);
  const resultado = sandbox._ccPlanImputacion(110);
  assert.deepEqual(Array.from(resultado.plan, item => item.venta.id), ['V-1', 'V-2']);
  assert.equal(resultado.plan[0].monto, 80);
  assert.equal(resultado.plan[0].saldoRestante, 0);
  assert.equal(resultado.plan[1].monto, 30);
  assert.equal(resultado.plan[1].saldoRestante, 70);
  assert.equal(resultado.sinImputar, 0);
});

test('el guardado del pago general usa una transacción única y deja trazabilidad grupal', () => {
  const confirmar = sourceOfFunction('confirmarPagoCuentaCorriente');
  assert.match(confirmar, /fbRunTransaction\(window\.fbRef\(window\.fbDB, 'sisventas'\)/);
  assert.match(confirmar, /raiz\.cobros_cuenta\[grupo\] = cabecera/);
  assert.match(confirmar, /pagoCuentaGrupo:grupo/);
  assert.match(confirmar, /origen:'cuenta_corriente'/);
  assert.match(confirmar, /estado:nuevoPagado>=total-.01\?'pago_total':'seniado'/);
});
