const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

function exigir(fragmento, mensaje) {
  if (!app.includes(fragmento)) throw new Error(mensaje);
}

exigir('Actualizar también productos vigentes', 'Falta el control visible para incluir productos vigentes.');
exigir('var incluirVigentesManual = true;', 'La actualización iniciada manualmente debe incluir vigentes por defecto.');
exigir('incluirVigentesManual ? todos : pendientes', 'El lote manual no está eligiendo entre todos y sólo pendientes.');
exigir('modal._incluirVigentesManual === true ? todos : pendientesVigencia', 'El resumen no respeta el modo manual.');
exigir('estadoVigenciaPrecioProveedor(x.producto, actualizadorProveedorActual(x)).vigente', 'Se eliminó la detección automática de vigencia.');

console.log('OK actualizador manual permite recotizar productos vigentes sin alterar la detección automática');
