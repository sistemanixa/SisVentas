const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const grid = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');
const app = fs.readFileSync('js/app.v3.0.10.js', 'utf8');

test('todas las grillas usan una única regla proporcional sin excepciones por pantalla', () => {
  assert.match(grid, /function shouldApplyDefaultPercentProfile\(table\)[\s\S]*?return !!table/);
  assert.match(grid, /function usesPixelOnly\(table\)[\s\S]*?return false/);
  assert.doesNotMatch(grid, /table\.id === '(?:gas-tbl|prod-tbl|ppto-tabla|ventas-tbl|venta-items-tbl)'/);
});

test('el perfil global del administrador tiene prioridad sobre perfiles locales antiguos', () => {
  ['widths', 'percentages', 'alignments'].forEach((type) => {
    const singular = type === 'percentages' ? 'Percentages' : (type === 'alignments' ? 'Alignments' : 'Widths');
    const start = grid.indexOf(`function load${singular}(table)`);
    const end = grid.indexOf('\n  function ', start + 1);
    const loader = grid.slice(start, end);
    assert.ok(loader.indexOf(`globalDataFor(table, '${type}')`) < loader.indexOf('localStorage.getItem'),
      `el perfil global de ${type} debe leerse antes que el local`);
  });
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
