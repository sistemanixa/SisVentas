const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('reportes incluye cobranza y productos con fuentes canónicas', () => {
  for (const id of ['rep-cobrado','rep-pendiente','rep-cobranza-pct','rep-unidades','rep-productos-tbody']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(app, /_svResumenPagoVentaDesdeLista\(v,pagosReporte\)/);
  assert.match(app, /_svTotalVentaCanonico\(v\)/);
  assert.match(app, /Responsable pendiente de asignación/);
});

test('confirmar venta exige y audita un responsable', () => {
  assert.match(app, /Seleccioná el responsable de la venta antes de confirmar/);
  assert.match(app, /empleadoUsuarioActual = typeof _hsexEmpleadoActual/);
  assert.match(app, /creadaPor: currentUser \|\| ''/);
  assert.match(app, /usuario: currentUser \|\| 'Sistema'/);
});
