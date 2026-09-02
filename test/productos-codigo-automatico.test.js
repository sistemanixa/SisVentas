const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v3.2.5.js', 'utf8');

assert.match(html, /id="pf-codigo"[^>]*readonly/,
  'El código no debe ser editable por el usuario');
assert.match(app, /sisventas\/contadores\/codigoProducto/,
  'La secuencia de productos debe reservarse centralmente');
assert.match(app, /fbRunTransaction[\s\S]{0,500}Math\.max\(parseInt\(actual/,
  'La reserva debe ser transaccional y partir del mayor código conocido');
assert.match(html, /id="pf-codigo"[^>]*value="AUTO"/,
  'El formulario nuevo debe anunciar que el código es automático');
assert.match(app, /async function guardarProducto\(\)[\s\S]*?cod = await reservarCodigoProductoAutomatico\(\)/,
  'El código debe reservarse recién al guardar, después de validar el formulario');
assert.doesNotMatch(app, /if \(!id\) reservarCodigoProductoAutomatico\(\)/,
  'Abrir el formulario no debe consumir números');
assert.match(app, /nombre:[\s\S]{0,120}\.toUpperCase\(\)/,
  'El nombre debe guardarse en mayúsculas');
assert.match(app, /categoria:[\s\S]{0,120}\.toUpperCase\(\)/,
  'La categoría debe guardarse en mayúsculas');
assert.match(app, /marca:[\s\S]{0,120}\.toUpperCase\(\)/,
  'La marca debe guardarse en mayúsculas');

console.log('productos-codigo-automatico.test.js OK');
