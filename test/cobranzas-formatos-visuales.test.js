const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/app.js', 'utf8');

test('el historial de cobranzas presenta fecha y pesos con el formato visual común', () => {
  assert.ok(source.includes("escapeHTML(_mostrarFecha(p.fecha||''))"));
  assert.match(source, /montoARS\.toLocaleString\('es-AR',\{minimumFractionDigits:2,maximumFractionDigits:2\}\)/);
  assert.match(source, /saldo\.toLocaleString\('es-AR',\{minimumFractionDigits:2,maximumFractionDigits:2\}\)/);
});
