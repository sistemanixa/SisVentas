const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.264.js', 'utf8');

assert(index.includes('app.v2.0.264.js'));
assert(app.includes("el.dataset.minimizado === '1'"));
assert(app.includes('svSincronizarPilaModales();'));
assert(app.includes("VERSION: 'v2.0.264-firebase'"));

console.log('v2.0.264: el actualizador minimizado no bloquea el fondo');
