const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {readActiveApp} = require('./helpers/active-app');
const source = fs.readFileSync('js/modules/action-permissions.js', 'utf8');

function fixture(initial = {}) {
  const timers = [], logs = [], events = [];
  const window = {currentRole: 'admin', PERMISOS_ROLES: {admin: {bloqueados: []}}, registrarActividad(action) {logs.push(action);}, ...initial};
  const context = {window, document: {addEventListener() {}, dispatchEvent(event) {events.push(event.type);}, querySelectorAll: () => [], getElementById: () => null},
    console, CustomEvent: class {constructor(type) {this.type = type;}}, setTimeout(callback) {timers.push(callback);}};
  return {window, logs, events, load() {vm.runInNewContext(source, context);}, runTimers() {const batch = timers.splice(0); batch.forEach(callback => callback());}};
}

test('orden real inicializa permisos antes de la aplicación sin activar auditorías diferidas', () => {
  const {index, filename} = readActiveApp();
  const permissions = index.match(/<script\b[^>]*src="\.\/js\/modules\/action-permissions\.js[^\"]*"[^>]*>/)[0];
  const application = index.match(new RegExp('<script\\b[^>]*src="\\./js/' + filename.replace(/\./g, '\\.') + '[^\\"]*"[^>]*>'))[0];
  assert.ok(index.indexOf(permissions) < index.indexOf(application));
  assert.doesNotMatch(permissions + application, /\b(?:async|defer)\b/);
  const f = fixture(); f.load();
  f.window.registrarPago = () => f.window.registrarActividad('Pago registrado');
  f.runTimers(); f.window.registrarPago(); f.runTimers();
  assert.deepEqual(f.logs, ['Pago registrado']);
});

test('carga tardía accidental no declara éxitos tras validaciones o cancelaciones', () => {
  const names = ['confirmarVenta', 'eliminarVenta', 'registrarPago', 'guardarProducto', 'guardarPresupuesto'];
  const f = fixture(Object.fromEntries(names.map(name => [name, () => undefined])));
  f.load(); for (const name of names) f.window[name](); f.runTimers();
  assert.equal(f.logs.length, 0);
});

test('conserva el resultado y un único registro canónico de venta, producto y pago', async () => {
  const f = fixture();
  for (const [name, action] of [['confirmarVenta', 'Venta creada'], ['guardarProducto', 'Producto guardado'], ['registrarPago', 'Pago registrado']]) {
    f.window[name] = () => {f.window.registrarActividad(action); return Promise.resolve(action);};
  }
  f.load();
  for (const name of ['confirmarVenta', 'guardarProducto', 'registrarPago']) await f.window[name]();
  f.runTimers();
  assert.deepEqual(f.logs, ['Venta creada', 'Producto guardado', 'Pago registrado']);
});

test('rechazo conserva la promesa original sin registrar operación ni sesión posterior', async () => {
  const pending = Promise.reject(Error('Guardado rechazado'));
  const f = fixture({guardarPresupuesto: () => pending}); f.load();
  const returned = f.window.guardarPresupuesto(); assert.equal(returned, pending);
  await assert.rejects(returned, /Guardado rechazado/);
  f.window.currentUser = 'Otra cuenta'; f.runTimers(); assert.equal(f.logs.length, 0);
});

test('el retiro de auditorías por reloj conserva la barrera de permisos', () => {
  let called = 0;
  const f = fixture({currentRole: 'tecnico', PERMISOS_ROLES: {tecnico: {bloqueados: ['cobranzas']}}, registrarPago() {called++;}});
  f.load(); assert.equal(f.window.registrarPago(), false); f.runTimers();
  assert.equal(called, 0); assert.equal(f.logs.length, 0);
});

test('la API explícita de auditoría conserva detalles de la operación confirmada', () => {
  const f = fixture(); f.load(); f.window.SisVentas.Audit.registrar('Acción confirmada', 'Detalle');
  assert.deepEqual(f.logs, ['Acción confirmada']);
});
