const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('el control integral se colapsa solo en móvil y puede abrirse manualmente', () => {
  assert.match(html, /class="ot-integridad-contenido"/);
  assert.match(html, /onclick="otAlternarIntegridad\(\)"/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*#ot-integridad-card \.ot-integridad-contenido\{display:none\}/);
  assert.match(css, /#ot-integridad-card\.is-open \.ot-integridad-contenido\{display:block\}/);
  assert.match(app, /function otAlternarIntegridad\(\)/);
});
