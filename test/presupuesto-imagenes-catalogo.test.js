const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.3.2.js'), 'utf8');

function exigir(fragmento, mensaje) {
  if (!app.includes(fragmento)) throw new Error(mensaje);
}

exigir("return codigo.replace(/^P(?=\\d)/, '').replace(/^0+(?=\\d)/, '');", 'No se equiparan códigos históricos 60876 con P-60876');
exigir('_codigoProductoComparable(x.codigo || x.id) === _codigoProductoComparable(ref)', 'El presupuesto no consulta el catálogo mediante el código normalizado');
exigir('function refrescarImagenesDetallePresupuesto()', 'Falta reintentar imágenes cuando Productos termina de cargar');
exigir('data-ppto-item-index="\'+itemIndex+\'"', 'Las filas no conservan la posición necesaria para refrescar su imagen');
exigir("if (typeof refrescarImagenesDetallePresupuesto === 'function') refrescarImagenesDetallePresupuesto();", 'La sincronización de Productos no refresca el presupuesto abierto');

console.log('OK presupuesto completa imágenes históricas desde el catálogo actual');
