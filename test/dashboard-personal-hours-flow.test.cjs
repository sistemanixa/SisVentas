'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {source}=require('./helpers/active-app').readActiveApp();
const Hours=require('../js/core/dashboard-personal-hours.v1.js');
const Notices=require('../js/core/dashboard-personal-notices.v1.js');
const AccountRead=require('../js/core/dashboard-account-read.v1.js');

function extract(name){
 const start=source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
 assert.ok(start>=0,name);const end=/^\}/gm;end.lastIndex=start;
 for(let match;(match=end.exec(source));){const code=source.slice(start,match.index+1);try{new vm.Script(code);return code;}catch(_){}}
 throw Error('Missing function '+name);
}
const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function fixture(){
 const requests=[],subscriptions=[],events=new Map(),elements=new Map(),writes=[],noticeStates=[],schedules=[];
 for(const id of ['dash-micuenta-card','dash-mc-hsextra-box','dash-mc-hsex-estado','dash-personal-notices'])elements.set(id,{isConnected:true,style:{},textContent:'',attributes:{},setAttribute(name,value){this.attributes[name]=value;}});
 const page={id:'page-dashboard'},permissions=new Set(['dashboard.miCuenta']),auth={uid:'real_auth_uid'};
 const document={hidden:false,visibilityState:'visible',getElementById:id=>elements.get(id)||null,querySelector:selector=>selector==='.page.active'?page:null,
  addEventListener:(type,listener)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(listener);}};
 const c={console,Date,Math,Promise,Object,String,Array,Number,JSON,Set,Map,WeakMap,URL,AbortController,TextEncoder,document,
  isAuthenticated:true,currentUserUid:auth.uid,currentRole:'tecnico',fbAuth:{currentUser:auth},fbDB:{},own:{fbKey:'employee_own'},
  _impersonacionOriginal:null,_svOperacionesSesionEpoch:1,PERMISOS_ROLES:{tecnico:{indiceRevision:2},admin:{indiceRevision:3}},
  tienePermiso:permission=>permissions.has(permission),svEmpleadoPropio:()=>c.own,_svEsPaginaActiva:name=>page.id==='page-'+name,
  _mesSistema:offset=>{assert.equal(offset,0,'Adapter uses canonical previousMonth, never the rollover helper');return '2026-10';},
  location:{hash:'#/dashboard'},SVDashboardAccountRead:AccountRead,
  SVPersonalHours:Hours,SVPersonalNotices:Notices,SVPersonalNoticesView:{clear:()=>noticeStates.push({status:'none'}),render:(_box,state)=>noticeStates.push(state)},
  SVServiceAuth:{headers:async()=>{requests.push({kind:'headers'});return {Authorization:'Bearer fictitious-test-only'};}},SVSessionRecovery:{deadline:task=>task},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://service.example.invalid'},
  fetch:(url,options)=>new Promise((resolve,reject)=>requests.push({kind:'fetch',url,options,resolve,reject})),
  fbRef:(_db,path)=>path,fbGet:path=>new Promise((resolve,reject)=>requests.push({kind:'fbGet',path,resolve,reject})),
  fbSet:()=>{writes.push('set');assert.fail('No writes');},fbUpdate:()=>{writes.push('update');assert.fail('No writes');},fbRemove:()=>{writes.push('remove');assert.fail('No writes');},
  gastosData:[],empData:{},ctaEmpActual:'',movsEmpData:[],_gastosUnsubscribe:null,_gastosDataReady:false,_gastosCargaError:'',_gastosPagosCache:null,_gastosFechaImputacionCache:null,
  _dashHorasPropias:null,_dashAvisosCTA:null,_dashAvisosGastosFuente:null,_dashAvisosGeneracion:0,_dashAvisosOrigen:null,_dashAvisosRetorno:null,
  _svSuscribirGastos:(next,error)=>{const subscription={next,error};subscriptions.push(subscription);return()=>{subscription.closed=true;};},
  _paginaGastosActiva:()=>false,svPuedeLeerDominio:()=>false,_actualizarBadgeSolicitudesGastos:()=>{},_programarTareasSecundariasGastos:()=>{},actualizarTarjetaComisionadosVenta:()=>{},
  marcarDashboardDatosSucios:()=>schedules.push('dirty'),solicitarRenderDashboard:()=>schedules.push('render'),
  svCancelarRetornoAvisoCuentaPersonal:()=>{},svRestaurarRetornoAvisoCuentaPersonal:()=>{},permisoModulo:()=>true,svAbrirAvisoCuentaPersonal:()=>{},
  _ctaEmpMovimientoLegacyDuplicadoPorGasto:()=>false,_movEmpEnPeriodo:()=>true,_ctaEmpMovVisibleParaRol:()=>true,_movEmpEstadoCalculado:movement=>movement.estado,
  _movEmpEsCobrable:()=>false,_movEmpSaldoPendiente:()=>0,_ctaEmpTotalAdelantosRegistradosEnMes:()=>0,_ctaEmpMontoAdelantoACompensar:()=>0,
  SVForegroundSession:{isVisible:()=>c.foreground},foreground:true};
 c.window=c;vm.createContext(c);
 for(const name of ['svCapturarContextoOperacion','svContextoAvisosCuenta','svLimpiarAvisosCuentaPersonal','svAvisosReferenciaCuenta','svAvisosCuentaRegistro','svRenderAvisosCuentaPersonal',
  'svCapturarHorasPersonalesDashboard','svLectorHorasPersonalesDashboard','svConsultarHorasPersonalesDashboard','svLimpiarHorasPersonalesDashboard','svPresentarHorasPersonalesTrasVisibilidad','svDetenerEscuchasModulo','fbCargarGastos','renderDashMiCuenta'])vm.runInContext(extract(name),c);
 const eventStart=source.indexOf("document.addEventListener('sisventas:session-ended',svLimpiarHorasPersonalesDashboard)");
 assert.ok(eventStart>=0);vm.runInContext(source.slice(eventStart,source.indexOf('function renderDashMiCuenta()',eventStart)),c);
 function emit(type,detail={}){for(const listener of events.get(type)||[])listener({detail});}
 const calls=kind=>requests.filter(request=>request.kind===kind);
 async function resolveCTA(data={},index){
  await flush();if(index===undefined)index=calls('fbGet').findIndex(request=>!request.done);
  const request=calls('fbGet')[index];assert.ok(request&&!request.done);request.done=true;request.resolve({val:()=>data});await flush();
 }
 async function resolveHours(records=[],index=calls('fetch').findIndex(request=>!request.done)){
  const request=calls('fetch')[index];assert.ok(request&&!request.done);request.done=true;const employeeId=new URL(request.url).searchParams.has('viewProfile')?'employee_view': 'employee_own';
  request.resolve({ok:true,status:200,json:async()=>({ok:true,employeeId,records})});await flush();
 }
 return {c,page,permissions,elements,requests,subscriptions,events,writes,noticeStates,schedules,calls,emit,resolveCTA,resolveHours,flush};
}
const ownRow=(key='a',patch={})=>({key,value:{empFbKey:'employee_own',estado:'pendiente',horas:1,fecha:'2020-01-01',mes:'2020-01',...patch}});

