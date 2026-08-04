const assert = require('assert');
const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.251.js', 'utf8');

const buttonPos = app.indexOf('onclick="cargosCopiarHoraAExtra');
const extraInputPos = app.indexOf('id="cargo-vhe-');
assert.ok(buttonPos >= 0 && extraInputPos >= 0 && buttonPos < extraInputPos, 'la flecha debe estar antes del campo Hs ex');
assert.match(index, /app\.v2\.0\.251\.js/);
assert.match(index, /version\.v2\.0\.251\.js/);
assert.match(sw, /sisventas-v2\.0\.251/);
assert.match(app, /VERSION:\s*'v2\.0\.251-firebase'/);

console.log('v2.0.251: flecha entre valor hora y horas extra verificada');
