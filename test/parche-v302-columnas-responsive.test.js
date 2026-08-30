const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.v3.0.6.js'), 'utf8');
const tables = fs.readFileSync(path.join(root, 'js', 'modules', 'resizable-tables.js'), 'utf8');

test('revisión de productos usa una tabla configurable con acceso al organizador', () => {
  assert.match(app, /id="revision-precios-tabla" data-sv-column-key="revision-precios-productos-v2"/);
  assert.match(app, /openColumnPercentEditor\(\\'revision-precios-tabla\\'\)/);
  assert.match(app, /<tr data-revision-producto/);
  assert.match(app, /<tr data-revision-editor>/);
  assert.match(app, /editor\.style\.display = mostrar \? '' : 'none'/);
  assert.match(app, /prepareResizablePage\(overlay\)/);
});

test('las tablas en píxeles se ajustan proporcionalmente sin modificar el perfil guardado', () => {
  assert.match(tables, /function fitPixelTableToContainer\(table\)/);
  assert.match(tables, /var factor = flexibleTotal > 0 \? flexibleSpace \/ flexibleTotal : 1/);
  assert.match(tables, /fixed > 0 \? normalizeWidth\(fixed\) : normalizeWidth\(width \* factor\)/);
  assert.match(tables, /window\.addEventListener\('resize',[\s\S]*scheduleViewportFit\(\)/);
  assert.match(tables, /document\.querySelectorAll\('table\.sv-pixel-table'\)\.forEach\(fitPixelTableToContainer\)/);
  const start = tables.indexOf('function fitPixelTableToContainer(table)');
  const end = tables.indexOf('function fitVisiblePixelTables()', start);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(tables.slice(start, end), /saveWidths\(/);
});

test('el cien por ciento no corta botones de acciones', () => {
  assert.match(tables, /label \? \(34 \+ label\.length \* 7\) : 44/);
  assert.match(tables, /if \(fixedTooSmall\) values = defaultPercentages\(table\)/);
  assert.match(tables, /readonly title="Ancho protegido para mostrar todas las acciones"/);
  assert.match(tables, /var pesos = suggestedPixelWidths\(table, headers\)/);
});
