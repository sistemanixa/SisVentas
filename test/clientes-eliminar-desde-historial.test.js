const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const app = fs.readFileSync('js/app.v2.0.305.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

test('el historial del cliente ofrece una eliminación explícita y reutiliza la confirmación segura', () => {
  assert.match(html, /id="hc-eliminar-cliente"[^>]*>[^<]*<i class="ti ti-trash"><\/i> Eliminar cliente/);
  assert.match(app, /function eliminarClienteDesdeHistorial\(\)[\s\S]{0,180}eliminarCliente\(\{ dataset: \{ cid: clienteActualId \} \}\)/);
  assert.match(app, /if \(!await svConfirm\(msg\)\) return/);
});
