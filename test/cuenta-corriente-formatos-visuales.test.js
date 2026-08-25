const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/app.js', 'utf8');

test('cuenta corriente conserva centavos y presenta el último pago como dd-mm-aaaa', () => {
  assert.ok(source.includes("d.total.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})"));
  assert.ok(source.includes("d.cobrado.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})"));
  assert.ok(source.includes("saldo.toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2})"));
  assert.ok(source.includes("d.ultimoPago === '—' ? '—' : _mostrarFecha(d.ultimoPago)"));
});
