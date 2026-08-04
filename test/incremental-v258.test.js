const assert = require('assert');
const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.258.js', 'utf8');
const moduleCode = fs.readFileSync('js/modules/item-row-order.js', 'utf8');

assert.match(index, /VERSION: 'v2\.0\.258-firebase'/);
assert.match(index, /item-row-order\.js\?v=2\.0\.258/);
assert.match(app, /VERSION:\s*'v2\.0\.258-firebase'/);
assert.match(moduleCode, /document\.addEventListener\('click'/);
assert.match(moduleCode, /document\.addEventListener\('dragstart'/);
assert.doesNotMatch(moduleCode, /controls\.addEventListener\('click'/);

console.log('v2.0.258: controles de orden delegados y resistentes al render responsive');
