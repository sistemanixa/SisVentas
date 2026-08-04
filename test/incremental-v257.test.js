const assert = require('assert');
const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.257.js', 'utf8');
const core = fs.readFileSync('js/core/version.v2.0.257.js', 'utf8');
const published = fs.readFileSync('js/core/version.js', 'utf8');
const rowOrder = fs.readFileSync('js/modules/item-row-order.js', 'utf8');

assert.match(index, /VERSION: 'v2\.0\.257-firebase'/);
assert.match(index, /app\.v2\.0\.257\.js/);
assert.match(index, /item-row-order\.js\?v=2\.0\.257/);
assert.match(sw, /sisventas-v2\.0\.257/);
assert.match(sw, /item-row-order\.js/);
assert.match(app, /VERSION:\s*'v2\.0\.257-firebase'/);
assert.match(app, /orden:itemIndex \+ 1/);
assert.match(app, /orden: itemIndex \+ 1/);
assert.match(app, /function ordenarItemsComerciales/);
assert.match(core, /SISVENTAS_PWA_VERSION\s*=\s*'v2\.0\.257'/);
assert.match(published, /SISVENTAS_PWA_VERSION\s*=\s*'v2\.0\.257'/);
assert.match(rowOrder, /data-item-move="up"/);
assert.match(rowOrder, /data-item-move="down"/);
assert.match(rowOrder, /dragstart/);
assert.match(rowOrder, /BODY_IDS = \['det-body', 'pp-body'\]/);

console.log('v2.0.257: reordenamiento persistente de ítems en presupuestos y ventas');
