const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '..', 'js', 'app.v3.0.9.js'), 'utf8');

test('el KPI suma adelantos aprobados o pagados del período aunque aún no estén compensados', () => {
  assert.match(app, /function _ctaEmpTotalAdelantosRegistradosEnMes\(todosMovimientos, mes\)/);
  assert.match(app, /estado === 'aprobado' \|\| estado === 'pagado_parcial' \|\| estado === 'pagado'/);
  assert.match(app, /var totalAdelanto\s*= _ctaEmpTotalAdelantosRegistradosEnMes\(movsMesVisibles, mesActual\)/);
  assert.match(app, /registrados en el período/);
});
