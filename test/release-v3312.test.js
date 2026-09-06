const fs = require('node:fs');
const path = require('node:path');

const raiz = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8');
const app = fs.readFileSync(path.join(raiz, 'js', 'app.v3.3.12.js'), 'utf8');
const version = fs.readFileSync(path.join(raiz, 'js', 'core', 'version.v3.3.12.js'), 'utf8');

for (const [nombre, contenido] of Object.entries({ index, sw, app, version })) {
  if (!contenido.includes('3.3.12')) throw new Error(`${nombre} no contiene la versión 3.3.12`);
}
if (!index.includes('js/app.v3.3.12.js') || !sw.includes('js/app.v3.3.12.js')) {
  throw new Error('El paquete activo no referencia el archivo inmutable v3.3.12');
}
if (!app.includes("version: 'v3.3.12'")) throw new Error('Falta la novedad visible de v3.3.12');
console.log('OK: paquete inmutable v3.3.12 consistente.');
