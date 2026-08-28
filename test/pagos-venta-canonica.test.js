const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v2.3.2.js'), 'utf8');

function exigir(fragmento, mensaje) {
  if (!app.includes(fragmento)) throw new Error(mensaje);
}

exigir("throw new Error('No se puede guardar el pago: la venta vinculada no existe')", 'Un pago todavía puede persistirse contra una venta inexistente');
exigir('var pagoCanonico = Object.assign({}, pago, {', 'El pago no se normaliza con la venta canónica');
exigir('ventaFbKey:String(ventaCanonica.fbKey)', 'El pago no conserva la clave interna real de la venta');
exigir("ventasPagosV3Invocar('savePayment', [pagoCanonico]", 'El adaptador todavía recibe el vínculo sin validar');

console.log('OK todo pago exige y persiste una venta canónica existente');
