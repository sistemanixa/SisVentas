const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const app = read('js', 'app.js');
const index = read('index.html');
const sw = read('sw.js');

test('duplicar presupuesto consulta el cliente antes de crear la copia', () => {
  assert.match(app, /¿Para quién es la copia\?/);
  assert.match(app, /Mismo cliente/);
  assert.match(app, /Elegir otro cliente/);
  assert.match(app, /filtrarClientesDuplicadoPpto/);
  assert.match(app, /_cargarDuplicadoPresupuesto\(original, clienteDestino\)/);
});

test('el administrador aprueba al guardar sin enviarse una revisión', () => {
  assert.match(index, /id="btn-guardar-principal-ppto"/);
  assert.match(app, /Aprobar y guardar/);
  assert.match(app, /guardarPresupuesto\('aprobado_int'\)/);
  assert.match(app, /aprobacionDirectaAdmin = currentRole === 'admin'/);
  assert.match(app, /Creado y aprobado directamente por administrador/);
});

test('un presupuesto aprobado por admin expone el paso enviar al cliente', () => {
  assert.match(app, /aprobado_int:\s*\['imprimir','enviar_cliente','modificar_precio'\]/);
  assert.match(app, /enviar_cliente:\s*\{ label:'Enviar al cliente'/);
});

test('la publicacion corresponde a v2.0.238', () => {
  assert.match(app, /VERSION: 'v2\.0\.238-firebase'/);
  assert.match(index, /app\.v2\.0\.238\.js/);
  assert.match(index, /version\.v2\.0\.238\.js/);
  assert.match(sw, /sisventas-v2\.0\.238/);
});
