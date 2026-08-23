const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('la vigencia de precios se configura en días y usa cinco como valor inicial', () => {
  assert.match(html, /id="cfg-dias-vigencia-precios" value="5"/);
  assert.match(app, /var PRECIO_VIGENCIA_DIAS_DEFAULT = 5;/);
  assert.match(app, /diasVigenciaPrecios:\s*Math\.max/);
  assert.match(app, /preferencias\/diasVigenciaPrecios/);
  assert.doesNotMatch(app, /PRECIO_VIGENCIA_MS/);
});

test('productos, actualizador y ventas consultan la misma vigencia configurable', () => {
  assert.match(app, /function precioVigenciaMs\(\)/);
  assert.match(app, /maxAgeMs:\s*precioVigenciaMs\(\)/);
  assert.match(app, /estadoVigenciaPrecioProducto\(prod\)/);
  assert.match(app, /diasVigenciaPrecios\(\) \+ ' días o sin verificar/);
});

test('la fila del proveedor muestra fecha semaforizada, origen legible y centavos', () => {
  assert.match(app, /toLocaleDateString\('es-AR'.*replaceAll\('\/', '-'\)/);
  assert.match(app, /colorFechaPv = vigenciaPv\.vigente \? 'var\(--green\)' : 'var\(--red\)'/);
  assert.match(app, /function etiquetaOrigenActualizacionPrecio\(/);
  assert.match(app, /data-money-fixed="2"/);
  assert.match(app, /minimumFractionDigits:2, maximumFractionDigits:2/);
});
