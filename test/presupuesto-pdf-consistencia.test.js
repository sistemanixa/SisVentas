const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');

assert.match(app, /async function esperarRecursosPresupuesto\(\)/, 'El PDF debe esperar imágenes y fuentes');
assert.match(app, /function crearClonCapturaPresupuesto\(elemento\)/, 'La captura debe usar un clon independiente de la vista visible');
assert.match(app, /position:fixed;left:0;top:0;width:794px/, 'El clon debe comenzar físicamente en la coordenada horizontal cero');
assert.match(app, /x:0,y:0,width:anchoCaptura,height:altoCaptura/, 'El lienzo debe capturar desde el origen sin heredar desplazamientos');
assert.match(app, /var blob=await crearPdfCompleto\(elementoCaptura,opciones\);if\(modo==="compartir"\)/, 'Descargar y compartir deben utilizar exactamente el mismo PDF completo');
assert.match(app, /window\._svDescargarBlobPresupuesto/, 'La pestaña principal debe poder descargar el PDF cuando la vista temporal usa blob:');
assert.match(app, /window\.opener\._svDescargarBlobPresupuesto\(blob,nombre\)/, 'La vista temporal debe delegar la descarga al origen estable de SisVentas');
assert.match(app, /\/__sisventas_pdf__\//, 'La descarga debe usar una ruta temporal del mismo origen en vez de depender solamente de blob:');
assert.match(app, /function urlImagenCapturablePresupuesto\(src\)/, 'Las imágenes externas deben pasar por una fuente capturable');
assert.match(app, /\/imagen-producto\?url=/, 'El PDF debe usar el proxy de imágenes restringido de SisVentas');
assert.match(app, /<img crossorigin="anonymous" src=/, 'Las miniaturas deben solicitarse con CORS antes de capturar el PDF');
assert.match(app, /if\(captura&&captura\.host\)captura\.host\.remove\(\)/, 'El clon temporal debe eliminarse al finalizar');
assert.match(app, /nombreArchivoPpto = 'Presupuesto_'/, 'El archivo debe usar un nombre ASCII estable e independiente del título visual');
assert.match(app, /tituloVentanaPpto = 'SisVentas - NIXA - Presupuesto '/, 'El título de ventana no debe depender de signos tipográficos problemáticos');
assert.match(app, /w\.document\.write\(htmlVistaPresupuesto\)/, 'La vista debe escribirse desde una única fuente HTML');
assert.doesNotMatch(app, /w\.document\.documentElement\.outerHTML/, 'La vista no debe reserializar una ventana todavía incompleta');
assert.match(app, /if \(!w\.document\.getElementById\('presupuesto-pdf'\)\)/, 'La ventana debe reconstruir el comprobante si una carga temporal queda en blanco');
assert.match(app, /setTimeout\(asegurarVistaPresupuesto, 1800\)/, 'La vista debe tener una segunda verificación de carga estable');
assert.match(app, /imprimirVistaPresupuesto\(this\)/, 'Imprimir debe usar el flujo preparado');
assert.match(app, /function imprimirVistaPresupuesto\(\)\{window\.focus\(\);window\.print\(\)\}/, 'Imprimir debe abrirse dentro del gesto del usuario y no quedar bloqueado');
assert.match(app, /async function crearPdfCompleto\(elemento,opciones\)/, 'El PDF debe paginar explícitamente la captura completa');
assert.match(app, /for\(var y=0;y<canvas\.height;y\+=altoPaginaPx\)/, 'Todas las páginas del contenido deben incorporarse al PDF');
assert.match(app, /<base href=/, 'La vista temporal debe resolver correctamente logos e imágenes relativas');
assert.match(app, /<div class="tipo-badge">PRESUPUESTO<\/div>/, 'El presupuesto debe conservar su título propio');
assert.match(app, /<div class="tipo-badge">'\+escapeHTML\(tipoComp\)/, 'La venta debe conservar su tipo de comprobante propio');
assert.doesNotMatch(app, /urlVentanaPpto/, 'La ventana no debe reemplazar el título por la IP local');

console.log('presupuesto-pdf-consistencia.test.js OK');
