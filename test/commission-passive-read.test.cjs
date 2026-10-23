'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {load} = require('./helpers/app-functions.cjs');
const source = fs.readFileSync('js/modules/commissions.js', 'utf8');

function setup(records = []) {
 const elements = new Map();
 const el = id => {
  if (!elements.has(id)) elements.set(id, {id, style:{}, dataset:{}, innerHTML:'', textContent:'', value:'', disabled:false});
  return elements.get(id);
 };
 const calls = {migration:0, reload:0, gets:[], writes:[], approved:[], rejected:[], navigation:[]};
 const events = new Map(), timers = [];
 const container = {parentNode:{insertBefore(node) { elements.set(node.id,node); }}};
 const document = {
  getElementById(id) {
   if(id==='page-comisiones')return {classList:{contains:()=>true}};
   if(id==='comisiones-cuentas-anteriores')return elements.get(id)||null;
   if(id==='comisiones-tbl')return {closest:()=>container};
   return el(id);
  },
  createElement() { const node={style:{},innerHTML:'',remove(){elements.delete(node.id);}};return node; },
  addEventListener(name,fn) { if (!events.has(name)) events.set(name,[]); events.get(name).push(fn); },
  querySelectorAll:()=>[], querySelector:()=>null
 };
 const window = {
  currentUser:'Administrador ficticio',currentUserUid:'fixture-admin',currentRole:'admin',
  gastosData:structuredClone(records), empData:{}, ventasList:[], APROBACION_CONFIG:{maxComisionPct:10},
  tienePermiso:()=>true,permisoModulo:()=>true,fbDB:{},fbRef:(_,p)=>p,
  svNavegarDirecto:id=>{calls.navigation.push(id);return true;},
  fbGet:async p=>{calls.gets.push(p);return {val:()=>({})};},
  fbUpdate:async(...args)=>{calls.writes.push(args);},fbSet:async(...args)=>{calls.writes.push(args);},
  sincronizarComisionesLegacyConModulo:async()=>{calls.migration++;return 2;},
  fbCargarGastos:()=>{calls.reload++;},notify(){},
  aprobarComisionDesdeGasto:async key=>{calls.approved.push(key);},
  rechazarComisionDesdeGasto:async key=>{calls.rejected.push(key);}
 };
 const context = {window,document,console,setTimeout(fn){timers.push(fn);return timers.length;}};
 vm.createContext(context);vm.runInContext(source,context);
 return {window,calls,el,events,timers,context};
}
const fixture = (key,changes={}) => ({fbKey:key,tipoPagable:'comision',ventaFbKey:'fixture-sale',ventaId:'VENTA FICTICIA',fecha:'2026-10-12',empleadoFbKey:key,empleadoNombre:'Persona '+key,monto:50,pct:5,gananciaBase:1000,estado:'pendiente_aprobacion',...changes});

test('Abrir y redibujar Comisiones no ejecuta migraciones, GET amplios ni escrituras', async()=>{
 const h=setup([fixture('a')]);
 h.window.renderModuloComisiones();h.window.renderModuloComisiones();
 for(const tick of h.timers.splice(0))tick();
 await Promise.resolve();await Promise.resolve();
 assert.equal(h.calls.migration,0);
 assert.equal(h.calls.reload,0);
 assert.deepEqual(h.calls.gets,[]);assert.deepEqual(h.calls.writes,[]);
 assert.match(h.el('comisiones-tbody').innerHTML,/VENTA FICTICIA/);
});

test('Gastos modernos y migrados conservan importes, pagos, autoría y base original',async()=>{
 const records=[fixture('a'),fixture('b',{legacyKey:'ctaemp/fixture-e/old-move',origenLegacy:'ctaemp',pct:4,monto:40,gananciaBase:1000,estado:'pagado',montoPagado:40,pagos:{p:{monto:40,fecha:'2026-10-13'}},aprobadoPor:'Persona original',aprobadoTs:1000})];
 const h=setup(records),before=JSON.stringify(h.window.gastosData);
 h.window.renderModuloComisiones();
 await h.window.abrirDetalleComision('fixture-sale');
 assert.equal(JSON.stringify(h.window.gastosData),before);
 assert.match(h.el('com-det-participantes').innerHTML,/data-gasto="b"[^]*?value="4" disabled/);
 assert.match(h.el('com-det-participantes').innerHTML,/data-base="1000"/);
 assert.deepEqual(h.calls.gets,['sisventas/ctaemp/fixture-e/old-move']);
 assert.deepEqual(h.calls.writes,[]);
});

