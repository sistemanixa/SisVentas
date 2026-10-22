const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const app = require('./helpers/active-app').readActiveApp().source;
const { functionSource } = require('./helpers/app-functions.cjs');
function env() {
  const elements = {};
  const events = {};
  const c = { console, setTimeout() {}, currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},PERMISOS_ROLES:{admin:{indiceRevision:1}},_svOperacionesSesionEpoch:0,_impersonacionOriginal:null,location:{hash:'#/dashboard'},document: {
    hidden:false,visibilityState:'visible',
    getElementById(id) { return elements[id] ||= {style:{},textContent:'',attrs:{},setAttribute(key,value){this.attrs[key]=String(value);},getAttribute(key){return this.attrs[key]??null;},remove(){delete elements[id];}}; },
    addEventListener(name, fn) { (events[name] ||= []).push(fn); }
  }};
  c.window = c;
  c.tienePermiso = action => ['empleados.autorizarHoras','comisiones.aprobar'].includes(action);
  vm.createContext(c);
  return { c, elements, emit(name) { (events[name] || []).forEach(fn => fn()); } };
}
function loadHoursBadge(c) {
  for(const name of ['svCapturarContextoOperacion','_hsexConsultaPendientes','_hsexVentanaVisible','_hsexContextoLectura','_hsexFilasPendientes','_hsexClaveEmpleadoMes','_hsexConsolidarDetalle','_hsexAgruparPendientes'])vm.runInContext(functionSource(name),c);
  vm.runInContext(app.slice(app.indexOf('var _hsExtraBadgeUnsubscribe'),app.indexOf('function _semestreActual')),c);
}
function configureHoursQuery(c) {
  c.fbDB={};c.fbRef=(_,path)=>({path});c.fbQuery=(ref,...where)=>({...ref,where});c.fbOrderByChild=field=>({orderByChild:field});c.fbEqualTo=value=>({equalTo:value});
}
function assertHoursQuery(reference) {
  assert.equal(reference.path,'sisventas/hsextra_solicitudes');
  assert.deepEqual(JSON.parse(JSON.stringify(reference.where)),[{orderByChild:'estado'},{equalTo:'pendiente'}]);
}
test('horas extra actualizan el menú sin abrir empleados, sin duplicar listeners y limpian al salir', () => {
  const {c,elements,emit} = env();
  let callback, subscriptions=0, stopped=0, notifications=0;
  configureHoursQuery(c);
  c.fbOnValue = (reference,fn) => {assertHoursQuery(reference);subscriptions++;callback=fn;return ()=>stopped++;};
  c.generarNotificaciones = () => notifications++;
  loadHoursBadge(c);
  emit('sisventas:session-ready');
  c.actualizarBadgeHsExtraPendientes();
  assert.equal(subscriptions,1);
  callback({val:()=>({a:{estado:'pendiente',empFbKey:'e1',empNombre:'Ana ficticia',mes:'2026-10',horas:1},b:{estado:'aprobado'}})});
  assert.equal(elements['badge-nav-empleados'].textContent,1);
  const twoGroups={a:{estado:'pendiente',empFbKey:'e1',empNombre:'Ana ficticia',mes:'2026-10',horas:1},b:{estado:'pendiente',empFbKey:'e2',empNombre:'Bea ficticia',mes:'2026-10',horas:2}};
  callback({val:()=>twoGroups});
  assert.equal(elements['badge-nav-empleados'].textContent,2);
  callback({val:()=>({a:{estado:'aprobado'},b:{estado:'rechazado'}})});
  assert.equal(elements['badge-nav-empleados'].textContent,0);
  assert.equal(c._hsExtraBadgeEstado,'ready');
  assert.equal(elements['badge-nav-empleados'].style.display,'none');
  assert.equal(notifications,3);
  const oldCallback=callback;
  emit('sisventas:session-ended');
  assert.equal(stopped,1);
  assert.equal(elements['badge-nav-empleados'].textContent,'');
  assert.equal(elements['badge-nav-empleados'].style.display,'none');
  assert.equal(c._hsExtraBadgeEstado,'inactive');
  assert.deepEqual(JSON.parse(JSON.stringify(c._notificacionesHsExtraPendientes)),[]);
  assert.equal(notifications,4,'Logout also clears previously rendered notifications');
  c.fbAuth.currentUser={uid:'u'};c._svOperacionesSesionEpoch++;
  emit('sisventas:session-ready');
  assert.equal(subscriptions,2);
  callback({val:()=>twoGroups});oldCallback({val:()=>null});
  assert.equal(elements['badge-nav-empleados'].textContent,2);
  assert.equal(c._hsExtraBadgeEstado,'ready');
  emit('sisventas:session-ended');assert.equal(stopped,2);
});

test('un error del badge deja pendientes desconocidos y limpia avisos; sólo una respuesta válida acredita cero',()=>{
  const {c,elements,emit}=env();configureHoursQuery(c);let callback,cancel,subscriptions=0,stopped=0;
  c.fbOnValue=(reference,fn,onError)=>{assertHoursQuery(reference);subscriptions++;callback=fn;cancel=onError;return()=>stopped++;};
  const rendered=[];c.generarNotificaciones=()=>rendered.push(JSON.parse(JSON.stringify(c._notificacionesHsExtraPendientes)));
  loadHoursBadge(c);emit('sisventas:session-ready');callback({val:()=>({a:{estado:'pendiente',empFbKey:'e',mes:'2026-10',horas:1}})});cancel(Error('Fallo ficticio'));
  assert.equal(c._hsExtraBadgeEstado,'error');assert.equal(elements['badge-nav-empleados'].textContent,'');assert.equal(elements['badge-nav-empleados'].style.display,'none');assert.match(elements['badge-nav-empleados'].getAttribute('aria-label'),/sin comprobar/);assert.deepEqual(rendered.at(-1),[]);assert.equal(stopped,1);
  c.actualizarBadgeHsExtraPendientes();assert.equal(subscriptions,2);callback({val:()=>null});assert.equal(c._hsExtraBadgeEstado,'ready');assert.equal(elements['badge-nav-empleados'].textContent,0);emit('sisventas:session-ended');assert.equal(stopped,2);
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
