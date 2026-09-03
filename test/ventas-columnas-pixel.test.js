const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const index = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');
const resize = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');

test('Detalle de venta usa la regla general de columnas', () => {
  assert.match(index, /id="ventas-tbl"[^>]*data-sv-column-key="ventas-tbl-general-v1"/);
  assert.doesNotMatch(index, /id="ventas-tbl"[^>]*data-sv-pixel-only="1"/);
  assert.match(resize, /function usesFullContainerWidth\(table\) \{\s*return !!table;/);
  assert.match(resize, /function usesPixelOnly\(table\) \{\s*return false;/);
});

test('las acciones de ventas mantienen el patrón compacto de presupuestos', () => {
  assert.match(css, /\.ppto-row-action\{width:100%;height:32px;[\s\S]*?font-size:10\.5px/);
  assert.match(index, /<th class="ppto-actions-cell" data-sv-fixed-width="170" style="text-align:center">Acciones<\/th>/);
  assert.match(css, /#ventas-tbl \.ppto-actions-cell\{min-width:0;max-width:none\}/);
  assert.match(css, /#ventas-tbl \.ventas-row-actions\{display:flex;width:100%;[\s\S]*?flex-wrap:nowrap/);
});

test('la columna Acciones respeta el ancho fijo y la alineación general', () => {
  assert.match(resize, /parseInt\(th\.dataset\.svFixedWidth/);
  assert.match(resize, /th\.classList\.remove\('sv-resizable-th'\)/);
  assert.match(resize, /querySelector\('\.ventas-row-actions, \.ppto-row-actions'\)/);
  assert.match(resize, /actionGroup\.style\.justifyContent = align === 'right'/);
});

test('un arrastre bloquea el clic tardío del encabezado sin bloquear clics normales', () => {
  assert.match(resize, /var didDrag = false/);
  assert.match(resize, /Math\.abs\(clientX - startX\) > 3/);
  assert.match(resize, /svSuppressHeaderClickUntil/);
  assert.match(resize, /Date\.now\(\) \+ 350/);
});
