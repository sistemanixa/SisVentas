'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {source}=require('./helpers/active-app').readActiveApp();
const Read=require('../js/core/dashboard-account-source.v1.js');
// active-app already normalizes Git's Windows checkout line endings.
const baseline=fs.readFileSync(path.resolve(__dirname,'../js/app.v3.14.15.js'),'utf8').replace(/\r\n/g,'\n');
function extract(text,name){
 const start=text.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert.ok(start>=0,name);const ends=/^\}/gm;ends.lastIndex=start;
 for(let m;(m=ends.exec(text));){const code=text.slice(start,m.index+1);try{new vm.Script(code);return code;}catch(_){}}
 throw Error(name);
}
const financialNames=['_fechaCalendarioLocal','_fechaMes','_fechaEnMes','_adelantoEsEntregaLegacy','_adelantoMontoEntregado','_ctaEmpNormalizarTxt','_ctaEmpMesDeMov','_ctaEmpFechaLocalDesdeTs','_ctaEmpFechaMovimiento','_ctaEmpEsCargo','_ctaEmpEsGastoPersonalEmpleado','_ctaEmpTipoDesdeGasto','_ctaEmpEstadoDesdeGasto','_ctaEmpMovimientoLegacyDuplicadoPorGasto','_movEmpPagosArray','_movEmpTotalPagado','_movEmpSaldoPendiente','_buscarGastoRelacionadoMovEmp','_movEmpFechaVisual','_movEmpEnPeriodo','_movEmpEstadoCalculado','_movEmpEstaPagado','_movEmpEsCobrable','_ctaEmpMontoAdelantoACompensar','_ctaEmpMovVisibleParaRol','_ctaEmpTotalAdelantosRegistradosEnMes','totalPagadoGasto','normalizarEstadoGasto','_gastoPagosArray','pagoGastoEstaAnulado','_bonificacionMesValido','_bonificacionPeriodoComputo'];
const helpers=['svMarcarSnapshotGastosCuenta','svOrigenGastosCompatible','svCuentaDashboardEnPrimerPlano','svCapturarLecturaCuentaDashboard','svLeerCuentaDashboard','svRetirarCuentaDashboardPendiente','svMostrarEstadoCuentaDashboard','svGastosCuentaDashboardVigentes','svRepintarCuentaDashboard','svReintentarCuentaDashboard','svReintentarGastosDashboard','svPresentarHorasCuentaDashboard','svPintarCuentaDashboard'];
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-10-24T15:00:00.000Z']));}static now(){return Date.parse('2026-10-24T15:00:00.000Z');}}
function fixture(text=source){
 const elements=new Map(),requests=[],events=new Map(),states=[],writes=[],page={id:'page-dashboard',isConnected:true};
 for(const id of ['dash-micuenta-card','dash-historial-mes-card','dash-historial-mes-body','dash-mc-total','dash-mc-total-sub','dash-mc-pagado','dash-mc-pagado-sub','dash-mc-comisiones','dash-mc-comisiones-sub','dash-mc-adelantos','dash-mc-adelantos-sub'])elements.set(id,{style:{},textContent:'',innerHTML:'',isConnected:true});
 const permissions=new Set(['dashboard.miCuenta']),modules=new Set(['dashboard','ctaemp']);
 const document={hidden:false,visibilityState:'visible',getElementById:id=>elements.get(id)||null,querySelector:query=>query==='.page.active'?page:null,addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}};
 const c={console,Date:Clock,Math,Promise,Object,String,Array,Number,JSON,Map,Set,WeakMap,document,location:{hash:'#/dashboard'},isAuthenticated:true,
  currentUserUid:'u',currentRole:'tecnico',fbAuth:{currentUser:{uid:'u'}},fbDB:{},PERMISOS_ROLES:{tecnico:{indiceRevision:1},admin:{indiceRevision:2}},_svOperacionesSesionEpoch:0,_impersonacionOriginal:null,
  svPuedeLeerDominio:()=>false,SVDashboardAccountSource:Read,own:{fbKey:'e'},svEmpleadoPropio:()=>c.own,tienePermiso:p=>permissions.has(p),permisoModulo:p=>modules.has(p),
  fbRef:(db,path)=>({db,path}),fbGet:ref=>new Promise((resolve,reject)=>requests.push({ref,resolve,reject,kind:'get'})),
  fbOnValue:(ref,resolve,reject)=>{const row={ref,resolve,reject,stops:0,kind:'watch'};requests.push(row);return()=>row.stops++;},
  fbSet:()=>{writes.push('set');assert.fail('No writes');},fbUpdate:()=>{writes.push('update');assert.fail('No writes');},fbRemove:()=>{writes.push('remove');assert.fail('No writes');},
  _dashAvisosGeneracion:0,_dashAvisosCTA:null,_dashAvisosGastosFuente:null,_dashAvisosOrigen:null,_dashAvisosRetorno:null,_dashHorasPropias:null,
  gastosData:[],_gastosDataReady:true,_gastosCargaError:'',empData:{e:{fbKey:'e',nombre:'Persona ficticia'}},ctaEmpActual:'previous-selection',_gastosPagosCache:null,
  _mesSistema:()=> '2026-10',escapeHTML:value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
  svCancelarRetornoAvisoCuentaPersonal:()=>{},svLimpiarHorasPersonalesDashboard:()=>{},svPaginaRetornoAvisoCuentaPersonal:()=>{},svOrigenAvisoCuentaVigente:()=>false,
  svRenderAvisosCuentaPersonal:()=>states.push({status:c._dashAvisosCTA?.status||'none',generation:c._dashAvisosCTA?.generation||0}),
  setTimeout:()=>assert.fail('No added timer'),setInterval:()=>assert.fail('No polling'),fetch:()=>assert.fail('No added HTTP request')};
 for(const el of elements.values()){let html='',text='';Object.defineProperty(el,'innerHTML',{get:()=>html,set:value=>{html=value;text='';}});Object.defineProperty(el,'textContent',{configurable:true,get:()=>text,set:value=>{text=value;html='';}});}
 c.window=c;c.addEventListener=document.addEventListener;c._ctaEmpGastosSnapshot={origin:{employeeId:'e'},valid:()=>true,get data(){return c.gastosData;}};vm.createContext(c);
 if(text===source){c.SVCommissionPresentation=require('../js/core/commission-presentation.v1.js');for(const name of ['svEsComisionMovimiento','svDescripcionMovimientoVisible'])vm.runInContext(extract(text,name),c);}
 for(const name of financialNames.concat(['svCapturarContextoOperacion','svContextoAvisosCuenta','svLimpiarAvisosCuentaPersonal']))vm.runInContext(extract(text,name),c);
 if(text===source){for(const name of helpers.concat(['svProyectarCTA','_adelantoMesSiguiente','_adelantoPeriodoDescuento','_adelantoDescontableEnMes','_ctaEmpPagosRealizadosEnMes']))vm.runInContext(extract(text,name),c);
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
test('three real renders share one live own-account source and ready repaints issue no GET',async()=>{
 const f=fixture(),r=rich(),before=JSON.stringify(r);f.c.gastosData=r.expenses;
 f.c.renderDashMiCuenta();f.c.renderDashMiCuenta();f.c.renderDashMiCuenta();await flush();assert.equal(f.requests.length,1);assert.equal(f.requests[0].ref.path,'sisventas/ctaemp/e');
 const result=await f.deliver(r.cta);assert.equal(result.calls,1);assert.equal(f.c._dashAvisosCTA.status,'ready');assert.equal(f.states.filter(x=>x.status==='ready').length,1);assert.equal(f.states.at(-1).generation,1);
 assert.match(f.elements.get('dash-historial-mes-body').innerHTML,/Haber octubre/);assert.doesNotMatch(f.elements.get('dash-historial-mes-body').innerHTML,/Comisión pendiente|Ajeno|Haber anterior/);
 assert.equal(f.c.ctaEmpActual,'previous-selection');assert.equal(JSON.stringify(r),before);assert.deepEqual(f.writes,[]);
});
test('ready empty source remains live and later renders reuse it without another transport',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await f.deliver({});for(let i=0;i<3;i++)f.c.renderDashMiCuenta();await flush();assert.equal(f.requests.length,1);assert.equal(f.c._dashAvisosCTA.status,'ready');assert.equal(f.requests[0].stops,0);
});
for(const mode of ['hidden','foreground','page','unauthenticated','permission','module'])test('real integration emits no GET for '+mode,async()=>{
 const f=fixture();if(mode==='hidden')f.document.hidden=true;if(mode==='foreground')f.c.SVForegroundSession={isVisible:()=>false};if(mode==='page')f.page.id='page-ctaemp';if(mode==='unauthenticated')f.c.isAuthenticated=false;if(mode==='permission')f.permissions.clear();if(mode==='module')f.modules.delete('dashboard');
 f.c.renderDashMiCuenta();await flush();assert.equal(f.requests.length,0);assert.deepEqual(f.writes,[]);
});
for(const kind of ['page','session'])test('existing '+kind+' handler retires a pending account read before decoding without incidental retry',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await flush();assert.equal(f.requests.length,1);
 if(kind==='visibility'){f.document.hidden=true;f.emit('visibilitychange');f.document.hidden=false;f.emit('visibilitychange');}
 if(kind==='page'){f.page.id='page-productos';f.emit('sisventas:page-changed',{page:'productos'});}
 if(kind==='session')f.emit('sisventas:session-ended');
 const result=await f.deliver({m:{tipo:'sueldo',estado:'aprobado',monto:99999,fecha:'2026-10-01'}});assert.equal(result.calls,0);assert.equal(f.requests.length,1);assert.ok(!f.states.some(x=>x.status==='ready'));assert.doesNotMatch(JSON.stringify(f.output()),/99999/);assert.deepEqual(f.writes,[]);
});
test('leave/return can begin a new read while the former SDK Promise still has not settled',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await flush();f.page.id='page-productos';f.emit('sisventas:page-changed',{page:'productos'});f.page.id='page-dashboard';f.emit('sisventas:page-changed',{page:'dashboard'});f.c.renderDashMiCuenta();await flush();assert.equal(f.requests.length,2);
 const previous=await f.deliver({stale:{fecha:'2026-10-01',tipo:'sueldo',monto:99999,estado:'aprobado'}},0);assert.equal(previous.calls,0);assert.equal(f.c._svCuentaDashboardReader.peek().status,'loading');const current=await f.deliver({},1);assert.equal(current.calls,1);assert.equal(f.c._dashAvisosCTA.status,'ready');
});
test('an older scope resolving after the new ready result cannot replace its HTML or decode old data',async()=>{
 const f=fixture(),r=rich();f.c.gastosData=r.expenses;f.c.renderDashMiCuenta();await flush();f.c._svOperacionesSesionEpoch++;f.c.renderDashMiCuenta(true);await flush();assert.equal(f.requests.length,2);
 const current=await f.deliver(r.cta,1);assert.equal(current.calls,1);const before=f.output();const previous=await f.deliver({stale:{fecha:'2026-10-01',tipo:'sueldo',monto:99999,estado:'aprobado'}},0);
 assert.equal(previous.calls,0);assert.deepEqual(f.output(),before);assert.equal(f.c._dashAvisosCTA.status,'ready');assert.equal(f.c._dashAvisosCTA.generation,2);assert.deepEqual(f.writes,[]);
});
for(const mutate of [f=>{f.c.fbAuth.currentUser={uid:'u'};},f=>{f.c.currentUserUid='other';},f=>{f.c.PERMISOS_ROLES.tecnico.indiceRevision++;},f=>{f.c.own={fbKey:'another'};},f=>{f.c._impersonacionOriginal={usuarioFbKey:'view'};},f=>{f.c.location.hash='#/dashboard?changed';},f=>{f.c._svOperacionesSesionEpoch++;}])test('real scope change is fenced before snap.val: '+mutate.toString(),async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await flush();mutate(f);const result=await f.deliver({});assert.equal(result.calls,0);assert.ok(!f.states.some(x=>x.status==='ready'));assert.deepEqual(f.writes,[]);
});
test('SDK failure latches across incidental renders and only its native retry opens a new source',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await flush();f.requests[0].reject(Error('offline'));await flush();assert.equal(f.c._svCuentaDashboardReader.peek().status,'error');assert.match(f.elements.get('dash-historial-mes-body').innerHTML,/No se pudo/);
 for(let i=0;i<3;i++)f.c.renderDashMiCuenta();assert.equal(f.requests.length,1);f.c.svReintentarCuentaDashboard();f.c.svReintentarCuentaDashboard();await flush();assert.equal(f.requests.length,2);await f.deliver({},1);assert.equal(f.c._dashAvisosCTA.status,'ready');assert.deepEqual(f.writes,[]);
});
test('financial helpers retain canonical source bytes from15; integration does not change their arithmetic',()=>{
 for(const name of financialNames)assert.equal(extract(source,name),extract(baseline,name),name);
});
for(const scenario of ['empty','rich','array','admin'])test('Dashboard keeps history, selection and IEEE payment primitives from15 for '+scenario,async()=>{
 const r=rich(),input=scenario==='empty'?{}:scenario==='array'?Object.values(r.cta):r.cta,outputs=[];
 for(const text of [baseline,source]){
  const f=fixture(text);f.c.gastosData=scenario==='empty'?[]:structuredClone(r.expenses);if(scenario==='admin')f.permissions.add('empleados.verCuentas');
  const before=JSON.stringify({input,expenses:f.c.gastosData});f.c.renderDashMiCuenta();const result=await f.deliver(structuredClone(input));assert.equal(result.calls,1);assert.equal(f.c._dashAvisosCTA.status,'ready');
  outputs.push({html:f.output(),partial:f.c._movEmpTotalPagado(r.cta.salary),advance:f.c._ctaEmpMontoAdelantoACompensar(r.cta.advance),selection:f.c.ctaEmpActual});
  assert.equal(JSON.stringify({input,expenses:f.c.gastosData}),before);assert.deepEqual(f.writes,[]);
 }
 const expectedHistory=structuredClone(outputs[0].html['dash-historial-mes-body']),presentation=require('../js/core/commission-presentation.v1.js');
 const escapeLabel=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
 for(const record of Object.values(r.cta).concat(r.expenses)){if(!presentation.isCommission(record))continue;const before=escapeLabel(record.descripcion||record.desc||''),after=escapeLabel(presentation.caption(record));if(before)expectedHistory.html=expectedHistory.html.split('>'+before+'<').join('>'+after+'<');}
 assert.deepEqual(outputs[1].html['dash-historial-mes-body'],expectedHistory);
 assert.equal(outputs[1].selection,outputs[0].selection);assert.equal(outputs[1].partial,outputs[0].partial);assert.equal(outputs[1].advance,outputs[0].advance);
 assert.equal(outputs[1].partial,0.1+0.2);assert.equal(outputs[1].advance,Math.max(0,300.15-100.05));
 assert.match(outputs[1].html['dash-mc-pagado'].text,/\$[\d.]+,\d{2}$/);
});
test('Dashboard separates gross pending, advances due this month and actual payments without double counting an applied advance',async()=>{
 const f=fixture(),day='2026-10-14',cta={bonus:{tipo:'bonificacion',monto:175.25,estado:'aprobado',fecha:day,descripcion:'Tarea ficticia'},advance:{tipo:'adelanto',monto:350.50,estado:'pagado',fecha:day,fechaPago:day,montoPagado:350.50,pagos:{p:{monto:350.50,fecha:day,ts:5}}},salary:{tipo:'sueldo',monto:1345.60,sueldoBruto:1545.60,adelantoCompensado:200,adelantosAplicados:{previous:{monto:200,fecha:'2026-09-01'}},estado:'pagado',fecha:'2026-10-01',pagos:{p:{monto:1345.60,fecha:'2026-10-01',ts:1}}},oldAdvance:{tipo:'adelanto',monto:200,montoPagado:200,montoCompensado:200,estado:'pagado',fecha:'2026-09-01',fechaPago:'2026-09-01',pagos:{p:{monto:200,fecha:'2026-09-01'}}},paidBonus:{tipo:'bonificacion',monto:350.25,estado:'pagado',fecha:'2026-10-21',pagos:{p:{monto:350.25,fecha:'2026-10-21',ts:6}}}};
 [4.8,12.37,55.13].forEach((monto,i)=>cta['commission'+i]={tipo:'comision',monto,estado:'pagado',fecha:day,pagos:{p:{monto,fecha:day,ts:2+i}}});
 const before=JSON.stringify(cta);f.c.renderDashMiCuenta();await f.deliver(cta);
 assert.equal(f.elements.get('dash-mc-total').textContent,'$175,25');assert.equal(f.elements.get('dash-mc-pagado').textContent,'$2.118,65');assert.equal(f.elements.get('dash-mc-pagado-sub').textContent,'6 pagos registrados este mes');assert.equal(f.elements.get('dash-mc-comisiones').textContent,'$0,00');assert.equal(f.elements.get('dash-mc-comisiones-sub').textContent,'sin comisiones pendientes');assert.match(f.elements.get('dash-mc-total-sub').textContent,/Pendiente \$175,25.*\$0,00/);assert.equal(f.elements.get('dash-mc-adelantos').textContent,'$350,50');assert.equal(JSON.stringify(cta),before);assert.deepEqual(f.writes,[]);
});
test('Dashboard paid month follows payment date for old/future obligations, excludes annulled and state-only records, and deduplicates the linked CTA/Gastos mirror',async()=>{
 const f=fixture(),cta={old:{tipo:'bonificacion',monto:100.01,estado:'pagado',fecha:'2026-09-01',periodoComputo:'2026-09',gastoFbKey:'expense',descripcion:'Bonificación ficticia',pagos:{p:{monto:100.01,fecha:'2026-10-04'}}},future:{tipo:'sueldo',monto:80.02,estado:'pagado',fecha:'2026-11-01',pagos:{p:{monto:80.02,fecha:'2026-10-05'}}},voided:{tipo:'sueldo',monto:20,estado:'pagado',fecha:'2026-10-01',pagos:{p:{monto:20,fecha:'2026-10-06',anulado:true}}},marked:{tipo:'bonificacion',monto:30,estado:'pagado',fecha:'2026-10-01'},legacy:{tipo:'sueldo',monto:50.03,estado:'pagado',fecha:'2026-10-01',montoPagado:50.03}};
 f.c.gastosData=[{fbKey:'expense',empleadoId:'e',tipoPagable:'bonificacion',descripcion:'Bonificación ficticia',monto:100.01,estado:'pagado',fecha:'2026-09-01',periodoComputo:'2026-09',pagos:{p:{monto:100.01,fecha:'2026-10-04'}}}];const before=JSON.stringify([cta,f.c.gastosData]);f.c.renderDashMiCuenta();await f.deliver(cta);assert.equal(f.elements.get('dash-mc-pagado').textContent,'$230,06');assert.equal(f.elements.get('dash-mc-pagado-sub').textContent,'3 pagos registrados este mes');assert.equal(JSON.stringify([cta,f.c.gastosData]),before);assert.deepEqual(f.writes,[]);
});
test('a presentation error restores the previous employee selection',async()=>{const f=fixture();Object.defineProperty(f.elements.get('dash-mc-total'),'textContent',{set(value){if(value!=='—')throw Error('fictitious DOM failure');},get(){return '';}});f.c.renderDashMiCuenta();await f.deliver({});assert.equal(f.c.ctaEmpActual,'previous-selection');assert.equal(f.c._svCuentaDashboardReader.peek().status,'error');assert.deepEqual(f.writes,[]);});
test('CTA-only remote pushes update the own balance and payments without another source or any GET',async()=>{
 const f=fixture(),raw={salary:{tipo:'sueldo',monto:100.25,estado:'aprobado',fecha:'2026-10-01',descripcion:'Haber ficticio'}};f.c.renderDashMiCuenta();await f.deliver(raw);assert.equal(f.elements.get('dash-mc-total').textContent,'$100,25');
 await f.deliver({salary:{...raw.salary,pagos:{p:{monto:40.1,fecha:'2026-10-21'}},estado:'pagado_parcial'}});assert.equal(f.elements.get('dash-mc-total').textContent,'$60,15');assert.equal(f.elements.get('dash-mc-pagado').textContent,'$40,10');assert.equal(f.requests.length,1);assert.ok(f.requests.every(r=>r.kind==='watch'));assert.deepEqual(f.writes,[]);
});
test('Gastos projection requires its complete own source, never mixes another employee or presents a false zero',async()=>{
 const f=fixture();f.c._ctaEmpGastosSnapshot={origin:{employeeId:'other'},valid:()=>true,data:f.c.gastosData};f.c.renderDashMiCuenta();await f.deliver({});assert.equal(f.elements.get('dash-mc-total').textContent,'—');assert.match(f.elements.get('dash-historial-mes-body').innerHTML,/Actualizar gastos/);assert.equal(f.requests.length,1);
 f.c._ctaEmpGastosSnapshot={origin:{employeeId:'e'},valid:()=>true,data:f.c.gastosData};f.c.svRepintarCuentaDashboard();assert.equal(f.elements.get('dash-mc-total').textContent,'$0,00');assert.equal(f.requests.length,1);
});
test('real applyRole followed by synchronous role notification shares a valid pending/ready source',async()=>{
 const f=fixture();f.document.querySelectorAll=()=>[];f.c.svActualizarMasUsados=()=>{};f.c.rolActualNormalizado=()=>f.c.currentRole;f.c.SisVentas={Access:{emit:(name,detail)=>f.emit('sisventas:'+name,detail)}};vm.runInContext(extract(source,'svEsAdministradorFinanciero'),f.c);vm.runInContext(extract(source,'applyRole'),f.c);
 f.c.applyRole();assert.equal(f.requests.length,1);assert.equal(f.requests[0].stops,0);await f.deliver({});for(let i=0;i<3;i++)f.c.applyRole();assert.equal(f.requests.length,1);assert.equal(f.requests[0].stops,0);assert.equal(f.c._dashAvisosCTA.status,'ready');
 f.c.PERMISOS_ROLES.tecnico.indiceRevision++;f.c.applyRole();assert.equal(f.requests.length,2);assert.equal(f.requests[0].stops,1);assert.equal((await f.deliver({late:999},0)).calls,0);await f.deliver({},1);assert.equal(f.c._dashAvisosCTA.status,'ready');
});
test('SDK-ready event retires an old SDK immediately without acquiring from the new SDK',async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await f.deliver({});f.emit('firebase-ready');assert.equal(f.requests[0].stops,0);f.c.fbDB={};f.emit('firebase-ready');assert.equal(f.requests[0].stops,1);assert.equal(f.c._svCuentaDashboardReader.peek().status,'paused');assert.equal(f.requests.length,1);assert.equal(f.elements.get('dash-mc-total').textContent,'—');assert.match(f.elements.get('dash-historial-mes-body').innerHTML,/Actualizar cuenta/);
});
for(const mutate of [f=>f.c.fbDB={},f=>f.c.fbRef=(_db,path)=>({path}),f=>f.c.fbOnValue=()=>()=>{},f=>f.c._svDataEpoch=1,f=>f.c.PERMISOS_ROLES.tecnico.extra='changed',f=>f.elements.set('dash-historial-mes-body',{textContent:'new',innerHTML:'',style:{}})])test('ready source retires after SDK/data/DOM change and incidental render does not reopen: '+mutate.toString(),async()=>{
 const f=fixture();f.c.renderDashMiCuenta();await f.deliver({m:{tipo:'sueldo',monto:999,estado:'aprobado',fecha:'2026-10-01'}});mutate(f);f.c.renderDashMiCuenta();assert.equal(f.c._svCuentaDashboardReader.peek().status,'paused');assert.equal(f.requests[0].stops,1);assert.equal(f.requests.length,1);assert.equal(f.elements.get('dash-mc-total').textContent,'—');assert.equal((await f.deliver({},0)).calls,0);
});

