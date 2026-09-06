const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const grid = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('agregar filas dentro de tbody reactiva la tabla general', () => {
  assert.match(grid, /target\.closest && target\.closest\('table'\)/);
  assert.match(grid, /var targetTable = [\s\S]*?target\.closest\('table'\)/);
  assert.match(grid, /initTable\(targetTable\)/);
});

test('el cambio de página inicializa en el siguiente cuadro sin esperar resize', () => {
  assert.match(grid, /sisventas:page-changed'[\s\S]*?requestAnimationFrame[\s\S]*?scan\(\)/);
});

test('la aplicación carga la revisión general de render dinámico', () => {
  assert.match(html, /resizable-tables\.js\?v=3\.2\.5-grillas-render-dinamico-1/);
});
