const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'cloud-functions', 'emitir-factura', 'index.js'), 'utf8');

test('la nota de crédito no permite editar el comprobante asociado', () => {
  const inicio = app.indexOf('async function abrirModalNotaCredito');
  const fin = app.indexOf('async function emitirNotaCredito', inicio);
  const modal = app.slice(inicio, fin);
  assert.doesNotMatch(modal, /id="nc-nro-comp"/);
  assert.match(modal, /Comprobante asociado/);
  assert.match(modal, /Identidad fiscal confirmada por SisVentas/);
});

test('la emisión usa el número del snapshot fiscal y el servidor exige asociación completa', () => {
  const inicio = app.indexOf('async function emitirNotaCredito');
  const fin = app.indexOf('function _blobPdfDesdeDataUrl', inicio);
  const emision = app.slice(inicio, fin);
  assert.match(emision, /var nroComp = parseInt\(snapshot\.numero, 10\)/);
  assert.doesNotMatch(emision, /nc-nro-comp/);
  assert.match(server, /La nota de crédito no tiene una factura original identificada completamente/);
});

test('el comprobante separa imprimir de descargar PDF y usa el título como archivo', () => {
  const inicio = app.indexOf('function imprimirVentaActual');
  const fin = app.indexOf('function abrirModalNuevo', inicio);
  const comprobante = app.slice(inicio, fin);
  assert.match(comprobante, />Imprimir<\/button>/);
  assert.match(comprobante, />Guardar PDF<\/button>/);
  assert.match(comprobante, /document\.title\|\|"Comprobante"/);
  assert.match(comprobante, /html2pdf\(\).*\.save\(\)/);
  assert.doesNotMatch(comprobante, />Imprimir \/ Guardar PDF<\/button>/);
});

test('la hoja crece con el contenido hasta el máximo del área de trabajo', () => {
  const inicio = app.indexOf('function imprimirVentaActual');
  const fin = app.indexOf('function abrirModalNuevo', inicio);
  const comprobante = app.slice(inicio, fin);
  assert.match(comprobante, /#sisventas-area-trabajo\{[^}]*height:auto;max-height:calc\(100vh - 24px\);overflow:auto/);
  assert.match(comprobante, /#sisventas-area-trabajo\{width:auto;max-height:none;overflow:visible;box-shadow:none/);
  assert.match(comprobante, /id="sisventas-comprobante-pdf"/);
});
