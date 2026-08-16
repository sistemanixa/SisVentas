const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('js/app.js');
const index = read('index.html');

test('presupuesto y venta permiten abrir la ficha del cliente', () => {
  assert.match(index, /id="ppto-det-cliente"[^>]+onclick="abrirClienteDesdeDocumento\('presupuesto',pptoActualId\)"/);
  assert.match(app, /class="sv-document-client-link" onclick="abrirClienteDesdeDocumento\(\\'venta\\'/);
  assert.match(app, /var ventaClienteDocumentoRef = jsStringAttr\(v\.fbKey \|\| v\.id \|\| ''\)/);
});

test('la navegación resuelve la clave interna y abre el historial unificado', () => {
  assert.match(app, /function abrirClienteDesdeDocumento\(tipo, referencia\)/);
  assert.match(app, /var cliente = _svResolverClienteDocumento\(registro\)/);
  assert.match(app, /var clave = cliente && \(cliente\.fbKey \|\| cliente\.id\)/);
  assert.match(app, /svNavegarDirecto\('clientes', abrirFicha/);
  assert.match(app, /verHistorialCliente\(clave, cliente\.nombre \|\| registro\.cliente \|\| ''\)/);
});

test('un documento histórico por nombre sólo abre una coincidencia única', () => {
  assert.match(app, /function _svResolverClienteDocumento\(reg\)/);
  assert.match(app, /if \(refs\.length\) return _svResolverClienteRegistro\(reg, false\)/);
  assert.match(app, /return coincidencias\.length === 1 \? coincidencias\[0\] : null/);

  const start = app.indexOf('function _svResolverClienteDocumento');
  const end = app.indexOf('function abrirClienteDesdeDocumento', start);
  const context = {
    clientesData: [{ fbKey:'a', nombre:'Cliente repetido' }, { fbKey:'b', nombre:'Cliente repetido' }, { fbKey:'c', nombre:'Cliente único' }],
    _svTxtClave: (value) => String(value || '').trim().toLowerCase(),
    _svTxtNombre: (value) => String(value || '').trim().toLowerCase(),
    _svResolverClienteRegistro: (reg) => context.clientesData.find((cli) => cli.fbKey === reg.clienteFbKey) || null,
    Object
  };
  vm.runInNewContext(app.slice(start, end), context);
  assert.equal(context._svResolverClienteDocumento({ cliente:'Cliente único' }).fbKey, 'c');
  assert.equal(context._svResolverClienteDocumento({ cliente:'Cliente repetido' }), null);
  assert.equal(context._svResolverClienteDocumento({ clienteFbKey:'b', cliente:'Otro nombre' }).fbKey, 'b');
});

test('v2.0.350 publica el mismo código activo y versionado', () => {
  assert.match(index, /VERSION: 'v2\.0\.350-firebase'/);
  assert.match(index, /js\/app\.v2\.0\.350\.js/);
  assert.equal(read('js/app.v2.0.350.js'), app);
  assert.match(read('js/core/version.v2.0.350.js'), /v2\.0\.350/);
  assert.match(read('sw.js'), /sisventas-v2\.0\.350/);
});
