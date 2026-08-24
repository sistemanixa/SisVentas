const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js','utf8');

test('el comprobante uniforma fechas como dd-mm-aaaa', () => {
  const inicio = app.indexOf('function formatearFechaComprobante(');
  const fin = app.indexOf('\n}', inicio) + 2;
  const ctx = {}; vm.createContext(ctx); vm.runInContext(app.slice(inicio, fin), ctx);
  assert.equal(ctx.formatearFechaComprobante('2026-09-03'), '03-09-2026');
  assert.equal(ctx.formatearFechaComprobante('24/8/2026'), '24-08-2026');
  assert.match(app, /var fecha = formatearFechaComprobante\(modelo\.fecha\)/);
  assert.match(app, /var venc = formatearFechaComprobante\(modelo\.vence\)/);
});

test('la ventana usa el alto disponible y mantiene desplazamiento', () => {
  assert.match(app, /screen\.availHeight/);
  assert.match(app, /resizable=yes,scrollbars=yes/);
});

test('imprimir descargar y compartir son acciones independientes', () => {
  assert.match(app, /> Imprimir<\/button>/);
  assert.match(app, /> Descargar PDF<\/button>/);
  assert.match(app, /> Compartir PDF<\/button>/);
  assert.match(app, /navigator\.canShare\(\{files:\[archivo\]\}\)/);
  assert.match(app, /a\.download=nombre/);
});

test('la ventana conserva un título descriptivo después de escribir el documento', () => {
  assert.match(app, /tituloVentanaPpto = 'SisVentas · NIXA — Presupuesto ' \+ num/);
  assert.match(app, /w\.document\.title = tituloVentanaPpto/);
});
