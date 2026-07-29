const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const index = read('index.html');
const sw = read('sw.js');

test('Firebase sincroniza sin pintar tablas pesadas ocultas', () => {
  assert.match(app, /_svEsPaginaActiva\('clientes'\)[\s\S]{0,180}renderTablaClientes/);
  assert.match(app, /paginaProductosActiva[\s\S]{0,260}renderTablaProductos/);
  assert.match(app, /_svEsPaginaActiva\('actualizadorprecios'\)[\s\S]{0,160}renderModuloActualizadorPrecios/);
});

test('al navegar se descargan filas pesadas sin borrar datos sincronizados', () => {
  assert.match(app, /function _svDescargarVistaPesadaOculta\(id\)/);
  assert.match(app, /productos: \{ tbody: 'prod-tbody'/);
  assert.match(app, /clientes: \{ tbody: 'cli-tbody'/);
  assert.match(app, /_svProgramarDescargaVista\(paginaActualId\)/);
});

test('la navegacion cierra interfaces transitorias sin bloquear su reapertura', () => {
  assert.match(app, /function _svCerrarUITransitoriaAlNavegar\(\)/);
  assert.match(app, /modal\.classList\.remove\('open', 'show', 'active'\)/);
  assert.match(app, /if \(modal\.style\.display && modal\.style\.display !== 'none'\) modal\.style\.display = 'none'/);
});

test('la publicacion corresponde a v2.0.227', () => {
  assert.match(app, /VERSION: 'v2\.0\.227-firebase'/);
  assert.match(index, /app\.v2\.0\.227\.js/);
  assert.match(index, /version\.v2\.0\.227\.js/);
  assert.match(sw, /sisventas-v2\.0\.227/);
});
