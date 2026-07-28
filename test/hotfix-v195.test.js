const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const appVersionada = fs.readFileSync(path.join(root, 'js', 'app.v2.0.207.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');

test('producción carga exactamente el código validado de v2.0.207', () => {
  assert.equal(appVersionada, app);
  assert.match(index, /js\/app\.v2\.0\.207\.js/);
  assert.match(index, /js\/core\/version\.v2\.0\.207\.js/);
});

test('la firma se respalda primero en la OT y Storage queda en segundo plano', () => {
  assert.match(app, /La confirmación de la OT no debe depender de Storage/);
  assert.match(app, /firmaGuardarEnOT\(dataUrl, null, otFirmaId\)/);
  assert.match(app, /firmaGuardarEnOT\(url, path, otFirmaId, \{ silencioso:true \}\)/);
  assert.match(app, /sisventas\/ots\/.*\/firma\//);
  assert.match(app, /var conformidadFirma = conformidadActual \|\| 'conforme'/);
  assert.match(app, /function firmaGuardarAhora\(/);
  assert.match(app, /function firmaCancelarEspera\(/);
  assert.match(app, /_firmaGuardadoPendiente \|\| _firmaGuardarTimer/);
  assert.match(index, /id="firma-guardar-btn"/);
  assert.match(index, /id="firma-cancelar-btn"/);
  assert.match(app, /FIRMA_AUTOGUARDADO_ESPERA_MS = 4000/);
  assert.match(app, /Guardado automático en 4 segundos/);
  assert.match(app, /getImageData\(0, 0, canvas\.width, canvas\.height\)/);
  assert.match(index, /id="firma-guardar-btn"[^>]*display:none/);
});

test('las grillas porcentuales conservan ancho legible en celular', () => {
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /table\.sv-resizable-table\.sv-percent-table:not\(#gas-tbl\)/);
  assert.match(css, /min-width:760px!important/);
});

test('garantías reúne registros manuales y coberturas de equipos instalados', () => {
  assert.match(app, /function _garantiasDesdeEquipos\(/);
  assert.match(app, /function _listaGarantiasUnificada\(/);
  assert.match(app, /origen: 'equipo_instalado'/);
  assert.match(app, /renderGarantiasUnificadas\(\)/);
  assert.match(app, /abrirEquipoDesdeGarantia/);
  assert.match(app, /if \(!clavesManuales\.has\(_garantiaClaveComparable\(g\)\)\) manuales\.push\(g\)/);
});

test('el actualizador filtra por checks y Mercado Libre no integra la selección inicial', () => {
  assert.match(app, /data-actualizador-proveedor/);
  assert.match(app, /seleccionados\.includes\(item\.tipo\)/);
  assert.match(app, /return \['biosegur', 'free_electron', 'tecnoprices'\];/);
  assert.doesNotMatch(app, /return \['biosegur', 'free_electron', 'tecnoprices', 'mercado_libre'\];/);
});
