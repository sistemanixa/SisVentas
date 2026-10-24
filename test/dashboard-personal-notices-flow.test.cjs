const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const {source}=require('./helpers/active-app').readActiveApp();
const Model=require('../js/core/dashboard-personal-notices.v1.js');
const Hours=require('../js/core/dashboard-personal-hours.v1.js');
const AccountRead=require('../js/core/dashboard-account-source.v1.js');
function extract(text,name){
 const start=text.search(new RegExp('^(?:async )?function '+name+'\\(','m'));
 assert.ok(start>=0,name);const end=/^\}/gm;end.lastIndex=start;
 for(let match;(match=end.exec(text));){const result=text.slice(start,match.index+1);try{new vm.Script(result);return result;}catch(_){}}
 throw Error(name);
}
function fixture(text=source){
 const elements=new Map(),events=new Map(),requests=[],subscriptions=[],states=[],writes=[];
 for(const id of ['dash-personal-notices','dash-micuenta-card','dash-mc-hsextra-box','ctaemp-filtro-tipo','ctaemp-filtro-estado','ctaemp-volver-empleados','ctaemp-btn-historial'])elements.set(id,{style:{},dataset:{},textContent:'',innerHTML:'',value:'',className:''});
 const scroll={scrollTop:280},page={id:'page-dashboard'},auth={uid:'u'},permissions=new Set(['dashboard.miCuenta']);
 const document={hidden:false,body:{},documentElement:{},getElementById:id=>elements.get(id)||null,querySelector:selector=>selector==='.content'?scroll:selector==='.page.active'?page:null,addEventListener:(type,fn)=>{if(!events.has(type))events.set(type,[]);events.get(type).push(fn);},removeEventListener:(type,fn)=>{events.set(type,(events.get(type)||[]).filter(value=>value!==fn));}};
 document.activeElement=document.body;
 const c={console,Date,Math,Set,Map,WeakMap,Promise,Object,String,Array,Number,JSON,document,isAuthenticated:true,currentUserUid:'u',currentRole:'tecnico',currentUser:'Persona ficticia',gastosData:[],empData:{e:{fbKey:'e'}},ctaEmpActual:'',movsEmpData:[],_gastosUnsubscribe:null,_gastosDataReady:false,_gastosCargaError:'',_gastosPagosCache:null,_gastosFechaImputacionCache:null,_gastosTareasDiferidasTimer:null,
  _dashAvisosCTA:null,_dashAvisosGastosFuente:null,_dashAvisosGeneracion:0,_dashAvisosOrigen:null,_dashAvisosRetorno:null,_dashHorasPropias:null,
  _svOperacionesSesionEpoch:0,_impersonacionOriginal:null,PERMISOS_ROLES:{tecnico:{indiceRevision:1}},
  fbAuth:{currentUser:auth},fbDB:{},tienePermiso:p=>permissions.has(p),permisoModulo:p=>p==='ctaemp'||p==='dashboard',own:{fbKey:'e'},svEmpleadoPropio:()=>c.own,
  svPuedeLeerDominio:()=>false,_paginaGastosActiva:()=>false,_actualizarBadgeSolicitudesGastos:()=>{},_programarTareasSecundariasGastos:()=>{},actualizarTarjetaComisionadosVenta:()=>{},marcarDashboardDatosSucios:()=>{},solicitarRenderDashboard:()=>{},
  _svEsPaginaActiva:p=>page.id==='page-'+p,requestAnimationFrame:fn=>fn(),
  showPage:p=>{page.id='page-'+p;for(const fn of events.get('sisventas:page-changed')||[])fn({detail:{page:p}});},_mesSistema:()=>new Date().toISOString().slice(0,7),
  _ctaEmpMovimientoLegacyDuplicadoPorGasto:()=>false,_movEmpEnPeriodo:()=>true,_movEmpEsCobrable:()=>false,_ctaEmpTotalAdelantosRegistradosEnMes:()=>0,_ctaEmpMontoAdelantoACompensar:()=>0,
  _movEmpEstadoCalculado:m=>m.estado||'pendiente',_movEmpSaldoPendiente:m=>Number(m.monto)||0,
  location:{hash:'#/dashboard'},SVDashboardAccountSource:AccountRead,
  SVPersonalNotices:Model,SVPersonalNoticesView:{clear:()=>states.push({status:'none',items:[]}),render:(_box,state,options)=>states.push({...state,options})},
  SVPersonalHours:Hours,SVSessionRecovery:{deadline:task=>task},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://example.invalid'},SVServiceAuth:{headers:async()=>({Authorization:'Bearer ficticio'})},
  fetch:(p,options)=>new Promise((resolve,reject)=>requests.push({p,options,transport:'http',resolve,reject})),
  fbRef:(_db,p)=>p,fbGet:p=>new Promise((resolve,reject)=>requests.push({p,resolve,reject})),
  fbOnValue:(p,resolve,reject)=>{const row={p,path:p,kind:'fbOnValue',resolve,reject,stops:0};requests.push(row);return()=>row.stops++;},
  _svSuscribirGastos:(next,error)=>{const sub={next,error};subscriptions.push(sub);return()=>{sub.closed=true;};},
  fbSet:()=>{writes.push('set');assert.fail('No write');},fbUpdate:()=>{writes.push('update');assert.fail('No write');},fbRemove:()=>assert.fail('No write')};
 c.window=c;c.addEventListener=document.addEventListener;vm.createContext(c);
 const names=['svCapturarContextoOperacion','_ctaEmpNormalizarTxt','_ctaEmpTipoDesdeGasto','pagoGastoEstaAnulado','_gastoPagosArray','totalPagadoGasto','normalizarEstadoGasto','_ctaEmpEstadoDesdeGasto','_ctaEmpMovVisibleParaRol','fbCargarGastos','renderDashMiCuenta'];
 if(text===source)names.push('svMostrarEstadoCuentaDashboard','svGastosCuentaDashboardVigentes','svRepintarCuentaDashboard','svReintentarCuentaDashboard','svReintentarGastosDashboard','svPintarEstadoHorasCuentaDashboard','svReintentarHorasCuentaDashboard','svPresentarHorasCuentaDashboard','svPintarCuentaDashboard','svCrearOrigenGastosCuenta','svMarcarSnapshotGastosCuenta','svOrigenGastosCompatible','svContextoAvisosCuenta','svLimpiarAvisosCuentaPersonal','svAvisosReferenciaCuenta','svAvisosCuentaRegistro','svRenderAvisosCuentaPersonal','svOrigenAvisoCuentaVigente','svAbrirAvisoCuentaPersonal','svAplicarFiltroAvisoCuentaPersonal','actualizarBotonVolverCtaEmp','svCapturarHorasPersonalesDashboard','svLectorHorasPersonalesDashboard','svConsultarHorasPersonalesDashboard','svLimpiarHorasPersonalesDashboard','svPresentarHorasPersonalesTrasVisibilidad');
 if(text===source)names.push('svCancelarRetornoAvisoCuentaPersonal','svPrepararRetornoAvisoCuentaPersonal','svPaginaRetornoAvisoCuentaPersonal','svRestaurarRetornoAvisoCuentaPersonal','svProyectarCTA','_adelantoMesSiguiente','_adelantoPeriodoDescuento','_adelantoDescontableEnMes','_movEmpPagosArray','_ctaEmpPagosRealizadosEnMes','_fechaCalendarioLocal','_fechaMes','_fechaEnMes');
 if(text===source){c.SVCommissionPresentation=require('../js/core/commission-presentation.v1.js');for(const name of ['svEsComisionMovimiento','svDescripcionMovimientoVisible'])vm.runInContext(extract(text,name),c);}
 for(const name of names)vm.runInContext(extract(text,name),c);
 if(text===source){const a=source.indexOf("document.addEventListener('sisventas:session-ended',svLimpiarAvisosCuentaPersonal)");vm.runInContext(source.slice(a,source.indexOf('function renderDashMiCuenta(',a)),c);}
 const flush=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
 const nextGastos=data=>subscriptions.at(-1).next({val:()=>data});
 const resolveCTA=async(data,index)=>{await flush();if(index===undefined)index=requests.findIndex(r=>!r.done&&r.p.startsWith('sisventas/ctaemp/'));assert.ok(requests[index]);requests[index].done=true;requests[index].resolve({val:()=>data});await flush();for(const r of requests.filter(r=>!r.done&&(r.p==='sisventas/hsextra_solicitudes'||r.transport==='http'))){r.done=true;r.resolve(r.transport==='http'?{ok:true,status:200,json:async()=>({ok:true,employeeId:'e',records:[]})}:{val:()=>({})});}await flush();};
 return {c,elements,events,requests,subscriptions,states,writes,flush,nextGastos,resolveCTA,permissions,scroll,page,last:()=>states.at(-1)};
}
function pair(overrides={}){
 const now=Date.now(),fecha=new Date(now).toLocaleDateString('sv-SE');
 const shared={monto:125.25,tipo:'bonificacion',tipoPagable:'bonificacion',estado:'aprobado',empleadoId:'e',empleadoFbKey:'e',fecha,periodoComputo:'2026-11',aprobadoPor:'Administrador ficticio',aprobadoTs:now,ts:now,descripcion:'Reconocimiento ficticio',bonificacionCantidad:5,bonificacionValorUnitario:25.05,...overrides};
 return {cta:{m:{...shared,gastoFbKey:'g',legacyKey:'ctaemp/e/m'}},gastos:{g:{...shared,movimientoCtaKey:'m',legacyKey:'ctaemp/e/m'}}};
}

