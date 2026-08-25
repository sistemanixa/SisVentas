const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/app.js', 'utf8');

test('el total visible de cada venta conserva exactamente dos decimales', () => {
  assert.match(
    source,
    /parseFloat\(v\.total\)\|\|0\)\.toLocaleString\('es-AR',\{minimumFractionDigits:2,maximumFractionDigits:2\}\)/
  );
  assert.equal((27663.4).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), '27.663,40');
});
