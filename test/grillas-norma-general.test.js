const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const grid = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');
const app = fs.readFileSync('js/app.v3.0.9.js', 'utf8');

test('todas las grillas usan proporciones salvo una excepción pixel explícita', () => {
  assert.match(grid, /return !!\(table && !usesPixelOnly\(table\)\)/);
  assert.match(grid, /table\.dataset\.svPixelOnly === '1'/);
});

test('abrir el editor porcentual sólo informa y no aplica una vista previa', () => {
  assert.match(grid, /Mostrar los valores actuales sin aplicar nuevamente el perfil/);
  assert.match(grid, /refreshTotal\(values\)/);
  assert.doesNotMatch(grid, /alignmentDrafts\[percentDraftKey\(table\)\] = Object\.assign\(\{\}, alignValues\)/);
});

test('abrir el editor en píxeles tampoco altera el colgroup', () => {
  assert.match(grid, /Abrir el editor es una operación de lectura/);
  assert.match(grid, /if \(previewChanged\) restoreSaved\(\)/);
});

test('la configuración remota se resuelve antes de revelar la grilla', () => {
  assert.match(grid, /table\.classList\.add\('sv-columns-pending'\)/);
  assert.match(grid, /globalProfiles\.loaded = true/);
});

test('cada render puede inicializar la norma de columnas en el mismo ciclo', () => {
  assert.match(app, /SisVentas\.prepareResizablePage\(tabla\)/);
});

test('la alineación incluye contenido y grupos de acciones', () => {
  assert.match(grid, /\.sv-grid-actions-original\{justify-content:/);
  assert.match(grid, /columnSelector \+ ' input:not/);
});
