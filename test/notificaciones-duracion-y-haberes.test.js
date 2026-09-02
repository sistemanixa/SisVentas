const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.v3.2.5.js'), 'utf8');

test('los avisos inferiores duran ocho segundos por defecto y aceptan una duración explícita', () => {
  assert.match(app, /function notify\(msg, duracionMs\)/);
  assert.match(app, /if \(!\(tiempoVisible > 0\)\) tiempoVisible = 8000/);
  assert.match(app, /setTimeout\(function\(\) \{ n\.classList\.remove\('show'\); \}, tiempoVisible\)/);
});

test('el aviso mensual identifica a los empleados sin haberes', () => {
  assert.match(app, /var nombresPendientes = sinRegistrar\.map/);
  assert.match(app, /' \(' \+ detallePendientes \+ '\)\. '/);
  assert.match(app, /notify\(msg \+ 'Ir a Empleados → Registrar haberes del mes\.', 8000\)/);
});
