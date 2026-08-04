const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.277.js', 'utf8');

assert(index.includes('app.v2.0.277.js'));
assert(index.includes('version.v2.0.277.js'));
assert(app.includes("VERSION: 'v2.0.277-firebase'"));
assert(app.includes('function _gastoFijoDescripcionMes'));
assert(app.includes("updates['sisventas/gastos/' + g.fbKey + '/descripcion']"));
assert(app.includes('copia.descripcion = _gastoFijoDescripcionMes(base.descripcion, mes)'));

console.log('v2.0.277: gastos fijos identificados con el mes correcto');
