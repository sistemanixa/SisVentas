const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('cuentas de empleados conserva dos decimales en KPIs y pagos', () => {
  assert.match(app, /function ctaEmpPesos\(valor\)/);
  assert.match(app, /minimumFractionDigits:2, maximumFractionDigits:2/);
  assert.match(app, /ctaemp-com-total'\)\.textContent = ctaEmpPesos\(totalGenerado\)/);
  assert.match(app, /ctaemp-haberes'\)\)\s+el\('ctaemp-haberes'\)\.textContent\s+= ctaEmpPesos\(totalPagadoMes\)/);
  assert.match(app, /ctaEmpPesos\(x\.monto\)/);
});
