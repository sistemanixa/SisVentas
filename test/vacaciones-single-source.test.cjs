'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {source,index}=require('./helpers/active-app').readActiveApp(),{load}=require('./helpers/app-functions.cjs');
const chunk=source.slice(source.indexOf('function svVacacionesEnPrimerPlano('),source.indexOf('\nfunction renderTablaVacaciones(',source.indexOf('function svVacacionesEnPrimerPlano(')));
const history={old:{empleadoId:'e1',empleadoNombre:'Persona ficticia',desde:'2016-01-02',hasta:'2016-01-17',dias:14,obs:'Original'},future:{empleadoId:'e1',empleadoNombre:'Persona ficticia',desde:'2030-12-01',hasta:'2030-12-15',dias:14}};
function fixture({full=true,hidden=false,syncError=false}={}){
 const listeners=[],renders=[],events=new Map(),nodes=Object.fromEntries(['vac-tbody','vac-periodos-tbody','vac-estado','vac-periodos-estado','vac-tabla','vac-periodos-tabla','vac-total','vac-pendientes','vac-activas','dash-vacaciones-aviso','dash-vacaciones-titulo','dash-vacaciones-detalle'].map(id=>[id,{style:{display:''},hidden:id.endsWith('-estado'),textContent:'old',innerHTML:id.endsWith('-estado')?'':'old',closest:()=>null}]));let activePage='vacaciones',own='e1',allowed=true;
 const page={classList:{contains:()=>activePage==='vacaciones'}};
 const c={window:null,console:{error(){}},Promise,Map,currentUserUid:'u1',currentRole:'admin',PERMISOS_ROLES:{admin:{indiceRevision:4}},_svOperacionesSesionEpoch:0,_svModuleListeners:{},fbDB:{},fbAuth:{currentUser:{uid:'u1'}},_vacPeriodos:[],empData:{e1:{fbKey:'e1',nombre:'Persona ficticia',activo:true,fechaIngreso:'2014-01-01'}},_empleadosDatosListos:true,
  document:{hidden,getElementById:id=>id==='page-vacaciones'?page:nodes[id]||null,addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}},
  svPuedeLeerDominio:()=>allowed&&full,svEmpleadoPropio:()=>own?{fbKey:own}:null,permisoModulo:()=>allowed,tienePermiso:()=>allowed,
  fbRef:(_db,path)=>path,fbOrderByChild:field=>field,fbEqualTo:value=>value,fbQuery:(path,field,value)=>({path,field,value}),
  fbGet:()=>assert.fail('Vacaciones no debe descargar otra vez la raíz'),fbOnValue(query,next,error){const listener={query,next,error,stops:0};listeners.push(listener);if(syncError)error(Error('Synchronous fictitious error'));return()=>listener.stops++;},
  renderTablaVacaciones:rows=>renders.push({kind:'table',rows:structuredClone(rows)}),renderPeriodosVacaciones:rows=>renders.push({kind:'periods',rows:structuredClone(rows)}),renderAvisoProximasVacaciones:()=>renders.push({kind:'notice'}),
  svFechaLocalISO:()=> '2026-10-23',setTimeout,clearTimeout,escapeHTML:v=>String(v??''),_mostrarFecha:v=>v,_normalizarNombreVacaciones:v=>String(v||'').toLowerCase(),_empleadoPorNombreVacaciones:()=>({fbKey:own}),
  SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},fetch:()=>assert.fail('No network in fixture')};c.window=c;vm.createContext(c);load(c,['svCapturarContextoOperacion','svPostventaEsperar']);vm.runInContext(chunk,c);
 return{c,nodes,listeners,renders,emit(name){for(const fn of events.get(name)||[])fn({detail:{page:activePage}});},snapshot(data,index=listeners.length-1){listeners[index].next({val:()=>data});},fail(index=listeners.length-1){listeners[index].error(Error('Fictitious error'));},page(value){activePage=value;},own(value){own=value;},permission(value){allowed=value;},full(value){full=value;},realRenderers(){load(c,['diasVacPorAntiguedad','renderTablaVacaciones','renderPeriodosVacaciones','renderAvisoProximasVacaciones']);}};
}
test('pending entry and legitimate empty results share one listener and no GET',()=>{
 const f=fixture();for(let i=0;i<3;i++)f.c.renderModuloVacaciones();assert.equal(f.listeners.length,1);assert.equal(f.c._vacLectura.status,'loading');f.snapshot(null);for(let i=0;i<3;i++)f.c.renderModuloVacaciones();assert.equal(f.listeners.length,1);assert.equal(f.c._vacLectura.status,'ready');assert.deepEqual(Array.from(f.c._vacPeriodos),[]);
});
test('all original history, array keys and updates remain intact without a stale fallback',()=>{
 const f=fixture();f.c.fbCargarVacaciones();f.snapshot(history);assert.deepEqual(JSON.parse(JSON.stringify(f.c._vacPeriodos)),Object.entries(history).map(([fbKey,p])=>({fbKey,...p})));f.c.renderModuloVacaciones();f.snapshot({...history,new:{...history.old,desde:'2031-01-01'}});assert.equal(f.c._vacPeriodos.length,3);assert.equal(f.listeners.length,1);
 f.snapshot([history.old,history.future]);assert.deepEqual(Array.from(f.c._vacPeriodos,p=>p.fbKey),['0','1']);
});
for(const change of ['uid','auth','role','revision','epoch','view','permission'])test('old delivery is rejected before reading data after '+change,()=>{
 const f=fixture();f.c.fbCargarVacaciones();f.snapshot(history);const renders=f.renders.length;
 if(change==='uid')f.c.currentUserUid='u2';if(change==='auth')f.c.fbAuth.currentUser={uid:'u1'};if(change==='role')f.c.currentRole='tecnico';if(change==='revision')f.c.PERMISOS_ROLES.admin.indiceRevision++;if(change==='epoch')f.c._svOperacionesSesionEpoch++;if(change==='view')f.c._impersonacionOriginal={uid:'u1'};if(change==='permission')f.permission(false);
 f.listeners[0].next({val:()=>assert.fail('retired snapshot must not be decoded')});assert.equal(f.listeners[0].stops,1);assert.equal(f.renders.length,renders);assert.equal(f.c._vacPeriodos.length,0);
});

