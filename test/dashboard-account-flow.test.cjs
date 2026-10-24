'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {source}=require('./helpers/active-app').readActiveApp();
const Read=require('../js/core/dashboard-account-read.v1.js');
// active-app already normalizes Git's Windows checkout line endings.
const baseline=fs.readFileSync(path.resolve(__dirname,'../js/app.v3.14.15.js'),'utf8').replace(/\r\n/g,'\n');
function extract(text,name){
 const start=text.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert.ok(start>=0,name);const ends=/^\}/gm;ends.lastIndex=start;
 for(let m;(m=ends.exec(text));){const code=text.slice(start,m.index+1);try{new vm.Script(code);return code;}catch(_){}}
 throw Error(name);
}
const financialNames=['_fechaCalendarioLocal','_fechaMes','_fechaEnMes','_adelantoEsEntregaLegacy','_adelantoMontoEntregado','_ctaEmpNormalizarTxt','_ctaEmpMesDeMov','_ctaEmpFechaLocalDesdeTs','_ctaEmpFechaMovimiento','_ctaEmpEsCargo','_ctaEmpEsGastoPersonalEmpleado','_ctaEmpTipoDesdeGasto','_ctaEmpEstadoDesdeGasto','_ctaEmpMovimientoLegacyDuplicadoPorGasto','_movEmpPagosArray','_movEmpTotalPagado','_movEmpSaldoPendiente','_buscarGastoRelacionadoMovEmp','_movEmpFechaVisual','_movEmpEnPeriodo','_movEmpEstadoCalculado','_movEmpEstaPagado','_movEmpEsCobrable','_ctaEmpMontoAdelantoACompensar','_ctaEmpMovVisibleParaRol','_ctaEmpTotalAdelantosRegistradosEnMes','totalPagadoGasto','normalizarEstadoGasto','_gastoPagosArray','pagoGastoEstaAnulado','_bonificacionMesValido','_bonificacionPeriodoComputo'];
const helpers=['svCuentaDashboardEnPrimerPlano','svCapturarLecturaCuentaDashboard','svLeerCuentaDashboard','svRetirarCuentaDashboardPendiente'];
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-10-24T15:00:00.000Z']));}static now(){return Date.parse('2026-10-24T15:00:00.000Z');}}
function fixture(text=source){
 const elements=new Map(),requests=[],events=new Map(),states=[],writes=[],page={id:'page-dashboard',isConnected:true};
 for(const id of ['dash-micuenta-card','dash-historial-mes-card','dash-historial-mes-body','dash-mc-total','dash-mc-comisiones','dash-mc-comisiones-sub','dash-mc-adelantos','dash-mc-adelantos-sub'])elements.set(id,{style:{},textContent:'',innerHTML:'',isConnected:true});
 const permissions=new Set(['dashboard.miCuenta']),modules=new Set(['dashboard','ctaemp']);
 const document={hidden:false,visibilityState:'visible',getElementById:id=>elements.get(id)||null,querySelector:query=>query==='.page.active'?page:null,addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}};
 const c={console,Date:Clock,Math,Promise,Object,String,Array,Number,JSON,Map,Set,WeakMap,document,location:{hash:'#/dashboard'},isAuthenticated:true,
  currentUserUid:'u',currentRole:'tecnico',fbAuth:{currentUser:{uid:'u'}},fbDB:{},PERMISOS_ROLES:{tecnico:{indiceRevision:1},admin:{indiceRevision:2}},_svOperacionesSesionEpoch:0,_impersonacionOriginal:null,
  SVDashboardAccountRead:Read,own:{fbKey:'e'},svEmpleadoPropio:()=>c.own,tienePermiso:p=>permissions.has(p),permisoModulo:p=>modules.has(p),
  fbRef:(db,path)=>({db,path}),fbGet:ref=>new Promise((resolve,reject)=>requests.push({ref,resolve,reject})),
  fbSet:()=>{writes.push('set');assert.fail('No writes');},fbUpdate:()=>{writes.push('update');assert.fail('No writes');},fbRemove:()=>{writes.push('remove');assert.fail('No writes');},
  _dashAvisosGeneracion:0,_dashAvisosCTA:null,_dashAvisosGastosFuente:null,_dashAvisosOrigen:null,_dashAvisosRetorno:null,_dashHorasPropias:null,
  gastosData:[],empData:{e:{fbKey:'e',nombre:'Persona ficticia'}},ctaEmpActual:'previous-selection',_gastosPagosCache:null,
  _mesSistema:()=> '2026-10',escapeHTML:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  svCancelarRetornoAvisoCuentaPersonal:()=>{},svLimpiarHorasPersonalesDashboard:()=>{},svPaginaRetornoAvisoCuentaPersonal:()=>{},svOrigenAvisoCuentaVigente:()=>false,
  svRenderAvisosCuentaPersonal:()=>states.push({status:c._dashAvisosCTA?.status||'none',generation:c._dashAvisosCTA?.generation||0}),
  setTimeout:()=>assert.fail('No added timer'),setInterval:()=>assert.fail('No polling'),fetch:()=>assert.fail('No added HTTP request')};
 c.window=c;vm.createContext(c);
 for(const name of financialNames.concat(['svCapturarContextoOperacion','svContextoAvisosCuenta','svLimpiarAvisosCuentaPersonal']))vm.runInContext(extract(text,name),c);
 if(text===source){for(const name of helpers)vm.runInContext(extract(text,name),c);
  const start=source.indexOf("document.addEventListener('sisventas:session-ended',svLimpiarAvisosCuentaPersonal)"),end=source.indexOf("document.addEventListener('sisventas:session-ended',svLimpiarHorasPersonalesDashboard)",start);
  assert.ok(start>=0&&end>start);vm.runInContext(source.slice(start,end),c);
 }
 vm.runInContext(extract(text,'renderDashMiCuenta'),c);
 function emit(name,detail={}){for(const listener of events.get(name)||[])listener({detail});}
 function output(){return Object.fromEntries([...elements].map(([id,e])=>[id,{text:e.textContent,html:e.innerHTML,style:{...e.style}}]));}
 async function deliver(data,index=0){await flush();assert.ok(requests[index]);let calls=0;const snapshot={val(){calls++;return data;}};requests[index].resolve(snapshot);await flush();return{calls,snapshot};}
 return{c,page,document,elements,requests,events,states,writes,permissions,modules,emit,output,deliver};
}
function rich(){
 return{cta:{
  salary:{tipo:'sueldo',monto:1200.35,estado:'aprobado',fecha:'2026-10-01',descripcion:'Haber octubre',ts:1,pagos:{a:{monto:0.1,ts:1},b:{monto:0.2,ts:2},void:{monto:50,anulado:true,ts:3}}},
  commission:{tipo:'comision',monto:100.1,estado:'aprobado',fecha:'2026-10-02',descripcion:'Comisión aprobada',ts:2,pagos:{a:{monto:0.1}}},
  pending:{tipo:'comision',monto:99999,estado:'pendiente',fecha:'2026-10-03',descripcion:'Comisión pendiente',ts:3},
  bonus:{tipo:'bonificacion',monto:35.75,estado:'aprobado',fecha:'2026-09-20',periodoComputo:'2026-10',gastoFbKey:'bonus-expense',descripcion:'Tarea ficticia',ts:4},
  advance:{tipo:'adelanto',monto:300.15,estado:'pagado',montoPagado:300.15,montoCompensado:100.05,fecha:'2026-10-04',descripcion:'Adelanto parcial',ts:5},
  oldSalary:{tipo:'sueldo',monto:5000,estado:'aprobado',fecha:'2026-09-01',descripcion:'Haber anterior',ts:6}
 },expenses:[
  {fbKey:'bonus-expense',tipoPagable:'bonificacion',monto:35.75,estado:'aprobado',aprobadoPor:'Administrador ficticio',empleadoId:'e',fecha:'2026-09-20',periodoComputo:'2026-10',descripcion:'Tarea ficticia',ts:4},
  {fbKey:'materials',categoria:'Materiales',monto:25.11,estado:'pagado_parcial',empleadoId:'e',fecha:'2026-10-05',descripcion:'Materiales ficticios',pagos:{p:{monto:3.02}},ts:7},
  {fbKey:'foreign',categoria:'Personal',tipoPagable:'bonificacion',monto:80000,estado:'aprobado',empleadoId:'other',fecha:'2026-10-06',descripcion:'Ajeno',ts:8}
 ]};
}
test('real Dashboard helpers are inert until an authorized visible render asks for the own account',async()=>{
 const f=fixture();await flush();assert.equal(f.requests.length,0);assert.equal(f.c._svCuentaDashboardReader,undefined);assert.equal(f.events.get('visibilitychange').length,1);assert.deepEqual(f.writes,[]);
});
test('three real renders join one SDK GET and only the latest generation decodes and paints',async()=>{
 const f=fixture(),r=rich(),before=JSON.stringify(r);f.c.gastosData=r.expenses;
 f.c.renderDashMiCuenta();f.c.renderDashMiCuenta();f.c.renderDashMiCuenta();await flush();assert.equal(f.requests.length,1);assert.equal(f.requests[0].ref.path,'sisventas/ctaemp/e');assert.equal(f.c._dashAvisosGeneracion,3);
 const result=await f.deliver(r.cta);assert.equal(result.calls,1);assert.equal(f.c._dashAvisosCTA.status,'ready');assert.equal(f.states.filter(x=>x.status==='ready').length,1);assert.equal(f.states.at(-1).generation,3);
 assert.match(f.elements.get('dash-historial-mes-body').innerHTML,/Haber octubre/);assert.doesNotMatch(f.elements.get('dash-historial-mes-body').innerHTML,/Comisión pendiente|Ajeno|Haber anterior/);
 assert.equal(f.c.ctaEmpActual,'previous-selection');assert.equal(JSON.stringify(r),before);assert.deepEqual(f.writes,[]);
});
test('finished reads are not cached and a later render starts a fresh SDK request',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await f.deliver({});f.c.renderDashMiCuenta();await flush();assert.equal(f.requests.length,2);await f.deliver({},1);assert.equal(f.c._dashAvisosCTA.status,'ready');
});
for(const mode of ['hidden','foreground','page','unauthenticated','permission','module'])test('real integration emits no GET for '+mode,async()=>{
 const f=fixture();if(mode==='hidden')f.document.hidden=true;if(mode==='foreground')f.c.SVForegroundSession={isVisible:()=>false};if(mode==='page')f.page.id='page-ctaemp';if(mode==='unauthenticated')f.c.isAuthenticated=false;if(mode==='permission')f.permissions.clear();if(mode==='module')f.modules.delete('dashboard');
 f.c.renderDashMiCuenta();await flush();assert.equal(f.requests.length,0);assert.deepEqual(f.writes,[]);
});
for(const kind of ['visibility','page','role','session'])test('existing '+kind+' handler retires a pending account read before decoding and does not retry automatically',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await flush();assert.equal(f.requests.length,1);
 if(kind==='visibility'){f.document.hidden=true;f.emit('visibilitychange');f.document.hidden=false;f.emit('visibilitychange');}
 if(kind==='page'){f.page.id='page-productos';f.emit('sisventas:page-changed',{page:'productos'});f.page.id='page-dashboard';f.emit('sisventas:page-changed',{page:'dashboard'});}
 if(kind==='role')f.emit('sisventas:role-changed');
 if(kind==='session')f.emit('sisventas:session-ended');
 const result=await f.deliver({m:{tipo:'sueldo',estado:'aprobado',monto:99999,fecha:'2026-10-01'}});assert.equal(result.calls,0);assert.equal(f.requests.length,1);assert.ok(!f.states.some(x=>x.status==='ready'));assert.doesNotMatch(JSON.stringify(f.output()),/99999/);assert.deepEqual(f.writes,[]);
});
test('leave/return can begin a new read while the former SDK Promise still has not settled',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await flush();f.page.id='page-productos';f.emit('sisventas:page-changed',{page:'productos'});f.page.id='page-dashboard';f.emit('sisventas:page-changed',{page:'dashboard'});f.c.renderDashMiCuenta();await flush();assert.equal(f.requests.length,2);
 const previous=await f.deliver({stale:{fecha:'2026-10-01',tipo:'sueldo',monto:99999,estado:'aprobado'}},0);assert.equal(previous.calls,0);assert.equal(f.c._dashAvisosCTA.status,'loading');const current=await f.deliver({},1);assert.equal(current.calls,1);assert.equal(f.c._dashAvisosCTA.status,'ready');
});
test('an older scope resolving after the new ready result cannot replace its HTML or decode old data',async()=>{
 const f=fixture(),r=rich();f.c.gastosData=r.expenses;f.c.renderDashMiCuenta();await flush();f.c._svOperacionesSesionEpoch++;f.c.renderDashMiCuenta();await flush();assert.equal(f.requests.length,2);
 const current=await f.deliver(r.cta,1);assert.equal(current.calls,1);const before=f.output();const previous=await f.deliver({stale:{fecha:'2026-10-01',tipo:'sueldo',monto:99999,estado:'aprobado'}},0);
 assert.equal(previous.calls,0);assert.deepEqual(f.output(),before);assert.equal(f.c._dashAvisosCTA.status,'ready');assert.equal(f.c._dashAvisosCTA.generation,2);assert.deepEqual(f.writes,[]);
});
for(const mutate of [f=>{f.c.fbAuth.currentUser={uid:'u'};},f=>{f.c.currentUserUid='other';},f=>{f.c.PERMISOS_ROLES.tecnico.indiceRevision++;},f=>{f.c.own={fbKey:'another'};},f=>{f.c._impersonacionOriginal={usuarioFbKey:'view'};},f=>{f.c.location.hash='#/dashboard?changed';},f=>{f.c._svOperacionesSesionEpoch++;}])test('real scope change is fenced before snap.val: '+mutate.toString(),async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await flush();mutate(f);const result=await f.deliver({});assert.equal(result.calls,0);assert.ok(!f.states.some(x=>x.status==='ready'));assert.deepEqual(f.writes,[]);
});
test('SDK failures stay errors and an explicit render retries without a poisoned pending Promise',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await flush();f.requests[0].reject(Error('offline'));await flush();assert.equal(f.c._dashAvisosCTA.status,'error');assert.match(f.elements.get('dash-historial-mes-body').textContent,/No se pudo/);
 f.c.renderDashMiCuenta();await flush();assert.equal(f.requests.length,2);await f.deliver({},1);assert.equal(f.c._dashAvisosCTA.status,'ready');assert.deepEqual(f.writes,[]);
});
test('financial helpers retain canonical source bytes from15; integration does not change their arithmetic',()=>{
 for(const name of financialNames)assert.equal(extract(source,name),extract(baseline,name),name);
});
for(const scenario of ['empty','rich','array','admin'])test('exact Dashboard HTML, balances and IEEE results match15 for '+scenario,async()=>{
 const r=rich(),input=scenario==='empty'?{}:scenario==='array'?Object.values(r.cta):r.cta,outputs=[];
 for(const text of [baseline,source]){
  const f=fixture(text);f.c.gastosData=scenario==='empty'?[]:structuredClone(r.expenses);if(scenario==='admin')f.permissions.add('empleados.verCuentas');
  const before=JSON.stringify({input,expenses:f.c.gastosData});f.c.renderDashMiCuenta();const result=await f.deliver(structuredClone(input));assert.equal(result.calls,1);assert.equal(f.c._dashAvisosCTA.status,'ready');
  outputs.push({html:f.output(),partial:f.c._movEmpTotalPagado(r.cta.salary),advance:f.c._ctaEmpMontoAdelantoACompensar(r.cta.advance),selection:f.c.ctaEmpActual});
  assert.equal(JSON.stringify({input,expenses:f.c.gastosData}),before);assert.deepEqual(f.writes,[]);
 }
 assert.deepEqual(outputs[1],outputs[0]);assert.equal(outputs[1].partial,0.1+0.2);assert.equal(outputs[1].advance,Math.max(0,300.15-100.05));
 if(scenario==='rich')assert.notEqual(outputs[1].html['dash-mc-total'].text,'$0');
});
