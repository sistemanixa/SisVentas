const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const tables = fs.readFileSync(path.join(root, 'js', 'modules', 'resizable-tables.js'), 'utf8');

test('empleados prepara filas y columnas antes de activar el modulo', () => {
  const preparar = app.indexOf("if (id === 'empleados')");
  const activar = app.indexOf("page.classList.add('active')");
  assert.ok(preparar > 0 && activar > preparar);
  assert.match(app, /prepareResizablePage\(page\)/);
  assert.doesNotMatch(app, /id === 'empleados'[^\n]*setTimeout/);
});

test('la alineacion guardada tambien alcanza filas regeneradas', () => {
  assert.match(tables, /data-sv-alignment-scope/);
  assert.match(tables, /nth-child\(/);
  assert.match(tables, /prepareResizablePage = initPageTables/);
});

test('agenda conserva las OT completadas como hechos del calendario', () => {
  assert.doesNotMatch(app, /!ot\.fecha \|\| ot\.estado === 'completada'/);
  assert.match(app, /completada:\s*\{ bg:/);
  assert.match(app, /tipo: estaCompletada \? 'completada'/);
});
