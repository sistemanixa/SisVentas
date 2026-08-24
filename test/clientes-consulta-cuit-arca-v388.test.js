const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const server = fs.readFileSync('cloud-functions/emitir-factura/index.js', 'utf8');

test('el legajo consulta el CUIT exclusivamente mediante la función segura', () => {
  assert.match(app, /id="btn-consultar-cuit-arca"/);
  assert.match(app, /accion:'consultar_cuit', cuit:cuit/);
  assert.doesNotMatch(app, /clientes\/afip-info/);
  assert.match(server, /ENDPOINT_INFO_CUIT[^\n]+clientes\/afip-info/);
  assert.match(server, /TFAPP_USERTOKEN\.value\(\)/);
});

test('los datos de ARCA requieren confirmación antes de completar el formulario', () => {
  assert.match(app, /mostrarVistaPreviaCuitArca\(resultado\.datos/);
  assert.match(app, /id="aplicar-datos-cuit-arca"/);
  assert.match(app, /aplicarDatosCuitArca\(datos\)/);
});

test('se conserva trazabilidad de fuente y fecha al guardar el cliente', () => {
  assert.match(app, /fuente:'ARCA vía TusFacturasApp'/);
  assert.match(app, /nuevo\.datosFiscalesFuente = consultaArca\.fuente/);
  assert.match(app, /nuevo\.datosFiscalesConsultadosEn = consultaArca\.consultadoEn/);
});

test('localhost queda habilitado únicamente como origen de prueba', () => {
  assert.match(server, /127\\\.0\\\.0\\\.1\|localhost/);
  assert.match(server, /ventas\.sistemanixa\.com/);
});

