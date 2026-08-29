const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.v3.0.3.js'), 'utf8');
const version = fs.readFileSync(path.join(root, 'js', 'core', 'version.v3.0.3.js'), 'utf8');
const preview = fs.readFileSync(path.join(root, 'js', 'modules', 'v3-visual-preview.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');

test('la revisión de precios reserva un área vertical desplazable', () => {
  assert.match(app, /class="sv-revision-precios-body"[^>]*min-height:0;flex:1;overflow:hidden/);
  assert.match(app, /id="revision-precios-lista"[^>]*tabindex="0"[^>]*flex:1;min-height:0;overflow:auto/);
  assert.match(css, /#modal-revision-precios #revision-precios-lista\{[^}]*overflow:auto!important/);
});

test('todas las etiquetas visibles consumen la versión central', () => {
  assert.match(version, /window\.SISVENTAS_PWA_VERSION = 'v3\.0\.3'/);
  assert.match(version, /function aplicarVersionSisVentas/);
  assert.match(version, /loading-version/);
  assert.match(version, /login-version-lbl/);
  assert.match(version, /up-version/);
  assert.match(version, /s-version-el/);
  assert.match(preview, /window\.aplicarVersionSisVentas/);
  assert.doesNotMatch(preview, /Vista previa v3\.0\.0/);
  assert.match(index, /id="loading-version" class="sv-boot-version"><\/div>/);
  assert.match(index, /id="login-version-lbl"><\/div>/);
  assert.match(index, /id="up-version"><\/span>/);
  assert.doesNotMatch(app, /upVer\.textContent|vSidebar\.textContent|vEl\.textContent = APP_CONFIG\.VERSION/);
});
