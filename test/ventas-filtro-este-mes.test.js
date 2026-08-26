const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

const hoy = index.indexOf('id="vtab-hoy"');
const mes = index.indexOf('id="vtab-mes"');
const facturadas = index.indexOf('id="vtab-facturadas"');

assert.ok(hoy >= 0 && mes > hoy && facturadas > mes,
  'Este mes debe aparecer inmediatamente después de Hoy y antes de Facturadas');
assert.match(index, /id="vtab-mes" onclick="tabVentas\('mes',this\)">Este mes<\/button>/,
  'El botón Este mes debe activar el filtro rápido mensual');
assert.match(app, /else if \(f\.tab === 'mes'\)/,
  'El listado de ventas debe resolver el filtro mensual');
assert.match(app, /mes:'Este mes'/,
  'El banner debe explicar que el filtro Este mes está activo');

console.log('ventas-filtro-este-mes.test.js OK');
