const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

test('el cierre de soporte usa el reclamo abierto y exige una OT finalizada', () => {
  assert.match(app, /var rKey = reclamoKey \|\| SP_MODAL_KEY;/);
  assert.match(app, /onclick="spAbrirResolucionVisita\(\)"/);
  assert.match(app, /!otEstaCerrada\(ot\)/);
});

test('la resolución permite cobrar o bonificar solamente la mano de obra', () => {
  assert.match(app, /value="bonificada" checked/);
  assert.match(app, /value="cobrada"/);
  assert.match(app, /item\.disc = bonificada \? 100 : 0/);
  assert.match(app, /bonificadoPostVenta/);
  assert.match(app, /manoObraPostVenta/);
});