test('missing or mismatched Auth identity cannot start an all or own query',()=>{
 for(const full of [true,false])for(const auth of [null,{uid:'other'}]){const f=fixture({full});f.c.fbAuth.currentUser=auth;f.c.fbCargarVacaciones();assert.equal(f.listeners.length,0);assert.equal(f.c._vacPeriodos.length,0);}
});

test('reference and query construction failures become terminal errors without a stuck loader',()=>{
 for(const name of ['fbRef','fbQuery']){const f=fixture({full:name==='fbRef'}),original=f.c[name];f.c[name]=()=>{throw Error('Fictitious construction failure');};f.c.fbCargarVacaciones();assert.equal(f.c._vacLectura.status,'error');assert.equal(f.listeners.length,0);f.c[name]=original;f.c.fbCargarVacaciones();assert.equal(f.listeners.length,0);if(name==='fbRef'){assert.match(f.nodes['vac-estado'].innerHTML,/Reintentar/);f.c.svReintentarVacaciones();assert.equal(f.listeners.length,1);f.snapshot(null);assert.equal(f.c._vacLectura.status,'ready');}}
});
test('own query is reused and replaced exactly once when the employee link changes',()=>{
 const f=fixture({full:false});f.c.fbCargarVacaciones();assert.deepEqual(f.listeners[0].query,{path:'sisventas/vacaciones',field:'empleadoId',value:'e1'});for(let i=0;i<3;i++)f.c.fbCargarVacaciones();assert.equal(f.listeners.length,1);f.own('e2');f.c.fbCargarVacaciones();assert.equal(f.listeners.length,2);assert.equal(f.listeners[0].stops,1);assert.equal(f.listeners[1].query.value,'e2');f.fail(0);assert.equal(f.listeners[1].stops,0);f.snapshot({p:{empleadoId:'e2'}});assert.equal(f.c._vacPeriodos[0].empleadoId,'e2');
});
test('own scope never masquerades as all after the role changes',()=>{
 const f=fixture({full:false});f.c.fbCargarVacaciones();f.snapshot({p:{empleadoId:'e1'}});f.full(true);f.c.renderModuloVacaciones();assert.equal(f.listeners.length,2);assert.equal(f.listeners[1].query,'sisventas/vacaciones');assert.equal(f.c._vacLectura.status,'loading');assert.equal(f.c._vacPeriodos.length,0);
});
test('hidden delivery is held in authorized memory and restoration adds no query',()=>{
 const f=fixture();f.c.fbCargarVacaciones();f.c.document.hidden=true;const count=f.renders.length;f.snapshot(history);assert.equal(f.renders.length,count);f.c.document.hidden=false;f.emit('sisventas:foreground-restored');assert.equal(f.listeners.length,1);assert.ok(f.renders.length>count);
 const cold=fixture({hidden:true});cold.c.fbCargarVacaciones();assert.equal(cold.listeners.length,0);cold.c.document.hidden=false;cold.emit('visibilitychange');assert.equal(cold.listeners.length,1);
});
test('page changes fence painters without retiring the shared data consumer',()=>{
 const f=fixture();f.c.fbCargarVacaciones();f.page('dashboard');const count=f.renders.filter(r=>r.kind==='table').length;f.snapshot(history);assert.equal(f.renders.filter(r=>r.kind==='table').length,count);f.page('vacaciones');f.c.renderModuloVacaciones();assert.equal(f.listeners.length,1);assert.ok(f.renders.some(r=>r.kind==='table'));
});
test('terminal failure is distinct from empty and retries only after a manual action',()=>{
 const f=fixture();f.c.renderModuloVacaciones();f.fail();assert.equal(f.c._vacLectura.status,'error');assert.equal(f.listeners[0].stops,1);for(let i=0;i<3;i++){f.c.renderModuloVacaciones();f.emit('sisventas:foreground-restored');}assert.equal(f.listeners.length,1);assert.match(f.nodes['vac-estado'].innerHTML,/Reintentar/);assert.doesNotMatch(f.nodes['vac-periodos-estado'].innerHTML,/Reintentar/);assert.equal(f.nodes['vac-tbody'].innerHTML,'');assert.equal(f.nodes['vac-periodos-tbody'].innerHTML,'');f.c.svReintentarVacaciones();f.c.svReintentarVacaciones();assert.equal(f.listeners.length,2);f.fail(0);assert.equal(f.listeners[1].stops,0);f.snapshot(null);assert.equal(f.c._vacLectura.status,'ready');
});
test('synchronous SDK failure releases the returned transport exactly once',()=>{const f=fixture({syncError:true});f.c.fbCargarVacaciones();assert.equal(f.listeners[0].stops,1);assert.equal(f.c._vacLectura.status,'error');});
test('real renderers do not invent balances or empty periods while loading or failed',()=>{
 const f=fixture();f.realRenderers();f.c.fbCargarVacaciones();f.c.renderTablaVacaciones([]);f.c.renderPeriodosVacaciones([]);assert.match(f.nodes['vac-estado'].innerHTML,/Cargando períodos/);assert.equal(f.nodes['vac-pendientes'].textContent,'—');f.fail();f.c.renderTablaVacaciones([]);f.c.renderPeriodosVacaciones([]);assert.match(f.nodes['vac-periodos-estado'].innerHTML,/No se pudieron/);assert.doesNotMatch(f.nodes['vac-periodos-estado'].innerHTML,/Sin períodos registrados/);assert.equal(f.nodes['vac-periodos-tbody'].innerHTML,'');
});

