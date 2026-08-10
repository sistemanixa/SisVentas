const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const raiz = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(raiz, 'js', 'app.v2.0.319.js'), 'utf8');

test('la OT separa la firma del cliente y la del técnico', () => {
  assert.match(html, /id="firma-canvas"/);
  assert.match(html, /id="firma-tecnico-canvas"/);
  assert.match(html, /firmaCambiarPestana\('tecnico'\)/);
  assert.match(html, /firmaEditar\('cliente'\)/);
  assert.match(html, /firmaEditar\('tecnico'\)/);
});

test('una firma guardada se bloquea y se reemplaza mediante una acción explícita', () => {
  assert.match(app, /function firmaAplicarBloqueo\(tipo, bloqueada\)/);
  assert.match(app, /canvas\.dataset\.firmaBloqueada === '1'/);
  assert.match(app, /function firmaEditar\(tipo\)/);
  assert.match(app, /firmaAplicarBloqueo\('cliente', true\)/);
  assert.match(app, /firmaAplicarBloqueo\('tecnico', true\)/);
});

test('el acta usa ambas firmas y un título apto para guardar PDF', () => {
  assert.match(app, /function nombreArchivoActaOT\(ot\)/);
  assert.match(app, /firmaTecnicoUrl = otFirmaTecnicoUrl\(ot\)/);
  assert.match(app, /class="firma-img"/);
  assert.match(app, /margin:0 auto 10px/);
});
