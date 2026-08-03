const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.265.js', 'utf8');

assert(index.includes('app.v2.0.265.js'));
assert(app.includes('actualizador-precios-procesados'));
assert(app.includes('actualizador-precios-fallidos-contador'));
assert(app.includes('actualizador-precios-en-curso'));
assert(app.includes('Listos para aplicar'));
assert(app.includes("VERSION: 'v2.0.265-firebase'"));

console.log('v2.0.265: progreso del actualizador separado y comprensible');
