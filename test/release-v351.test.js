const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('v2.0.351 publica el mismo código activo y versionado', () => {
  const app = read('js/app.js');
  const index = read('index.html');
  assert.equal(read('js/app.v2.0.351.js'), app);
  assert.match(app, /VERSION: 'v2\.0\.351-firebase'/);
  assert.match(index, /app\.v2\.0\.351\.js/);
  assert.match(index, /version\.v2\.0\.351\.js/);
  assert.match(read('js/core/version.v2.0.351.js'), /v2\.0\.351/);
  assert.match(read('sw.js'), /sisventas-v2\.0\.351/);
});

test('la respuesta textual del facturador se transforma en datos fiscales persistibles', () => {
  const app = read('js/app.js');
  assert.match(app, /function _extraerNumeroFiscalDesdeTexto/);
  assert.match(app, /var camposTexto = \['rta', 'mensaje', 'message', 'detalle', 'descripcion'\]/);
  assert.match(app, /parche\.datosFiscalesCapturadosDe = 'respuesta-emision'/);
  assert.match(app, /parche\.cae_vencimiento = caeVencimiento/);
  assert.match(app, /parche\.afip_qr = qrFiscal/);

  const start = app.indexOf('function _normalizarNumeroFiscalFactura');
  const end = app.indexOf('async function confirmarEmisionFactura', start);
  const context = { Date, decodeURIComponent, atob: (value) => Buffer.from(value, 'base64').toString('binary') };
  vm.runInNewContext(app.slice(start, end), context);
  const qrPayload = Buffer.from(JSON.stringify({
    ver: 1,
    fecha: '2026-08-16',
    ptoVta: 3,
    tipoCmp: 1,
    nroCmp: 6,
    importe: 4992013.49,
    moneda: 'PES',
    ctz: 1,
    codAut: 86338598852933
  })).toString('base64');
  const patch = context._parcheFacturaDesdeRespuestaApi({
    rta: 'El comprobante FACTURA A 00003-00000006 fue autorizado correctamente',
    vencimiento_cae: '26/08/2026',
    afip_qr: 'https://www.afip.gob.ar/fe/qr/?p=' + encodeURIComponent(qrPayload)
  }, {}, 3);
  assert.equal(patch.numero, '00003-00000006');
  assert.equal(patch.importe_total, 4992013.49);
  assert.equal(patch.cae, '86338598852933');
  assert.equal(patch.fecha, '2026-08-16');
  assert.equal(patch.cae_vencimiento, '26/08/2026');
});

test('la recuperación histórica se realiza por coincidencia exacta de CAE', () => {
  const app = read('js/app.js');
  assert.match(app, /function recuperarDatosFiscalesFactura/);
  assert.match(app, /_normalizarCaeFactura\(comprobante\.cae \|\| comprobante\.codigoAutorizacion\) === caeBuscado/);
  assert.match(app, /datosFiscalesRecuperadosDe: 'comprobantes-emitidos'/);
});
