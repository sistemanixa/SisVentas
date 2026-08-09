const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.308.js', 'utf8');
const core = fs.readFileSync('js/core/version.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

test('v2.0.308 references the immutable application and version files', () => {
  assert.match(html, /js\/app\.v2\.0\.308\.js/);
  assert.match(html, /js\/core\/version\.v2\.0\.308\.js/);
  assert.match(app, /VERSION:\s*'v2\.0\.308-firebase'/);
  assert.match(core, /v2\.0\.308/);
  assert.match(sw, /sisventas-v2\.0\.308/);
  assert.match(sw, /app\.v2\.0\.308\.js/);
});

test('OT keeps the open action directly accessible on tablet and mobile', () => {
  assert.match(html, /id="ot-tabla" data-sv-keep-primary-action/);
  assert.match(app, /data-sv-keep-primary-action/);
  assert.match(app, /Abrir orden de trabajo/);
  assert.match(app, /accionPrincipal\.classList\.add\('sv-grid-actions-primary'\)/);
});

test('v2.0.308 has a public release-history entry', () => {
  assert.match(app, /version:\s*'v2\.0\.308'[\s\S]{0,600}Órdenes de trabajo accesibles en móvil/);
});
