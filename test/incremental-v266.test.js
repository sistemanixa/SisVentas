const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.266.js', 'utf8');

assert(index.includes('app.v2.0.266.js'));
assert(app.includes('actualizador-pendientes-resumen'));
assert(app.includes('actualizador-vigentes-resumen'));
assert(app.includes('_actualizadorSesionPrecios'));
assert(app.includes('Sesión recuperada'));
assert(app.includes('Guardado: '));
assert(app.includes("VERSION: 'v2.0.266-firebase'"));

console.log('v2.0.266: resumen actualizado y reanudación del actualizador');
