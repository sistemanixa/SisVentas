const assert = require('assert');
const fs = require('fs');

const css = fs.readFileSync('css/app.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.248.js', 'utf8');

assert.match(css, /@media\s*\(min-width:901px\)\s*and\s*\(max-width:1100px\)\s*\{/);
assert.doesNotMatch(css, /\(min-width:901px\)\s*and\s*\(max-width:1100px\)\s*and\s*\(orientation:landscape\)/);
assert.match(index, /css\/app\.css\?v=2\.0\.248/);
assert.match(index, /app\.v2\.0\.248\.js/);
assert.match(index, /version\.v2\.0\.248\.js/);
assert.match(sw, /sisventas-v2\.0\.248/);
assert.match(app, /VERSION:\s*'v2\.0\.248-firebase'/);

console.log('v2.0.248: rango tablet estable verificado');