test('el par guardado6 se presenta una sola vez usando las dos fuentes existentes, en cualquier orden',async()=>{
 for(const order of ['gastos-first','cta-first']){
  const f=fixture(),p=pair();f.c.fbCargarGastos();f.c.renderDashMiCuenta();assert.equal(f.last().status,'loading');
  if(order==='gastos-first')f.nextGastos(p.gastos);
  await f.resolveCTA(p.cta);if(order==='cta-first'){assert.equal(f.last().status,'loading');f.nextGastos(p.gastos);await f.flush();}
  assert.equal(f.last().status,'ready');assert.equal(f.last().items.length,1);assert.equal(f.last().items[0].amount,125.25);assert.equal(f.last().items[0].quantity,5);assert.equal(f.last().items[0].period,'2026-11');assert.equal(f.last().items[0].status,'aprobado');
  assert.equal(f.requests.length,2);assert.equal(f.subscriptions.length,1);assert.deepEqual(f.writes,[]);
 }
});
test('un alta6 real en gateway/guard ficticios llega al adaptador activo con sus backlinks completos y sin duplicar',async()=>{
 const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
 const backend=createBackend({empleados:{e:{nombre:'Persona ficticia',activo:true},other:{nombre:'Otra persona',activo:true}}}),page=backend.page();
 page.context.SVBonusQuantity=require('../js/core/bonus-quantity-model');
 const Grant=require('../js/modules/bonus-grant'),attempt=Grant.create(page.context).prepare({context:()=>true,operacionId:'aviso_ficticio',empleados:[{empleadoId:'e',cantidad:5},{empleadoId:'other',cantidad:2}],valorUnitario:79.99,fecha:new Date().toLocaleDateString('sv-SE'),periodoComputo:'2026-11',motivo:'Instalación ficticia',concepto:{id:'ficticio',nombre:'Concepto ficticio'}});
 await Grant.create(page.context).register(attempt);
 const before=copy(backend.state),reads=backend.reads.length,commands=backend.commands.length,f=fixture();
 f.c.fbCargarGastos();f.nextGastos(backend.get('sisventas/gastos'));f.c.renderDashMiCuenta();await f.resolveCTA(backend.get('sisventas/ctaemp/e'));
 assert.equal(f.last().status,'ready');assert.equal(f.last().items.length,1);assert.equal(f.last().items[0].quantity,5);assert.equal(f.last().items[0].unitAmount,79.99);assert.equal(f.last().items[0].amount,399.95);assert.equal(f.last().items[0].period,'2026-11');
 assert.deepEqual(backend.state,before);assert.equal(backend.reads.length,reads);assert.equal(backend.commands.length,commands);assert.deepEqual(f.writes,[]);
});
test('la comisión legacy con rutaCTA completa y sin backlink corto se reconoce por identidad técnica',async()=>{
 const f=fixture(),p=pair({tipo:'comision',tipoPagable:'comision'});delete p.gastos.g.movimientoCtaKey;
 f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);
 assert.equal(f.last().status,'ready');assert.equal(f.last().items.length,1);assert.equal(f.last().items[0].sourceRefs.ctaKey,'m');
});
test('el adaptador conserva una comisión pagada con dos sellos de aprobación separados500ms del mismo día',async()=>{
 const f=fixture(),p=pair({tipo:'comision',tipoPagable:'comision',estado:'pagado',pagos:{payment:{monto:125.25,fecha:new Date().toLocaleDateString('sv-SE')}},montoPagado:125.25});
 const midday=new Date();midday.setHours(12,0,0,0);p.cta.m.aprobadoTs=midday.getTime();p.gastos.g.aprobadoTs=midday.getTime()+500;delete p.cta.m.periodoComputo;delete p.gastos.g.movimientoCtaKey;
 const before=JSON.stringify(p);f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);assert.equal(f.last().status,'ready');assert.equal(f.last().issues.length,0);assert.equal(f.last().items.length,1);assert.equal(f.last().items[0].status,'pagado');assert.equal(f.last().items[0].paidAmount,125.25);assert.equal(JSON.stringify(p),before);assert.deepEqual(f.writes,[]);
});
test('dos renders conservan una fuente CTA vigente y un endpoint propio; el legado mantiene sus cuatro GETs',async()=>{
 const baseline=fs.readFileSync(path.join(__dirname,'../js/app.v3.14.8.js'),'utf8'),results=[];
 for(const text of [baseline,source]){
  const f=fixture(text);f.c.fbCargarGastos();f.nextGastos({});
  for(let i=0;i<2;i++){f.c.renderDashMiCuenta();if(text!==source||i===0)await f.resolveCTA({});else await f.flush();}
  f.nextGastos({});f.c.fbCargarGastos();
  results.push({paths:f.requests.map(r=>r.p),http:f.requests.filter(r=>r.transport==='http').map(r=>r.options),listeners:f.subscriptions.length,writes:f.writes});
 }
 assert.deepEqual(results[0].paths,['sisventas/ctaemp/e','sisventas/hsextra_solicitudes','sisventas/ctaemp/e','sisventas/hsextra_solicitudes']);
 assert.deepEqual(results[1].paths,['sisventas/ctaemp/e','https://example.invalid/laboral/horas-propias']);
 assert.equal(results[1].paths.length,2);assert.equal(results[1].listeners,results[0].listeners);assert.equal(results[1].listeners,1);assert.deepEqual(results[1].writes,results[0].writes);assert.deepEqual(results[1].writes,[]);
 for(const options of results[1].http){assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');assert.equal(options.body,undefined);}
 // Server authorization reads are measured by the reader's tests, separately.
});
test('un snapshot de Gastos reevalúa pagos localmente sin GET y descarta pagos anulados',async()=>{
 const f=fixture(),p=pair();f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);
 const before=f.requests.length;
 f.nextGastos({g:{...p.gastos.g,pagos:{void:{monto:125.25,anulado:true}},montoPagado:125.25}});
 assert.equal(f.last().items[0].paidAmount,0);assert.equal(f.last().items[0].remaining,125.25);assert.equal(f.requests.length,before);
 f.nextGastos({g:{...p.gastos.g,pagos:{p:{monto:50}}}});
 assert.equal(f.last().status,'incomplete');assert.equal(f.last().items.length,0);assert.equal(f.requests.length,before);
});
test('bonificación pendiente_pago exige aprobación explícita; comisión conserva el mismo contrato',()=>{
 const f=fixture();for(const tipo of ['bonificacion','comision']){
  const base={tipoPagable:tipo,monto:100,estado:'pendiente_pago'};
  assert.equal(f.c._ctaEmpEstadoDesdeGasto(base),'pendiente');
  assert.equal(f.c._ctaEmpEstadoDesdeGasto({...base,aprobadoTs:1}),'aprobado');
  assert.equal(f.c._ctaEmpEstadoDesdeGasto({...base,aprobadoPor:'Admin'}),'aprobado');
  assert.equal(f.c._ctaEmpEstadoDesdeGasto({...base,pagos:{p:{monto:10}}}),'pagado_parcial');
  assert.equal(f.c._ctaEmpEstadoDesdeGasto({...base,pagos:{p:{monto:100}}}),'pagado');
  assert.equal(f.c._ctaEmpEstadoDesdeGasto({...base,estado:'anulado',aprobadoTs:1,pagos:{p:{monto:100}}}),'anulado');
 }
});
test('los estados propios aprobados, parciales y pagados permanecen visibles; los pendientes requieren permiso administrativo',async()=>{
 for(const type of ['bonificacion','comision'])for(const [raw,pagos,state] of [['aprobado',{},'aprobado'],['aprobado',{p:{monto:25}},'pagado_parcial'],['aprobado',{p:{monto:125.25}},'pagado']]){
  const f=fixture(),p=pair({tipo:type,tipoPagable:type,estado:raw,pagos});f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);
  assert.equal(f.last().items.length,1);assert.equal(f.last().items[0].status,state);
 }
 const f=fixture(),p=pair({estado:'pendiente_pago',aprobadoTs:null,aprobadoPor:''});f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);assert.equal(f.last().items.length,0);
 f.permissions.add('empleados.verCuentas');f.c.svRenderAvisosCuentaPersonal();assert.equal(f.last().items.length,0);f.c.renderDashMiCuenta(true);await f.resolveCTA(p.cta);assert.equal(f.last().items[0].status,'pendiente');
});
test('no expone otras personas, identificadores embebidos ni permisos de gestión ajenos',async()=>{
 const f=fixture(),p=pair();p.gastos.g.fbKey='forjado';p.gastos.other={...p.gastos.g,empleadoId:'other',empleadoFbKey:'other',monto:999};
 p.cta.foreign={...p.cta.m,empleadoId:'other',monto:999};f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);
 assert.equal(f.last().items.length,1);assert.equal(f.last().items[0].sourceRefs.gastoKey,'g');
 assert.ok(!JSON.stringify(f.last()).includes('999'));
});
test('no pierde la entrega de Gastos cuando los directorios propios llegan después',async()=>{
 const f=fixture(),p=pair();f.c.svPuedeLeerDominio=()=>true;f.c.own=null;f.c.fbCargarGastos();f.nextGastos(p.gastos);
 f.c.own={fbKey:'e'};f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);assert.equal(f.last().status,'ready');assert.equal(f.last().items.length,1);
});
test('un backlink cargado hacia otro beneficiario o contradictorio queda incompleto sin mostrar importes ajenos',async()=>{
 for(const side of ['gasto-foreign','cta-foreign','gasto-links','cta-links']){
  const f=fixture(),p=pair();
  if(side==='gasto-foreign')Object.assign(p.gastos.g,{empleadoId:'foreign',empleadoFbKey:'foreign',monto:99999});
  if(side==='cta-foreign')Object.assign(p.cta.m,{empleadoId:'foreign',empleadoFbKey:'foreign',monto:99999});
  if(side==='gasto-links')p.gastos.g.legacyKey='another';
  if(side==='cta-links')p.cta.m.gastoKey='another';
  f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);
  assert.equal(f.last().status,'incomplete');assert.equal(f.last().items.length,0);assert.ok(!JSON.stringify(f.last()).includes('99999'));
 }
});
for(const mutate of [c=>c.currentUserUid='other',c=>c.fbAuth.currentUser={uid:'u'},c=>c.fbAuth.currentUser.uid='other',c=>c.currentRole='admin',c=>c.PERMISOS_ROLES.tecnico.indiceRevision++,c=>c._svOperacionesSesionEpoch++,c=>c._impersonacionOriginal={},c=>c.own={fbKey:'other'}])test('respuesta tardía queda fuera del contexto: '+mutate.toString(),async()=>{
 const f=fixture(),p=pair();f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.flush();mutate(f.c);await f.resolveCTA(p.cta);
 assert.ok(!f.states.some(s=>s.status==='ready'&&s.items.length));f.c.svRenderAvisosCuentaPersonal();assert.equal(f.last().status,'none');
});
test('la última petición CTA gana; el error no se transforma en vacío confirmado',async()=>{
 const f=fixture(),p=pair();f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();f.c.renderDashMiCuenta();
 await f.resolveCTA(p.cta);assert.equal(f.requests.filter(r=>r.p.startsWith('sisventas/ctaemp/')).length,1);assert.equal(f.last().items.length,1);
 f.c.renderDashMiCuenta();await f.flush();f.requests.find(r=>r.p==='sisventas/ctaemp/e').reject(Error('offline'));await f.flush();assert.equal(f.last().status,'error');assert.equal(f.last().items.length,0);
});
test('error de Gastos, revocación y limpieza retiran avisos y acciones previos',async()=>{
 const f=fixture(),p=pair();f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);
 f.subscriptions[0].error(Error('denied'));assert.equal(f.last().status,'error');
 f.permissions.clear();f.c.svRenderAvisosCuentaPersonal();assert.equal(f.last().status,'none');assert.equal(f.c._dashAvisosCTA,null);assert.equal(f.c._dashAvisosGastosFuente,null);
});
test('ocultar, volver y preparar el filtro sólo renderizan memoria; la navegación conserva el lector normal',async()=>{
 const f=fixture(),p=pair();f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);
 const n=f.requests.length;f.c.document.hidden=true;f.c.svRenderAvisosCuentaPersonal();assert.equal(f.last().status,'none');
 f.c.document.hidden=false;f.c.svRenderAvisosCuentaPersonal();assert.equal(f.last().items.length,1);
 f.c.ctaEmpActual='other';f.c.movsEmpData=[{empleadoId:'other',monto:999}];
 f.c.svAbrirAvisoCuentaPersonal('bonificacion');assert.equal(f.page.id,'page-ctaemp');assert.equal(f.c.ctaEmpActual,'e');assert.equal(f.c.movsEmpData.length,0);f.c.svAplicarFiltroAvisoCuentaPersonal(f.c.own);
 assert.equal(f.elements.get('ctaemp-filtro-tipo').value,'bonificacion');assert.equal(f.c._ctaEmpVista,'todos');f.c.actualizarBotonVolverCtaEmp=()=>{};
 assert.equal(f.requests.length,n);assert.equal(f.subscriptions.length,1);assert.deepEqual(f.writes,[]);
 f.c._svOperacionesSesionEpoch++;f.c.svAbrirAvisoCuentaPersonal('comision');assert.equal(f.c._dashAvisosOrigen.type,'bonificacion');
});
test('retorno humano restaura filtros y espera la recarga normal antes de restituir scroll y foco',async()=>{
 const f=fixture(),p=pair();f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);
 f.c._ctaEmpVista='pendientes';f.c._ctaEmpPeriodoOffset=0;f.elements.get('ctaemp-filtro-tipo').value='sueldo';
 f.c.svAbrirAvisoCuentaPersonal('bonificacion');f.c.svAplicarFiltroAvisoCuentaPersonal(f.c.own);
 assert.ok(f.c.svOrigenAvisoCuentaVigente());f.c._ctaEmpDestinoVolver=()=> 'dashboard';f.c.actualizarBotonVolverCtaEmp();assert.equal(f.elements.get('ctaemp-volver-empleados').style.display,'');
 const doc=f.c.document,box=f.elements.get('dash-personal-notices'),oldRender=f.c.SVPersonalNoticesView.render;
 let focused=false,action=null;
 doc.activeElement=f.elements.get('ctaemp-volver-empleados');
 box.querySelector=()=>action;
 f.c.SVPersonalNoticesView.render=(element,state,options)=>{
  if(doc.activeElement===action)doc.activeElement=doc.body;
  action=['ready','incomplete'].includes(state.status)&&state.items.some(item=>item.type==='bonificacion')
   ?{isConnected:true,disabled:false,focus(opts){focused=opts.preventScroll;doc.activeElement=this;}}:null;
  box.hidden=state.status==='none';oldRender(element,state,options);
 };
 f.c.svPrepararRetornoAvisoCuentaPersonal({isTrusted:true});
 f.scroll.scrollTop=0;f.page.id='page-dashboard';for(const fn of [...f.events.get('sisventas:page-changed')])fn({detail:{page:'dashboard'}});
 const before=f.requests.length;
 f.c.svRenderAvisosCuentaPersonal(); // Cached Dashboard paint before its normal delayed load.
 assert.equal(focused,false);assert.equal(f.requests.length,before);assert.equal(f.scroll.scrollTop,0);
 assert.equal(f.elements.get('ctaemp-filtro-tipo').value,'sueldo');assert.equal(f.c._ctaEmpVista,'pendientes');assert.equal(f.c._dashAvisosOrigen,null);
 f.c.renderDashMiCuenta(); // The existing showPage 40ms callback; no additional reader in the notice.
 assert.equal(focused,false);assert.equal(action,null);assert.equal(f.last().status,'loading');
 await f.flush();
 const normalRequests=f.requests.length;
 await f.resolveCTA(p.cta);
 assert.equal(focused,true);assert.equal(doc.activeElement,action);assert.equal(f.scroll.scrollTop,280);assert.equal(f.c._dashAvisosRetorno,null);
 assert.equal(f.requests.filter(r=>r.p.startsWith('sisventas/ctaemp/')).length,2);
 // Include the ordinary Hs.extra reader started by renderDashMiCuenta in the
 // shared fixture's expected transport counts; do not present it as an extra
 // read added by the notice. A pure presentation call below must add none.
 const completeRequests=f.requests.length;assert.equal(completeRequests,4);assert.equal(normalRequests,3);
 f.c.svRenderAvisosCuentaPersonal();assert.equal(f.requests.length,completeRequests);assert.equal(f.subscriptions.length,1);assert.deepEqual(f.writes,[]);
});

