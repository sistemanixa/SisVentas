const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.311.js', 'utf8');

test('el actualizador ofrece detener y mostrar resultados durante el análisis', () => {
  assert.match(app, /function detenerActualizadorMasivoPrecios\(\)/);
  assert.match(app, /btn-detener-actualizador/);
  assert.match(app, /Detener análisis/);
  assert.match(app, /btn-resultados-actualizador/);
  assert.match(app, /Mostrar resultados/);
  assert.match(app, /modal\._abortController\.abort\(\)/);
});

test('los resultados parciales y los ya recibidos al detenerse se conservan para revisión', () => {
  assert.match(app, /Resultados parciales — todavía no se guardó nada/);
  assert.match(app, /Resultados detenidos — todavía no se guardó nada/);
  assert.match(app, /actualizadorItemsSesionParaTipos\(_actualizadorSesionPrecios\.fallos/);
});
