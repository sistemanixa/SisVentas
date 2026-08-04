const assert = require('assert');
const fs = require('fs');

const index = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const app = fs.readFileSync('js/app.v2.0.253.js', 'utf8');

assert.match(index, /<thead><tr><th>Cargo<\/th>/);
assert.match(index, /<tbody id="cargos-tbody"><\/tbody>/);
assert.match(app, /var tbody = document\.getElementById\('cargos-tbody'\)/);
assert.match(app, /tbody\.innerHTML = ''/);
assert.match(app, /tbody\.appendChild\(tr\)/);
assert.match(app, /prepararTarjetasMovilesGrilla\(tbl\)/);
assert.match(css, /#cargos-tbl\.sv-mobile-card-grid tbody > tr > td:first-child/);
assert.match(css, /@media\(max-width:900px\)/);
assert.match(index, /app\.v2\.0\.253\.js/);
assert.match(index, /version\.v2\.0\.253\.js/);
assert.match(sw, /sisventas-v2\.0\.253/);
assert.match(app, /VERSION:\s*'v2\.0\.253-firebase'/);

console.log('v2.0.253: cargos adaptables verificados');
