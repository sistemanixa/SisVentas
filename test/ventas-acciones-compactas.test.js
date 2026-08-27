const fs = require('fs');
const assert = require('assert');

const { readActiveApp } = require('./helpers/active-app');
const activo = readActiveApp();
const index = activo.index;
const app = activo.source;
const css = fs.readFileSync('css/app.css', 'utf8');

assert.match(index, /<th class="ppto-actions-cell"[^>]*style="text-align:center">Acciones<\/th>/,
  'Ventas debe reutilizar la misma columna de acciones que Presupuestos');
assert.match(app, /class="sv-card-actions ppto-actions-cell"/,
  'Las filas de Ventas deben usar la medida común de acciones');
assert.match(css, /#ventas-tbl \.ppto-actions-cell\{min-width:0;max-width:none\}/,
  'La columna debe respetar el ancho manual sin imponer una redistribución porcentual');
assert.match(css, /#ventas-tbl \.ventas-row-actions\{display:flex;width:100%;max-width:none;margin-left:auto;[^}]*flex-wrap:nowrap\}/,
  'Las acciones deben conservarse compactas y en una sola línea');
assert.match(css, /#ventas-tbl \.ventas-row-actions\{width:100%!important;max-width:none!important;margin-left:0\}/,
  'En móvil las acciones deben seguir aprovechando el ancho de la tarjeta');

console.log('ventas-acciones-compactas.test.js OK');