test('unconfirmed data removes prior KPI captions and employee tooltips',()=>{
 const f=fixture(),metrics={};f.realRenderers();
 for(const id of ['vac-total','vac-pendientes','vac-activas']){
  const metric={sub:{textContent:'Resultado anterior'},title:'Personas del resultado anterior',querySelector(selector){assert.equal(selector,'.m-sub');return this.sub;},removeAttribute(name){assert.equal(name,'title');delete this.title;}};
  metrics[id]=metric;f.nodes[id].closest=selector=>{assert.equal(selector,'.metric');return metric;};
 }
 function assertNoPriorResult(){for(const id of Object.keys(metrics)){assert.equal(f.nodes[id].textContent,'—');assert.equal(metrics[id].sub.textContent,'—');assert.equal(Object.hasOwn(metrics[id],'title'),false);}}
 f.c.fbCargarVacaciones();assertNoPriorResult();f.snapshot(history);
 assert.match(metrics['vac-pendientes'].sub.textContent,/empleado/);assert.match(metrics['vac-pendientes'].title,/Persona ficticia/);
 f.fail();assertNoPriorResult();assert.equal(f.listeners.length,1);
});

test('loading and error stay outside wide tables, clear old rows and restore ready tables',()=>{
 for(const prefix of ['vac','vac-periodos']){
  const status=index.indexOf('id="'+prefix+'-estado"'),table=index.indexOf('<table id="'+prefix+'-tabla"');
  assert.ok(status>=0&&status<table,'El estado debe preceder a su tabla');
  assert.ok(index.lastIndexOf('<table',status)<index.lastIndexOf('</table>',status),'El estado no debe quedar dentro de una tabla');
  assert.match(index.slice(status,index.indexOf('>',status)),/role="status"[^>]*aria-live="polite"/);
 }
 const f=fixture();f.realRenderers();f.c.fbCargarVacaciones();
 function statusIs(message){for(const prefix of ['vac','vac-periodos']){assert.equal(f.nodes[prefix+'-estado'].hidden,false);assert.match(f.nodes[prefix+'-estado'].innerHTML,message);assert.equal(f.nodes[prefix+'-tabla'].style.display,'none');}assert.equal(f.nodes['vac-tbody'].innerHTML,'');assert.equal(f.nodes['vac-periodos-tbody'].innerHTML,'');}
 function tablesAreReady(){for(const prefix of ['vac','vac-periodos']){assert.equal(f.nodes[prefix+'-estado'].hidden,true);assert.equal(f.nodes[prefix+'-estado'].innerHTML,'');assert.equal(f.nodes[prefix+'-tabla'].style.display,'');}}
 statusIs(/Cargando períodos/);f.snapshot(history);tablesAreReady();assert.match(f.nodes['vac-periodos-tbody'].innerHTML,/2016-01-02/);
 f.fail();statusIs(/No se pudieron/);assert.equal((['vac-estado','vac-periodos-estado'].map(id=>f.nodes[id].innerHTML).join('').match(/<button\b/g)||[]).length,1);
 f.c.svReintentarVacaciones();f.c.svReintentarVacaciones();assert.equal(f.listeners.length,2);statusIs(/Cargando períodos/);assert.doesNotMatch(f.nodes['vac-estado'].innerHTML,/Reintentar/);
 f.snapshot(null);tablesAreReady();assert.match(f.nodes['vac-periodos-tbody'].innerHTML,/Sin períodos registrados/);assert.equal(f.listeners.length,2);
});

