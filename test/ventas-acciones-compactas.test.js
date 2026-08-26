const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

assert.match(index, /<th class="ppto-actions-cell" style="text-align:center">Acciones<\/th>/,
  'Ventas debe reutilizar la misma columna de acciones que Presupuestos');
assert.match(app, /class="sv-card-actions ppto-actions-cell"/,
  'Las filas de Ventas deben usar la medida común de acciones');
assert.match(css, /#ventas-tbl \.ppto-actions-cell\{width:340px;min-width:340px;max-width:340px\}/,
  'La columna no debe absorber el espacio sobrante de la tabla');
assert.match(css, /#ventas-tbl \.ventas-row-actions\{width:340px;max-width:340px;margin-left:auto\}/,
  'La grilla debe conservar el ancho compacto de Presupuestos');
assert.match(css, /#ventas-tbl \.ventas-row-actions\{width:100%!important;max-width:none!important;margin-left:0\}/,
  'En móvil las acciones deben seguir aprovechando el ancho de la tarjeta');

console.log('ventas-acciones-compactas.test.js OK');