test('Aprobar y rechazar participaciones existentes conservan sus acciones explícitas',async()=>{
 const h=setup([fixture('a')]);
 h.window.renderModuloComisiones();
 await h.window.aprobarComisionGestion('a');
 await h.window.rechazarComisionGestion('a');
 assert.deepEqual(h.calls.approved,['a']);assert.deepEqual(h.calls.rejected,['a']);
 assert.deepEqual(h.calls.writes,[]);
});

test('Terminar y comenzar sesión no convierte el render posterior en migración',async()=>{
 const h=setup([fixture('a')]);
 h.window.renderModuloComisiones();
 for(const fn of h.events.get('sisventas:session-ended')||[])fn();
 h.window.currentUserUid='fixture-other';
 for(const fn of h.events.get('sisventas:session-ready')||[])fn();
 h.window.renderModuloComisiones();await Promise.resolve();await Promise.resolve();
 assert.equal(h.calls.migration,0);assert.equal(h.calls.reload,0);
 assert.deepEqual(h.calls.gets,[]);assert.deepEqual(h.calls.writes,[]);
});

test('El acceso al histórico es explícito y vuelve a comprobar módulo y acción al pulsarlo',()=>{
 const h=setup([fixture('a')]);h.window.renderModuloComisiones();
 assert.match(h.el('comisiones-cuentas-anteriores').innerHTML,/Las comisiones anteriores sin incorporar/);
 assert.match(h.el('comisiones-cuentas-anteriores').innerHTML,/Ver cuentas/);
 assert.deepEqual(h.calls.navigation,[]);
 assert.equal(h.window.verCuentasAnterioresComisiones(),true);
 assert.deepEqual(h.calls.navigation,['ctaemp']);
 h.window.permisoModulo=()=>false;
 assert.equal(h.window.verCuentasAnterioresComisiones(),false);
 assert.deepEqual(h.calls.navigation,['ctaemp']);
 h.window.renderModuloComisiones();
 assert.doesNotMatch(h.el('comisiones-cuentas-anteriores').innerHTML,/Ver cuentas/);
 h.window.permisoModulo=()=>true;
 h.window.tienePermiso=p=>p!=='empleados.verCuentas';
 assert.equal(h.window.verCuentasAnterioresComisiones(),false);
 assert.deepEqual(h.calls.navigation,['ctaemp']);
});

test('El aviso no se crea fuera de Comisiones ni para quien no tiene mantenimiento',()=>{
 const h=setup([fixture('a')]);
 assert.equal(h.context.document.getElementById('comisiones-cuentas-anteriores'),null);
 h.window.tienePermiso=p=>p!=='mantenimiento.normalizar';
 h.window.renderModuloComisiones();
 assert.equal(h.context.document.getElementById('comisiones-cuentas-anteriores'),null);
 assert.equal(h.window.verCuentasAnterioresComisiones(),false);
 assert.deepEqual(h.calls.navigation,[]);
 assert.equal(h.calls.migration,0);assert.deepEqual(h.calls.gets,[]);assert.deepEqual(h.calls.writes,[]);
});

test('Un movimiento sólo legacy no se convierte en gasto ni se suma como un registro moderno',()=>{
 const legacy={fbKey:'fixture-old',tipo:'comision',monto:123.45,pct:3.5,gananciaBase:3527.142857,estado:'pagado_parcial',montoPagado:50,pagos:{p:{monto:50,fecha:'2026-10-12'}},aprobadoPor:'Actor original',aprobadoTs:1000};
 const h=setup([]);h.window.movsEmpData=[structuredClone(legacy)];
 const before=JSON.stringify(h.window.movsEmpData);
 h.window.renderModuloComisiones();
 assert.equal(JSON.stringify(h.window.movsEmpData),before);
 assert.equal(h.window.gastosData.length,0);
 assert.match(h.el('comisiones-tbody').innerHTML,/No hay comisiones para estos filtros/);
 assert.match(h.el('com-kpi-total-sub').textContent,/^0 comisiones/);
 assert.match(h.el('comisiones-cuentas-anteriores').innerHTML,/Cuentas de empleados/);
 assert.equal(h.calls.migration,0);assert.deepEqual(h.calls.gets,[]);assert.deepEqual(h.calls.writes,[]);
});

