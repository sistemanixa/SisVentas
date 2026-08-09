const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('js/app.v2.0.307.js', 'utf8');
const core = fs.readFileSync('js/core/version.js', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');

test('v2.0.307 references the immutable application and version files', () => {
  assert.match(html, /js\/app\.v2\.0\.307\.js/);
  assert.match(html, /js\/core\/version\.v2\.0\.307\.js/);
  assert.match(app, /VERSION:\s*'v2\.0\.307-firebase'/);
  assert.match(core, /v2\.0\.307/);
  assert.match(sw, /sisventas-v2\.0\.307/);
  assert.match(sw, /app\.v2\.0\.307\.js/);
});

test('v2.0.307 has a public release-history entry', () => {
  assert.match(app, /version:\s*'v2\.0\.307'[\s\S]{0,600}Mercado Libre: precios promocionales correctos/);
});
