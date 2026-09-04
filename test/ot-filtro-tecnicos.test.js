const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v3.3.12.js', 'utf8');
const admin = fs.readFileSync('js/modules/ot-admin.js', 'utf8');

test('el buscador de OT incluye al técnico', () => {
  assert.match(admin, /String\(o\.id\|\|''\) \+ ' ' \+ String\(o\.cliente\|\|''\) \+ ' ' \+ String\(o\.tecnico\|\|''\)/);
});

test('el selector se arma sólo con empleados técnicos', () => {
  assert.match(admin, /function empleadoEsTecnico\(emp\)/);
  assert.match(admin, /\.filter\(empleadoEsTecnico\)/);
  assert.match(admin, /\^\(\?:sin\|no\)\\s\+asignar\$/);
  assert.doesNotMatch(admin, /tecDeOTs/);
  assert.doesNotMatch(admin, /'Inicial'/);
});

test('al tocar el ranking se selecciona el filtro y se limpia el buscador', () => {
  assert.match(app, /selector\.value = tecnico/);
  assert.match(app, /if \(busqueda\) busqueda\.value = ''/);
});

test('el ranking excluye nombres que no pertenecen a técnicos', () => {
  assert.match(app, /var tecnicosValidos = new Set/);
  assert.match(app, /if \(tecnicosValidos\.size && !tecnicosValidos\.has\(tecnico\)\) return/);
});
