const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.299.js', 'utf8');
const css = fs.readFileSync('css/app.css', 'utf8');

test('gastos adelantados por el técnico son haberes y no cargos', () => {
  assert.match(app, /return \['adelanto','cargo'\]\.includes\(tipo\)/);
  assert.match(app, /TIPOS_HABER = \['sueldo','aguinaldo','comision','hextra','transporte','materiales','gasto_empresa','otro'\]/);
});

test('los iconos de fecha usan un contraste adecuado en modo oscuro', () => {
  assert.match(css, /input\[type="date"\]::-webkit-calendar-picker-indicator/);
  assert.match(css, /body\.dark-mode input::-webkit-calendar-picker-indicator\{filter:invert\(1\) brightness\(1\.12\);opacity:1\}/);
});
