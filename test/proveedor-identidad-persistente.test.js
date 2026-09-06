const fs = require('fs');
const path = require('path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v3.3.10.js'), 'utf8');

if (!app.includes("FB_PATHS.productos + '/' + editingProdId + '/proveedores/' + idx")) {
  throw new Error('La confirmación debe persistirse inmediatamente en el proveedor del producto');
}
if (!app.includes('No volverá a consultarse')) {
  throw new Error('La interfaz debe informar que la autorización quedó guardada para la URL');
}

console.log('OK: la identidad confirmada se persiste por proveedor y URL.');