test('Consultar la cuenta del empleado conserva el movimiento legacy con una lectura de esa cuenta',()=>{
 const legacy={tipo:'comision',monto:123.45,pct:3.5,gananciaBase:3527.142857,estado:'pagado_parcial',montoPagado:50,pagos:{p:{monto:50,fecha:'2026-10-12'}},aprobadoPor:'Actor original',aprobadoTs:1000};
 const getPaths=[],writes=[],listeners=new Map(),elements=new Map();let renders=0;
 const element=id=>{if(!elements.has(id))elements.set(id,{style:{},textContent:'',innerHTML:''});return elements.get(id);};
 const context=load({
  window:{fbDB:{},fbAuth:{currentUser:{uid:'fixture-admin'}},tienePermiso:()=>true,fbRef:(_,p)=>p,
   fbOnValue:(p,fn)=>{getPaths.push(p);listeners.set(p,fn);return ()=>{};},
   fbSet:(...a)=>writes.push(a),fbUpdate:(...a)=>writes.push(a),fbPush:(...a)=>writes.push(a),fbRemove:(...a)=>writes.push(a),fbRunTransaction:(...a)=>writes.push(a)},
  document:{hidden:false,getElementById:id=>id==='page-ctaemp'?{classList:{contains:name=>name==='active'}}:id.startsWith('page-')||id==='ctaemp-migracion-banner'?null:element(id)},
  isAuthenticated:true,currentUserUid:'fixture-admin',currentRole:'admin',permisoModulo:()=>true,svEmpleadoPropio:()=>null,svPuedeLeerDominio:()=>true,
  empData:{},movsEmpData:[],ctaEmpActual:null,gastosData:[],_gastosUnsubscribe:null,_gastosDataReady:false,_gastosCargaError:'',
  _ctaEmpMovimientoLegacyDuplicadoPorGasto:()=>null,_ctaEmpActualizarBannerDuplicadosLegacy(){},renderMovsEmp(){renders++;},notify(){},escapeHTML:String,
  _paginaGastosActiva:()=>false,_actualizarBadgeSolicitudesGastos(){},_programarTareasSecundariasGastos(){},actualizarTarjetaComisionadosVenta(){},marcarDashboardDatosSucios(){},solicitarRenderDashboard(){}
 },['svCapturarContextoOperacion','_svEsPaginaActiva','svCtaEmpVisible','svCapturarContextoLecturaCtaEmp','svMostrarEstadoLecturaCtaEmp','svDetenerLecturaCtaEmp',
  'svCrearOrigenGastosCuenta','svOrigenGastosCompatible','svMarcarSnapshotGastosCuenta','svRepintarCtaEmpDesdeFuentes','svAplicarCtaEmpDesdeSnapshot','_svSuscribirGastos','fbCargarGastos','cargarCtaEmp']);
 context.fbCargarGastos();listeners.get('sisventas/gastos')({val:()=>({})});
 context.cargarCtaEmp('fixture-e');
 listeners.get('sisventas/ctaemp/fixture-e')({val:()=>({'fixture-old':structuredClone(legacy)})});
 assert.deepEqual(getPaths,['sisventas/gastos','sisventas/ctaemp/fixture-e']);assert.deepEqual(writes,[]);
 assert.equal(context.window._ctaEmpLectura.status,'ready');assert.equal(context.window._ctaEmpGastosSnapshot.valid(),true);assert.equal(renders,1);
 assert.deepEqual(JSON.parse(JSON.stringify(context.movsEmpData)),[{fbKey:'fixture-old',_fuente:'ctaemp',...legacy}]);
});
