const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('js/app.js', 'utf8');

assert.match(app, /async function esperarRecursosPresupuesto\(\)/, 'El PDF debe esperar imágenes y fuentes');
assert.match(app, /document\.body\.style\.margin="0"/, 'La captura debe quitar el margen externo que recortaba la hoja');
assert.match(app, /anchoCaptura=Math\.max\(794,elemento\.scrollWidth\)/, 'El PDF debe usar el ancho real completo del presupuesto');
assert.match(app, /width:anchoCaptura,height:altoCaptura,windowWidth:anchoCaptura,windowHeight:altoCaptura/, 'El lienzo y su ventana deben compartir las dimensiones completas');
assert.match(app, /var blob=await crearPdfCompleto\(elemento,opciones\);if\(modo==="compartir"\)/, 'Descargar y compartir deben utilizar exactamente el mismo PDF completo');
assert.match(app, /document\.body\.style\.cssText=estiloBodyAnterior/, 'La vista debe restaurar sus estilos después de generar el PDF');
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
