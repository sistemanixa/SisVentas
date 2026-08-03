const assert = require('assert');
const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.255.js', 'utf8');
const core = fs.readFileSync('js/core/version.v2.0.255.js', 'utf8');
const published = fs.readFileSync('js/core/version.js', 'utf8');

assert.match(index, /VERSION: 'v2\.0\.255-firebase'/);
assert.match(index, /app\.v2\.0\.255\.js/);
assert.match(index, /version\.v2\.0\.255\.js/);
assert.match(sw, /sisventas-v2\.0\.255/);
assert.match(sw, /app\.v2\.0\.255\.js/);
assert.match(app, /VERSION:\s*'v2\.0\.255-firebase'/);
assert.match(core, /SISVENTAS_PWA_VERSION\s*=\s*'v2\.0\.255'/);
assert.match(published, /SISVENTAS_PWA_VERSION\s*=\s*'v2\.0\.255'/);

console.log('v2.0.255: marcadores de actualización sincronizados');