for(const status of ['pending','ready'])test('returning visible automatically resumes the own account after '+status,async()=>{const f=fixture();f.c.renderDashMiCuenta();if(status==='ready')await f.deliver({old:{tipo:'bonificacion',estado:'aprobado',monto:1,fecha:'2026-10-01'}});f.document.hidden=true;f.emit('visibilitychange');assert.equal(f.requests[0].stops,1);for(let i=0;i<8;i++)f.emit('sisventas:foreground-restored');assert.equal(f.requests.length,1);f.document.hidden=false;f.emit('visibilitychange');for(let i=0;i<8;i++)f.emit('sisventas:foreground-restored');assert.equal(f.requests.length,2);assert.match(f.elements.get('dash-historial-mes-body').innerHTML,/Cargando la cuenta/);assert.doesNotMatch(f.elements.get('dash-historial-mes-body').innerHTML,/Actualizar cuenta/);assert.equal((await f.deliver({stale:{tipo:'bonificacion',estado:'aprobado',monto:99999,fecha:'2026-10-01'}},0)).calls,0);await f.deliver({fresh:{tipo:'bonificacion',estado:'aprobado',monto:123.45,fecha:'2026-10-01',descripcion:'Movimiento al regresar'}},1);assert.equal(f.c._svCuentaDashboardReader.peek().status,'ready');assert.match(f.elements.get('dash-historial-mes-body').innerHTML,/Movimiento al regresar/);assert.equal(f.elements.get('dash-mc-total').textContent,'$123,45');for(let i=0;i<20;i++){f.emit('sisventas:foreground-restored');f.c.renderDashMiCuenta();}assert.equal(f.requests.length,2);assert.deepEqual(f.writes,[]);});
for(const kind of ['page','permission','module','logout'])test('foreground return cannot bypass '+kind,async()=>{const f=fixture();f.c.renderDashMiCuenta();await f.deliver({});f.document.hidden=true;f.emit('visibilitychange');if(kind==='page')f.page.id='page-productos';if(kind==='permission')f.permissions.clear();if(kind==='module')f.modules.delete('dashboard');if(kind==='logout')f.c.isAuthenticated=false;f.document.hidden=false;f.emit('visibilitychange');f.emit('sisventas:foreground-restored');assert.equal(f.requests.length,1);assert.equal((await f.deliver({private:999},0)).calls,0);assert.deepEqual(f.writes,[]);});
test('no own-account read precedes startup permissions; completion can resume the route already on Dashboard',async()=>{const f=fixture();f.c._svInicioPantallaActual={permisosListos:false,vigente:()=>true};f.c.renderDashMiCuenta(true);f.emit('visibilitychange');f.emit('sisventas:foreground-restored');assert.equal(f.requests.length,0);f.c._svInicioPantallaActual.permisosListos=true;f.c.renderDashMiCuenta(true);assert.equal(f.requests.length,1);await f.deliver({});assert.equal(f.c._svCuentaDashboardReader.peek().status,'ready');});

