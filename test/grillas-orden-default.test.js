const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const regla = fs.readFileSync('js/modules/grid-default-order.js', 'utf8');

test('la regla general de grillas se carga y queda disponible sin conexión', () => {
  assert.match(index, /js\/modules\/grid-default-order\.js/);
  assert.match(sw, /js\/modules\/grid-default-order\.js/);
});

test('las grillas con Fecha ordenan por defecto de más nueva a más antigua', () => {
  assert.match(regla, /return b\.fecha - a\.fecha/);
  assert.match(regla, /svDefaultOrder = 'fecha-desc'/);
  assert.match(regla, /setAttribute\('aria-sort', 'descending'\)/);
});

test('un orden elegido por el usuario tiene prioridad', () => {
  assert.match(regla, /window\._sortState && window\._sortState\[tabla\.id\]/);
  assert.match(regla, /if \(!tabla \|\| tieneOrdenElegido\(tabla\)\) return/);
});
