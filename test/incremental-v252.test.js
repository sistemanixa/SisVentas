const assert = require('assert');
const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.252.js', 'utf8');

assert.match(index, /<th>Último ajuste<\/th>/);
assert.match(index, /id="dash-aumento-hora-aviso"/);
assert.match(app, /function _cargoAjusteRegistro\(anterior, nuevo\)/);
assert.match(app, /function cargosVerHistorial\(id\)/);
assert.match(app, /historialValorHora/);
assert.match(app, /porcentajeRedondeado/);
assert.match(app, /Math\.abs\(porcentajeRedondeado\) > 50/);
assert.match(app, /function renderAvisoAumentoValorHora\(\)/);
assert.match(app, /diasDesdeCambio > 30/);
assert.match(app, /ajuste\.tipo !== 'aumento'/);
assert.match(app, /window\.fbUpdate\(window\.fbRef\(window\.fbDB\), actualizaciones\)/);
assert.match(index, /app\.v2\.0\.252\.js/);
assert.match(index, /version\.v2\.0\.252\.js/);
assert.match(sw, /sisventas-v2\.0\.252/);
assert.match(app, /VERSION:\s*'v2\.0\.252-firebase'/);

console.log('v2.0.252: historial y aviso de aumentos verificados');
