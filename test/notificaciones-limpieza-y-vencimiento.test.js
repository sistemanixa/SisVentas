const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const notifications = fs.readFileSync('js/modules/notifications.js', 'utf8');
const app = fs.readFileSync('js/app.v3.7.2.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');

assert(html.includes('onclick="limpiarTodasNotificaciones()"'), 'Debe existir Limpiar todo');
assert(html.includes('id="cfg-dias-aviso-venc-ppto" value="1"'), 'La anticipación debe iniciar en un día');
assert(html.includes('notifications.js?v=2.0.272'), 'Debe invalidarse la caché del módulo');
assert(app.includes('diasAvisoVencimientoPresupuesto'), 'La preferencia debe persistirse en Firebase');
assert(app.includes("id: 'ppto_vence_' + p.id"), 'La alerta debe conservar una identidad estable durante la cuenta regresiva');
assert(!app.includes('dias <= 7 && dias > 2'), 'No debe quedar activa la anticipación fija de siete días');
assert(!app.includes('ppto_vence_7:'), 'No debe mostrarse una configuración obsoleta de siete días');

const storage = {};
let confirmText = '';
let remoteBatch = null;
const actionable = { id:'accion', accion:{ fn:'abrir()' } };
const informational = { id:'info' };
const context = {
  console,
  Date,
  Promise,
  localStorage: {
    getItem: key => storage[key] || null,
    setItem: (key, value) => { storage[key] = value; }
  },
  document: {
    visibilityState:'visible',
    documentElement:{},
    getElementById: () => null,
    querySelector: () => null,
    addEventListener: () => {}
  },
  MutationObserver: function(){ this.observe = () => {}; },
  setTimeout: () => 0,
  clearTimeout: () => {},
  setInterval: () => 0,
  addEventListener: () => {},
  obtenerContextoSesionSisVentas: () => ({usuario:'Admin',email:'admin@sistemanixa.com',rol:'admin'}),
  obtenerNotificacionesSisVentas: () => [actionable, informational],
  svConfirm: async text => { confirmText = text; return true; },
  notify: () => {},
  fbDB: {},
  fbRef: (_db, path) => path,
  fbUpdate: async (_ref, values) => { remoteBatch = values; }
};
context.window = context;
vm.runInNewContext(notifications, context);

(async () => {
  await context.limpiarTodasNotificaciones();
  const state = JSON.parse(storage.sv_notif_state_v3_admin_sistemanixa_com);
  assert.strictEqual(state.accion.estado, 'pospuesta', 'Una gestión debe reaparecer mañana');
  assert(state.accion.reaparece, 'La gestión pospuesta debe guardar la fecha de reaparición');
  assert.strictEqual(state.info.estado, 'resuelta', 'Un aviso informativo debe desestimarse');
  assert.strictEqual(state.info.reaparece, null, 'Un aviso desestimado no debe reaparecer');
  assert(confirmText.includes('1 gestión') && confirmText.includes('1 aviso informativo'), 'La confirmación debe explicar el reparto');
  assert(remoteBatch && remoteBatch.accion && remoteBatch.info, 'Los estados deben persistirse juntos en Firebase');
  console.log('notificaciones-limpieza-y-vencimiento.test.js OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
