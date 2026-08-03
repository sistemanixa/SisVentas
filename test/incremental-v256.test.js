const assert = require('assert');
const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.256.js', 'utf8');
const core = fs.readFileSync('js/core/version.v2.0.256.js', 'utf8');
const published = fs.readFileSync('js/core/version.js', 'utf8');
const resizable = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');

assert.match(index, /VERSION: 'v2\.0\.256-firebase'/);
assert.match(index, /app\.v2\.0\.256\.js/);
assert.match(index, /version\.v2\.0\.256\.js/);
assert.match(index, /resizable-tables\.js\?v=2\.0\.256/);
assert.match(sw, /sisventas-v2\.0\.256/);
assert.match(sw, /app\.v2\.0\.256\.js/);
assert.match(app, /VERSION:\s*'v2\.0\.256-firebase'/);
assert.match(core, /SISVENTAS_PWA_VERSION\s*=\s*'v2\.0\.256'/);
assert.match(published, /SISVENTAS_PWA_VERSION\s*=\s*'v2\.0\.256'/);
assert.match(resizable, /function percentagesFromRenderedLayout/);
assert.match(resizable, /savePercentages\(table, finalPercentages\)/);
assert.match(resizable, /sv-grid-column-toolbar/);
assert.doesNotMatch(resizable, /setColumnWidth\(table, index, startWidth/);

console.log('v2.0.256: redimensionado fluido y porcentajes sincronizados');
