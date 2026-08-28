const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const index = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');
const resize = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');

test('Detalle de venta queda aislado en píxeles y conserva desplazamiento horizontal', () => {
  assert.match(index, /id="ventas-tbl"[^>]*data-sv-pixel-only="1"[^>]*data-sv-column-key="ventas-tbl-pixel-v3"/);
  assert.match(resize, /function usesPixelOnly\(table\)/);
  assert.match(resize, /if \(usesPixelOnly\(table\)\) \{[\s\S]*?applySavedWidths\(table\)/);
  assert.match(resize, /if \(usesPixelOnly\(table\)\) \{\s*openPixelEditor\(table\)/);
  assert.match(resize, /var ventas = \[110, 220, 330, 110, 140, 130, 130, 160, 60, 170\]/);
  assert.match(css, /#page-detalle #ventas-list-view \.table-wrap[\s\S]*?max-height:min\(58vh,620px\)[\s\S]*?overflow:auto!important/);
  assert.match(css, /#page-detalle #ventas-tbl\[data-sv-pixel-only="1"\]\.sv-pixel-table[\s\S]*?width:var\(--sv-pixel-total-width\)!important/);
});

test('las acciones de ventas mantienen exactamente el patrón compacto de presupuestos', () => {
  assert.match(css, /\.ppto-row-action\{width:100%;height:32px;[\s\S]*?font-size:10\.5px/);
  assert.match(index, /<th class="ppto-actions-cell" data-sv-fixed-width="170" style="text-align:center">Acciones<\/th>/);
  assert.match(css, /#ventas-tbl \.ppto-actions-cell\{min-width:0;max-width:none\}/);
  assert.match(css, /#ventas-tbl \.ventas-row-actions\{display:flex;width:100%;[\s\S]*?flex-wrap:nowrap/);
  assert.match(css, /#ventas-tbl \.ventas-row-actions \.ppto-row-action\{flex:0 0 32px;width:32px;height:32px;padding:4px/);
});

test('Acciones es la única columna fija y no recibe tirador de ancho', () => {
  assert.match(resize, /parseInt\(th\.dataset\.svFixedWidth/);
  assert.match(resize, /th\.classList\.remove\('sv-resizable-th'\)/);
  assert.match(resize, /if \(fixedHandle\) fixedHandle\.remove\(\)/);
});

test('Detalle de venta recupera el editor manual sin convertir píxeles a porcentajes', () => {
  assert.doesNotMatch(resize, /function ensurePercentButton\(table\) \{[\s\S]*?if \(usesPixelOnly\(table\)\) return;/);
  assert.match(resize, /openColumnPercentEditor/);
  assert.match(resize, /if \(usesPixelOnly\(table\)\) \{\s*openPixelEditor\(table\)/);
  assert.match(resize, /function openPixelEditor\(table\)/);
  assert.match(resize, /Anchos independientes\. El porcentaje es solo informativo\./);
  assert.match(resize, /data-pixel-index/);
  assert.match(resize, /Ocupación visible:/);
  assert.match(resize, /saveWidths\(table, data\)/);
});

test('restaurar anchos en píxeles no usa medidas reescaladas por el navegador', () => {
  assert.match(resize, /var resolvedWidths = headers\.map/);
  assert.match(resize, /var totalWidth = resolvedWidths\.reduce/);
  assert.match(resize, /setProperty\('width', 'var\(--sv-pixel-total-width\)', 'important'\)/);
  assert.match(resize, /resolvedWidths\.forEach\(function \(width, index\) \{\s*applyColumnWidth\(table, index, width\)/);
});

test('un arrastre bloquea el clic tardío del encabezado sin bloquear clics normales', () => {
  assert.match(resize, /var didDrag = false/);
  assert.match(resize, /Math\.abs\(clientX - startX\) > 3/);
  assert.match(resize, /svSuppressHeaderClickUntil/);
  assert.match(resize, /Date\.now\(\) \+ 350/);
  assert.match(resize, /event\.stopImmediatePropagation\(\)/);
});

test('el límite mínimo queda estable y no recalcula el mismo píxel', () => {
  assert.match(resize, /var lastLivePixelWidth = null/);
  assert.match(resize, /if \(lastLivePixelWidth === width\) return/);
  assert.match(resize, /lastLivePixelWidth = Math\.round\(startWidths\[index\]\)/);
});

test('al soltar no redistribuye el sobrante entre las demás columnas', () => {
  assert.match(resize, /var declaredWidth = col \? parseFloat\(col\.style\.width \|\| ''\) : 0/);
  assert.match(resize, /finalWidths\[visibleIndex\] = normalizeWidth\(declaredWidth \|\| header\.getBoundingClientRect\(\)\.width\)/);
  assert.doesNotMatch(resize, /finalWidths\[visibleIndex\] = Math\.round\(header\.getBoundingClientRect\(\)\.width\)/);
});

test('el ancho en píxeles prevalece sobre el mínimo global del cien por ciento', () => {
  assert.match(resize, /setProperty\('width', 'var\(--sv-pixel-total-width\)', 'important'\)/);
  assert.match(resize, /setProperty\('min-width', 'var\(--sv-pixel-total-width\)', 'important'\)/);
  assert.match(resize, /setProperty\('width', finalTableWidth, 'important'\)/);
  assert.match(resize, /setProperty\('min-width', finalTableWidth, 'important'\)/);
});

test('la alineación de Acciones mueve también el grupo de iconos', () => {
  assert.match(resize, /querySelector\('\.ventas-row-actions, \.ppto-row-actions'\)/);
  assert.match(resize, /actionGroup\.style\.justifyContent = align === 'right'/);
});
