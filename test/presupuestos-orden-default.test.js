const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v3.3.12.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

test('presupuestos usa la numeracion atomica descendente como orden de alta', () => {
  assert.match(app, /match\(\/\^PP-\(\\d\{4\}\)\$\/i\)/);
  assert.match(app, /if \(na && nb && na !== nb\) return nb - na/);
});

test('presupuestos conserva timestamp y fecha como respaldo para historicos', () => {
  assert.match(app, /if \(ta !== tb\) return tb - ta/);
  assert.match(app, /return fb\.localeCompare\(fa\)/);
});

test('la grilla muestra fecha y usuario creador', () => {
  assert.match(index, /<th>#<\/th><th>Fecha<\/th><th>Cliente<\/th><th>Total<\/th><th>Vence<\/th><th>Estado<\/th><th>Creado por<\/th><th>Acciones<\/th>/);
  assert.match(app, /p\.creadoPor \|\| p\.usuario \|\| p\.empleado/);
  assert.match(app, /ventaCreadorBadge\(Object\.assign\(\{\}, p, \{ creadaPor:creador \}\)\)/);
  assert.match(app, /colspan="8"/);
});

test('las altas guardan creador y timestamp sin reemplazarlos al editar', () => {
  assert.match(app, /creadoPor: currentUser \|\| currentUserEmail \|\| ''/);
  assert.match(app, /fecha: new Date\(\)\.toLocaleDateString\('es-AR'\), ts: Date\.now\(\)/);
  assert.match(app, /nuevo\.ts = pptoOriginalEdit\.ts \|\| nuevo\.ts/);
});