test('apertura real de Mi cuenta:1 GET CTA y1 GET endpoint, sin raíz Hs.extra ni escrituras',async()=>{
 const f=fixture();assert.equal(f.requests.length,0);f.c.renderDashMiCuenta();await f.flush();assert.equal(f.calls('fbGet').length,1);assert.equal(f.calls('fetch').length,0);
 assert.equal(f.calls('fbGet')[0].path,'sisventas/ctaemp/employee_own');await f.resolveCTA();assert.equal(f.calls('fetch').length,1);assert.equal(f.calls('headers').length,1);
 const request=f.calls('fetch')[0];assert.equal(request.url,'https://service.example.invalid/laboral/horas-propias');assert.equal(request.options.method,'GET');assert.equal(request.options.cache,'no-store');assert.equal(request.options.body,undefined);
 const element=f.elements.get('dash-mc-hsex-estado');assert.match(element.textContent,/Consultando/);assert.equal(element.attributes['aria-busy'],'true');
 await f.resolveHours([ownRow('legacy',{horas:0.1}),ownRow('second',{horas:0.2}),ownRow('third',{horas:0.4})]);
 assert.equal(element.textContent,'3 solicitudes pendientes (0.7000000000000001 hs)');assert.equal(element.attributes['aria-busy'],'false');assert.deepEqual(f.writes,[]);
 assert.ok(!f.calls('fbGet').some(request=>request.path.includes('hsextra_solicitudes')));
});
test('repintar avisos, recibir Gastos y volver visible no agrega GETs propios',async()=>{
 const f=fixture();f.c.fbCargarGastos();assert.equal(f.subscriptions.length,1);f.subscriptions[0].next({val:()=>({})});f.c.renderDashMiCuenta();await f.resolveCTA();await f.resolveHours();
 const before=f.requests.length;for(let i=0;i<5;i++){f.c.svRenderAvisosCuentaPersonal();f.subscriptions[0].next({val:()=>({})});f.c.fbCargarGastos();}
 f.c.document.hidden=true;f.c.document.visibilityState='hidden';f.emit('visibilitychange');f.c.document.hidden=false;f.c.document.visibilityState='visible';f.emit('visibilitychange');
 assert.equal(f.requests.length,before);assert.equal(f.calls('fbGet').length,1);assert.equal(f.calls('fetch').length,1);assert.equal(f.subscriptions.length,1);assert.deepEqual(f.writes,[]);
 // Existing scheduling hooks are observed, not executed as a second Dashboard opening.
 assert.equal(f.schedules.filter(value=>value==='render').length,6);
});
test('CTA que termina oculta no inicia endpoint; visible por sí solo tampoco consulta',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await f.flush();f.c.document.hidden=true;f.c.document.visibilityState='hidden';f.emit('visibilitychange');await f.resolveCTA();assert.equal(f.calls('fetch').length,0);assert.equal(f.calls('headers').length,0);
 f.c.document.hidden=false;f.c.document.visibilityState='visible';f.emit('visibilitychange');await f.flush();assert.equal(f.calls('fetch').length,0);assert.equal(f.calls('fbGet').length,1);assert.deepEqual(f.writes,[]);
});
test('ocultar durante fetch lo aborta y su respuesta tardía no pinta ni reconsulta',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await f.resolveCTA();const request=f.calls('fetch')[0];f.c.document.hidden=true;f.c.document.visibilityState='hidden';f.emit('visibilitychange');assert.equal(request.options.signal.aborted,true);
 await f.resolveHours([ownRow('late',{horas:999})]);f.c.document.hidden=false;f.c.document.visibilityState='visible';f.emit('visibilitychange');await f.flush();assert.equal(f.calls('fetch').length,1);assert.doesNotMatch(f.elements.get('dash-mc-hsex-estado').textContent,/999/);assert.deepEqual(f.writes,[]);
});
for(const stop of ['module','session','role','page'])test('limpieza real '+stop+' aborta pendiente y elimina memoria sin retry',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await f.resolveCTA();const request=f.calls('fetch')[0];
 if(stop==='module')f.c.svDetenerEscuchasModulo();
 if(stop==='session'){f.c._svOperacionesSesionEpoch++;f.emit('sisventas:session-ended');}
 if(stop==='role'){f.c.currentRole='admin';f.emit('sisventas:role-changed');}
 if(stop==='page'){f.page.id='page-productos';f.emit('sisventas:page-changed',{page:'productos'});}
 assert.equal(request.options.signal.aborted,true);assert.equal(f.c._dashHorasPropias,null);await f.resolveHours([ownRow('late',{horas:999})]);f.emit('visibilitychange');await f.flush();assert.equal(f.calls('fetch').length,1);assert.equal(f.c._dashHorasPropias,null);assert.doesNotMatch(f.elements.get('dash-mc-hsex-estado').textContent,/999/);assert.deepEqual(f.writes,[]);
});
test('parar módulos antes de resolver CTA impide iniciar el endpoint más tarde',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await f.flush();f.c.svDetenerEscuchasModulo();await f.resolveCTA();assert.equal(f.calls('fetch').length,0);assert.equal(f.calls('headers').length,0);assert.equal(f.c._dashHorasPropias,null);assert.deepEqual(f.writes,[]);
});
test('dos CTA concurrentes sólo dejan disparar el endpoint a la generación vigente',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();f.c.renderDashMiCuenta();await f.resolveCTA();assert.equal(f.calls('fbGet').length,1);assert.equal(f.calls('fetch').length,1);await f.resolveHours();assert.equal(f.elements.get('dash-mc-hsex-estado').textContent,'Sin solicitudes');assert.deepEqual(f.writes,[]);
});
test('ver como conserva Auth real y manda sólo viewProfile, sin employeeId',async()=>{
 const f=fixture(),realAuth=f.c.fbAuth.currentUser;f.c.currentRole='admin';f.c._impersonacionOriginal={usuarioFbKey:'profile_view'};f.c.own={fbKey:'employee_view'};f.c.renderDashMiCuenta();await f.resolveCTA();const scope=f.c.svCapturarHorasPersonalesDashboard(),url=new URL(f.calls('fetch')[0].url);
 assert.equal(scope.auth,realAuth);assert.equal(scope.uid,'real_auth_uid');assert.equal(scope.employeeId,'employee_view');assert.equal(scope.viewProfile,'profile_view');assert.deepEqual([...url.searchParams],[['viewProfile','profile_view']]);assert.equal(f.calls('fbGet')[0].path,'sisventas/ctaemp/employee_view');
 await f.resolveHours([{key:'view_row',value:{empFbKey:'employee_view',estado:'aprobado',horas:4,fecha:'2026-09-01'}}]);assert.equal(f.elements.get('dash-mc-hsex-estado').textContent,'4 hs aprobadas desde septiembre de 2026');assert.deepEqual(f.writes,[]);
});
test('cambio de viewProfile con mismo objeto invalida una respuesta pendiente',async()=>{
 const f=fixture();f.c.currentRole='admin';f.c._impersonacionOriginal={usuarioFbKey:'profile_view'};f.c.own={fbKey:'employee_view'};f.c.renderDashMiCuenta();await f.resolveCTA();f.c._impersonacionOriginal.usuarioFbKey='other_profile';await f.resolveHours([{key:'stale',value:{empFbKey:'employee_view',estado:'pendiente',horas:999}}]);assert.doesNotMatch(f.elements.get('dash-mc-hsex-estado').textContent,/999/);assert.equal(f.calls('fetch').length,1);assert.deepEqual(f.writes,[]);
});
test('revocar miCuenta durante fetch descarta datos; error403 sigue desconocido al volver visible',async()=>{
 const revoked=fixture();revoked.c.renderDashMiCuenta();await revoked.resolveCTA();revoked.permissions.clear();await revoked.resolveHours([ownRow('stale',{horas:999})]);assert.doesNotMatch(revoked.elements.get('dash-mc-hsex-estado').textContent,/999|Sin solicitudes/);assert.deepEqual(revoked.writes,[]);
 const denied=fixture();denied.c.renderDashMiCuenta();await denied.resolveCTA();const request=denied.calls('fetch')[0];request.resolve({ok:false,status:403,json:async()=>({ok:false})});await denied.flush();assert.match(denied.elements.get('dash-mc-hsex-estado').textContent,/No se pudieron/);
 denied.c.document.hidden=true;denied.emit('visibilitychange');denied.c.document.hidden=false;denied.emit('visibilitychange');assert.match(denied.elements.get('dash-mc-hsex-estado').textContent,/No se pudieron/);assert.equal(denied.calls('fetch').length,1);assert.deepEqual(denied.writes,[]);
});