test('los eventos de fin de sesión y cambio de rol borran la caché, acciones y datos personales',async()=>{
 for(const event of ['sisventas:session-ended','sisventas:role-changed']){
  const f=fixture(),p=pair();f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);f.c._svOperacionesSesionEpoch++;
  for(const fn of f.events.get(event))fn({});assert.equal(f.last().items.length,0);assert.equal(f.c._dashAvisosGastosFuente,null);
  if(event==='sisventas:session-ended')assert.equal(f.c._dashAvisosCTA,null);else{assert.equal(f.c._svCuentaDashboardReader.peek().status,'loading');assert.equal(f.requests.filter(r=>r.p==='sisventas/ctaemp/e').length,2);}
 }
});
test('revocar sólo miCuenta retira el aviso inmediatamente aunque rol y revisión no cambien',async()=>{
 const f=fixture(),p=pair();f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);assert.equal(f.last().items.length,1);
 f.permissions.delete('dashboard.miCuenta');for(const fn of f.events.get('sisventas:role-changed'))fn({});
 assert.equal(f.last().status,'none');assert.equal(f.c._dashAvisosCTA,null);assert.equal(f.c._dashAvisosGastosFuente,null);
});
test('Gastos delivered while CTA is open preserves notice origin and filters, then return acquires one fresh Dashboard source',async()=>{
 const f=fixture(),p=pair();f.c.fbCargarGastos();f.nextGastos(p.gastos);f.c.renderDashMiCuenta();await f.resolveCTA(p.cta);f.c.svAbrirAvisoCuentaPersonal('bonificacion');
 const origin=f.c._dashAvisosOrigen;assert.ok(origin);assert.equal(f.page.id,'page-ctaemp');assert.equal(f.c._dashAvisosCTA,null);assert.equal(f.c._svCuentaDashboardReader.peek().status,'paused');assert.equal(f.requests.find(r=>r.p==='sisventas/ctaemp/e').stops,1);
 f.nextGastos(p.gastos);assert.equal(f.c._dashAvisosOrigen,origin);assert.equal(f.c.svOrigenAvisoCuentaVigente(),true);assert.equal(f.c._svCuentaDashboardReader.peek().data,null);
 f.c.showPage('dashboard');assert.equal(f.requests.filter(r=>r.p==='sisventas/ctaemp/e').length,2);await f.resolveCTA(p.cta);assert.equal(f.c._dashAvisosCTA.status,'ready');assert.equal(f.c._dashAvisosOrigen,null);assert.deepEqual(f.writes,[]);
});
