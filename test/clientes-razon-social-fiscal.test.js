const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'cloud-functions', 'emitir-factura', 'index.js'), 'utf8');

test('clientes guardan razón social como dato independiente del nombre comercial', () => {
  assert.match(app, /id:'nc-cuit'[\s\S]{0,180}id:'nc-razon-social'/);
  assert.match(app, /razonSocial:\s*String\(obj\['razon-social'\]/);
  assert.match(app, /'nc-razon-social':\s*cli\.razonSocial/);
});

test('factura A exige CUIT y razón social en navegador y servidor', () => {
  assert.match(app, /tipoComprobante === 'FACTURA A' && !razonSocialResuelta/);
  assert.match(server, /comprobante A la requiere obligatoriamente/);
});

test('el servidor fiscal prioriza la razón social y no el nombre común', () => {
  assert.match(server, /razon_social:\s*razonSocialFiscal \|\| venta\.cliente \|\| 'Consumidor Final'/);
});
