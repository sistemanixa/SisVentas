const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const match = source.match(/function _mostrarFecha\(f\) \{[\s\S]*?\n\}/);

test('el formateador visual global usa dd-mm-aaaa sin alterar la fecha guardada', () => {
  assert.ok(match, 'Debe existir el formateador global de fechas');
  const context = {};
  vm.createContext(context);
  vm.runInContext(match[0], context);
  assert.equal(context._mostrarFecha('2026-09-03'), '03-09-2026');
  assert.equal(context._mostrarFecha('3/9/2026'), '03-09-2026');
  assert.equal(context._mostrarFecha('18/08/2026 12:30'), '18-08-2026');
});

test('la grilla de presupuestos pasa el vencimiento por el formateador global', () => {
  assert.match(source, /<td>\$\{escapeHTML\(_mostrarFecha\(p\.vence\)\)\}<\/td>/);
});
