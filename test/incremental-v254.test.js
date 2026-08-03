const assert = require('assert');
const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.254.js', 'utf8');
const tables = fs.readFileSync('js/modules/resizable-tables.js', 'utf8');

assert.match(tables, /var columnSelector = selector \+ ' tr > \*:nth-child\('/);
assert.match(tables, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="range"\]\)/);
assert.match(tables, /columnSelector \+ ' textarea,'/);
assert.match(tables, /columnSelector \+ ' select,'/);
assert.match(tables, /columnSelector \+ ' \[contenteditable="true"\]/);
assert.match(index, /resizable-tables\.js\?v=2\.0\.254/);
assert.match(index, /app\.v2\.0\.254\.js/);
assert.match(index, /version\.v2\.0\.254\.js/);
assert.match(sw, /sisventas-v2\.0\.254/);
assert.match(app, /VERSION:\s*'v2\.0\.254-firebase'/);

console.log('v2.0.254: alineación de controles verificada');
