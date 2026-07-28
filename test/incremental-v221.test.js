const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const tables = fs.readFileSync(path.join(root, 'js', 'modules', 'resizable-tables.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const version = fs.readFileSync(path.join(root, 'js', 'core', 'version.js'), 'utf8');

test('la agenda incluye e identifica las OT completadas', () => {
  assert.match(app, /completada:\s*\{\s*bg:/);
  assert.match(app, /var estaCompletada = typeof otEstaCerrada/);
  assert.match(app, /tipo: estaCompletada \? 'completada'/);
  assert.match(app, /Completada ·/);
});

test('los perfiles de columnas se preparan antes de mostrar el módulo', () => {
  const start = app.indexOf('function showPage(');
  const end = app.indexOf('\nfunction ', start + 20);
  const showPage = app.slice(start, end);
  assert.match(showPage, /prepareResizablePage\(page\)/);
  assert.ok(
    showPage.indexOf('prepareResizablePage(page)') < showPage.indexOf("page.classList.add('active')"),
    'el perfil debe aplicarse mientras la página todavía está oculta'
  );
  assert.match(tables, /function initPageTables\(root\)/);
  assert.match(tables, /window\.SisVentas\.prepareResizablePage = initPageTables/);
  assert.match(tables, /data-sv-alignment-scope/);
});

test('garantías integra equipos instalados sin duplicarlos', () => {
  assert.match(app, /function _garantiasDesdeEquipos\(\)/);
  assert.match(app, /function _listaGarantiasUnificada\(\)/);
  assert.match(app, /var clavesManuales = new Set/);
  assert.match(app, /origen: 'equipo_instalado'/);
  assert.match(app, /renderGarantiasUnificadas\(\)/);
  assert.match(app, /abrirEquipoDesdeGarantia/);
});

test('todos los archivos publicados corresponden a v2.0.221', () => {
  assert.match(app, /VERSION: 'v2\.0\.221-firebase'/);
  assert.match(index, /app\.v2\.0\.221\.js/);
  assert.match(index, /version\.v2\.0\.221\.js/);
  assert.match(index, /resizable-tables\.js\?v=2\.0\.221/);
  assert.match(sw, /sisventas-v2\.0\.221/);
  assert.equal(fs.readFileSync(path.join(root, 'js', 'app.v2.0.221.js'), 'utf8'), app);
  assert.equal(fs.readFileSync(path.join(root, 'js', 'core', 'version.v2.0.221.js'), 'utf8'), version);
});
