const assert = require('assert');
const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.250.js', 'utf8');

assert.match(app, /function cargosCopiarHoraAExtra\(id\)/);
assert.match(app, /id="cargo-vh-' \+ id/);
assert.match(app, /id="cargo-vhe-' \+ id/);
assert.match(app, /Copiar valor hora a Hs extra/);
assert.match(app, /function cargosCopiarHoraExtraEnModal\(\)/);
assert.match(index, /onclick="cargosCopiarHoraExtraEnModal\(\)"/);
assert.match(index, /css\/app\.css\?v=2\.0\.250/);
assert.match(index, /app\.v2\.0\.250\.js/);
assert.match(index, /version\.v2\.0\.250\.js/);
assert.match(sw, /sisventas-v2\.0\.250/);
assert.match(app, /VERSION:\s*'v2\.0\.250-firebase'/);

console.log('v2.0.250: copia de valor hora a horas extra verificada');