test('hidden error or ready deliveries do not change presentation and restore without another query',()=>{
 for(const deliver of ['error','ready']){
  const f=fixture();f.realRenderers();f.c.fbCargarVacaciones();f.snapshot(history);f.c.document.hidden=true;
  const presentation=()=>JSON.stringify(Object.fromEntries(Object.entries(f.nodes).map(([id,node])=>[id,{hidden:node.hidden,display:node.style.display,html:node.innerHTML,text:node.textContent}]))),before=presentation();
  if(deliver==='error')f.fail();else f.snapshot({replacement:{...history.old,desde:'2031-01-02'}});
  assert.equal(presentation(),before,'Una entrega oculta no debe repintar ni ocultar tablas');assert.equal(f.listeners.length,1);
  f.c.document.hidden=false;f.emit('sisventas:foreground-restored');assert.equal(f.listeners.length,1);
  if(deliver==='error'){assert.equal(f.nodes['vac-tabla'].style.display,'none');assert.equal(f.nodes['vac-tbody'].innerHTML,'');assert.match(f.nodes['vac-estado'].innerHTML,/No se pudieron/);}
  else{assert.equal(f.nodes['vac-periodos-tabla'].style.display,'');assert.equal(f.nodes['vac-periodos-estado'].hidden,true);assert.match(f.nodes['vac-periodos-tbody'].innerHTML,/2031-01-02/);assert.doesNotMatch(f.nodes['vac-periodos-tbody'].innerHTML,/2016-01-02/);}
 }
});
test('real renderers preserve ready empty and all historical period rows',()=>{
 const f=fixture();f.realRenderers();f.c.fbCargarVacaciones();f.snapshot(null);assert.match(f.nodes['vac-periodos-tbody'].innerHTML,/Sin períodos registrados/);f.snapshot(history);assert.ok(f.nodes['vac-periodos-tbody'].innerHTML.includes('2016-01-02'));assert.ok(f.nodes['vac-periodos-tbody'].innerHTML.includes('2030-12-01'));
});
test('session and role cleanup retire the transport and remove the prior warning',()=>{
 for(const name of ['sisventas:session-ended','sisventas:role-changed']){const f=fixture();f.c.fbCargarVacaciones();f.snapshot(history);f.emit(name);assert.equal(f.listeners[0].stops,1);assert.equal(f.c._vacPeriodos.length,0);assert.equal(f.nodes['dash-vacaciones-aviso'].style.display,'none');}
});
test('OT availability joins the same pending source, rejects error and preserves the existing consumer contract',async()=>{
 const f=fixture();load(f.c,['svConsultarDisponibilidadVacaciones']);const pending=f.c.svConsultarDisponibilidadVacaciones();assert.equal(f.listeners.length,1);f.snapshot(history);await pending;assert.equal(f.listeners.length,1);f.fail();await assert.rejects(f.c.svConsultarDisponibilidadVacaciones(),/disponibilidad/);assert.equal(f.listeners.length,1);
});
test('OT waiting is cancelled by a changed session and cannot accept its later snapshot',async()=>{
 const f=fixture();load(f.c,['svConsultarDisponibilidadVacaciones']);const pending=f.c.svConsultarDisponibilidadVacaciones();f.emit('sisventas:session-ended');await assert.rejects(pending,/cancelada/);assert.equal(f.listeners[0].stops,1);
});
test('baseline11 reproduces the duplicate GET source that this candidate removes',()=>{
 const baseline=fs.readFileSync(require('node:path').join(__dirname,'../js/app.v3.14.11.js'),'utf8');const a=baseline.indexOf('function renderModuloVacaciones()'),b=baseline.indexOf('\n}',a)+2;let gets=0;const c={window:{_vacPeriodos:[],fbDB:{},fbRef:(_db,p)=>p,fbGet:()=>{gets++;return new Promise(()=>{});}},svPuedeLeerDominio:()=>true};vm.runInNewContext(baseline.slice(a,b),c);for(let i=0;i<6;i++)c.renderModuloVacaciones();assert.equal(gets,6);
});
