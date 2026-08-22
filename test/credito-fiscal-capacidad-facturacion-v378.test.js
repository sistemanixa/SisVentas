const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const inicio = app.indexOf('function calcularFacturaParaAgotarCreditoFiscal');
const fin = app.indexOf('\nfunction fvRenderCompensacion', inicio);
const contexto = { Math, Number, parseFloat };
vm.createContext(contexto);
vm.runInContext(app.slice(inicio, fin), contexto);

test('convierte el crédito disponible en factura final al 21%', () => {
  const r = contexto.calcularFacturaParaAgotarCreditoFiscal(21000, 21);
  assert.equal(r.neto, 100000);
  assert.equal(r.iva, 21000);
  assert.equal(r.total, 121000);
});

test('el KPI aparece solo con saldo a favor y explica neto más IVA', () => {
  assert.match(app, /creditoDisponible = Math\.max\(0, -c\.saldo\)/);
  assert.match(app, /Podés facturar hasta/);
  assert.match(app, /total final al 21% · neto/);
  assert.match(app, /var kpiCapacidad = aFavor/);
});
