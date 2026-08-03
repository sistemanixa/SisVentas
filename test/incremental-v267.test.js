const fs = require('fs');
const assert = require('assert');

const index = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.267.js', 'utf8');

assert(index.includes('app.v2.0.267.js'));
assert(app.includes('productosRevisionKeys'));
assert(app.includes('totalAutomatizablesRevision'));
assert(app.includes('totalGestionManualRevision'));
assert(!app.includes("productos.length-Object.keys(compatiblesKeys).length"));
assert(app.includes("VERSION: 'v2.0.267-firebase'"));

console.log('v2.0.267: KPIs de revisión calculados sobre el mismo universo');
