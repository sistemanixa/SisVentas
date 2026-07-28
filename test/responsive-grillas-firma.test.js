const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');

test('la firma utiliza una sola superficie amplia y responsiva', () => {
  assert.match(index, /id="firma-canvas" class="ot-firma-canvas"/);
  assert.doesNotMatch(index, /id="firma-preview"/);
  assert.doesNotMatch(index, /Firma almacenada en esta OT/);
  assert.match(css, /\.ot-firma-canvas\s*\{[^}]*height:clamp\(230px,32vh,330px\)/s);
});

test('las grillas mantienen desplazamiento horizontal sin comprimir columnas', () => {
  assert.match(css, /\.page\.active \.table-wrap > table:not\(#gas-tbl\)[^{]*\{[^}]*width:max-content!important/s);
  assert.match(css, /-webkit-overflow-scrolling:touch!important/);
});

test('las acciones se agrupan automáticamente en tres puntos cuando no entran', () => {
  assert.match(app, /function instalarMenusAccionesGrillas\(/);
  assert.match(app, /ti-dots-vertical/);
  assert.match(app, /window\.innerWidth <= 900/);
  assert.match(css, /\.sv-grid-actions-compact \.sv-grid-actions-trigger\{display:inline-flex!important\}/);
});