test('directory arrival can bind an already complete authorized own Gastos source without transport',async()=>{const f=fixture();f.c._ctaEmpGastosSnapshot={origin:{employeeId:'e'},valid:()=>false,data:f.c.gastosData};f.c._ctaEmpGastosOrigen={employeeId:'e',valid:()=>true};f.c._gastosUnsubscribe=()=>assert.fail('The existing source is reused');f.c.renderDashMiCuenta();await f.deliver({bonus:{tipo:'bonificacion',monto:123.45,estado:'aprobado',fecha:'2026-10-01'}});assert.equal(f.elements.get('dash-mc-total').textContent,'$123,45');assert.equal(f.requests.length,1);assert.equal(f.c.svGastosCuentaDashboardVigentes('e'),true);assert.deepEqual(f.writes,[]);});
for(const kind of ['foreign','error','revoked','global-denied'])test('snapshot rebinding cannot substitute '+kind+' Gastos as complete',async()=>{const f=fixture();f.c._ctaEmpGastosSnapshot=null;f.c._ctaEmpGastosOrigen={employeeId:kind==='foreign'?'other':kind==='global-denied'?null:'e',valid:()=>kind!=='revoked'};f.c._gastosUnsubscribe=()=>{};if(kind==='error')f.c._gastosCargaError='Fictitious outage';f.c.renderDashMiCuenta();await f.deliver({});assert.equal(f.elements.get('dash-mc-total').textContent,'—');assert.equal(f.requests.length,1);assert.deepEqual(f.writes,[]);});
