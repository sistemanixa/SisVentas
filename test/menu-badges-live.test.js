const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = require('./helpers/active-app').readActiveApp().source;
function env() {
  const elements = {};
  const events = {};
  const c = { console, setTimeout() {}, document: {
    getElementById(id) { return elements[id] ||= {style:{},textContent:''}; },
    addEventListener(name, fn) { (events[name] ||= []).push(fn); }
  }};
  c.window = c;
  c.tienePermiso = () => true;
  vm.createContext(c);
  return { c, elements, emit(name) { (events[name] || []).forEach(fn => fn()); } };
}
test('horas extra actualizan el menú sin abrir empleados, sin duplicar listeners y limpian al salir', () => {
  const {c,elements,emit} = env();
  let callback, subscriptions=0, stopped=0, notifications=0;
  c.fbDB = {};
  c.fbRef = (_, p) => p;
  c.fbOnValue = (_, fn) => {subscriptions++;callback=fn;return ()=>stopped++;};
  c._hsexAgruparPendientes = rows => rows.map(r=>({id:r.fbKey}));
  c.generarNotificaciones = () => notifications++;
  vm.runInContext(app.slice(app.indexOf('var _hsExtraBadgeUnsubscribe'), app.indexOf('function _semestreActual')), c);
  emit('sisventas:session-ready');
  c.actualizarBadgeHsExtraPendientes();
  assert.equal(subscriptions,1);
  callback({val:()=>({a:{estado:'pendiente'},b:{estado:'aprobado'}})});
  assert.equal(elements['badge-nav-empleados'].textContent,1);
  callback({val:()=>({a:{estado:'pendiente'},b:{estado:'pendiente'}})});
  assert.equal(elements['badge-nav-empleados'].textContent,2);
  callback({val:()=>({a:{estado:'aprobado'},b:{estado:'rechazado'}})});
  assert.equal(elements['badge-nav-empleados'].style.display,'none');
  assert.equal(notifications,3);
  emit('sisventas:session-ended');
  assert.equal(stopped,1);
  emit('sisventas:session-ready');
  assert.equal(subscriptions,2);
});
test('comisiones cuentan ventas pendientes en segundo plano sin renderizar ni migrar registros', () => {
  const {c,elements,emit} = env();
  c.gastosData = [
    {tipoPagable:'comision',ventaId:'v1',estado:'pendiente_aprobacion'},
    {tipoPagable:'comision',ventaId:'v1',estado:'pendiente_aprobacion'},
    {tipoPagable:'comision',ventaId:'v2',estado:'pagado'},
    {tipoPagable:'compra',ventaId:'v3',estado:'pendiente_aprobacion'}
  ];
  c.sincronizarComisionesLegacyConModulo = () => { throw Error('No migrar al actualizar contador'); };
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/modules/commissions.js'),'utf8'),c);
  assert.equal(elements['badge-nav-comisiones'].textContent,1);
  c.gastosData[2].estado='pendiente_aprobacion';
  c.actualizarBadgeComisiones();
  assert.equal(elements['badge-nav-comisiones'].textContent,2);
  c.tienePermiso=()=>false;
  c.actualizarBadgeComisiones();
  assert.equal(elements['badge-nav-comisiones'].style.display,'none');
  emit('sisventas:session-ended');
  assert.equal(elements['badge-nav-comisiones'].textContent,'0');
});
