const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');

assert.match(app, /async function esperarRecursosPresupuesto\(\)/, 'El PDF debe esperar imágenes y fuentes');
assert.match(app, /windowWidth:794/, 'El PDF debe usar un ancho A4 estable');
assert.match(app, /windowHeight:elemento\.scrollHeight/, 'El PDF debe capturar todo el contenido');
assert.match(app, /imprimirVistaPresupuesto\(this\)/, 'Imprimir debe usar el flujo preparado');
assert.match(app, /function imprimirVistaPresupuesto\(\)\{window\.focus\(\);window\.print\(\)\}/, 'Imprimir debe abrirse dentro del gesto del usuario y no quedar bloqueado');
assert.match(app, /async function crearPdfCompleto\(elemento,opciones\)/, 'El PDF debe paginar explícitamente la captura completa');
assert.match(app, /for\(var y=0;y<canvas\.height;y\+=altoPaginaPx\)/, 'Todas las páginas del contenido deben incorporarse al PDF');
assert.match(app, /<base href=/, 'La vista temporal debe resolver correctamente logos e imágenes relativas');
assert.match(app, /<div class="tipo-badge">PRESUPUESTO<\/div>/, 'El presupuesto debe conservar su título propio');
assert.match(app, /<div class="tipo-badge">'\+escapeHTML\(tipoComp\)/, 'La venta debe conservar su tipo de comprobante propio');
assert.doesNotMatch(app, /urlVentanaPpto/, 'La ventana no debe reemplazar el título por la IP local');

console.log('presupuesto-pdf-consistencia.test.js OK');
