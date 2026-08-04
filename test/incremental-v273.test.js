const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.273.js', 'utf8');

assert(index.includes('app.v2.0.273.js'));
assert(index.includes('version.v2.0.273.js'));
assert(app.includes("VERSION: 'v2.0.273-firebase'"));
assert(app.includes('ivaAlicuota: data.ivaAlicuota'));
assert(app.includes('ivaAlicuota: r.ivaAlicuota'));

console.log('v2.0.273: la alicuota del servicio llega al calculo de la ficha');
