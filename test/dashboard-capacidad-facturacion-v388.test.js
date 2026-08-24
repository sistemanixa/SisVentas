const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('Dashboard muestra capacidad de facturación con el mismo cálculo que Facturas', () => {
  const inicio = app.indexOf('function actualizarKpiIvaDashboard');
  const fin = app.indexOf('function renderDashMiCuenta', inicio);
  const cuerpo = app.slice(inicio, fin);
  assert.match(html, /<div class="m-label">Podés facturar hasta<\/div>/);
  assert.match(cuerpo, /calcularCompensacionIVA\(mesActual\)/);
  assert.match(cuerpo, /calcularFacturaParaAgotarCreditoFiscal\(creditoDisponible, 21\)/);
  assert.match(cuerpo, /ivaEl\.textContent[\s\S]*cfPesos\(capacidad\.total\)/);
  assert.match(cuerpo, /saldo a favor/);
  assert.match(cuerpo, /sin saldo a favor/);
  assert.match(cuerpo, /IVA a pagar/);
});
