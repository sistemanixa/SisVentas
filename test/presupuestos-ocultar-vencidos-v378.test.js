const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('los presupuestos vencidos se ocultan por defecto', () => {
  assert.match(html, /id="ppto-mostrar-vencidos"/);
  assert.match(html, />\s*Mostrar vencidos\s*</);
  assert.doesNotMatch(html, /id="ppto-mostrar-vencidos"[^>]*checked/);
  assert.match(app, /!mostrarVencidos && filtroEstado !== 'vencido'/);
  assert.match(app, /p\.estado !== 'vencido'/);
});

test('el check conserva la búsqueda y el filtro de estado actuales', () => {
  assert.match(html, /id="ppto-buscar"/);
  assert.match(app, /function actualizarFiltroPptoVencidos/);
  assert.match(app, /document\.getElementById\('filtro-estado-ppto'\)/);
  assert.match(app, /document\.getElementById\('ppto-buscar'\)/);
});
