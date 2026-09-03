const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
const app = fs.readFileSync(path.join(raiz, 'js', 'app.v3.3.10.js'), 'utf8');
const version = fs.readFileSync(path.join(raiz, 'js', 'core', 'version.v3.3.10.js'), 'utf8');

for (const [nombre, contenido] of Object.entries({ index, sw, app, version })) {
  if (!contenido.includes('3.3.10')) throw new Error(`${nombre} no contiene la versión 3.3.10`);
}
if (!index.includes('js/app.v3.3.10.js') || !sw.includes('js/app.v3.3.10.js')) {
  throw new Error('El paquete activo no referencia el archivo inmutable v3.3.10');
}

console.log('OK: paquete inmutable v3.3.10 consistente.');
