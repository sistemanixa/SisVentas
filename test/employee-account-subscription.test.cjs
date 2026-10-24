'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const active=require('./helpers/active-app').readActiveApp().source;
const baseline=fs.readFileSync(require.resolve('../js/app.v3.14.10.js'),'utf8').replace(/\r\n/g,'\n');
const details=fs.readFileSync(require.resolve('../js/modules/finance-details.js'),'utf8');
const baselineDetails=require('node:child_process').execFileSync('git',['show','2952ae512fed2d45474dfec8f722a6f5bf38af89:js/modules/finance-details.js'],{cwd:require('node:path').resolve(__dirname,'..'),encoding:'utf8',windowsHide:true});
function extract(source,name){const item=maps.get(source)?.get(name);if(item?.code)return item.code;const start=item?.start??source.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert.ok(start>=0,name);for(let end=source.indexOf('}',start);end>=0;end=source.indexOf('}',end+1)){const code=source.slice(start,end+1);try{new vm.Script(code);if(item)item.code=code;return code;}catch(_){}}throw Error(name);}
function functionMap(source){const result=new Map();for(const match of source.matchAll(/^(?:async )?function (\w+)\(/gm))result.set(match[1],{start:match.index,code:null});return result;}
const maps=new Map([[active,functionMap(active)],[baseline,functionMap(baseline)]]);
function fixture(source=active,{manager=false,ready=true,broad=false}={}){
 const subs=[],events=new Map(),timers=[],writes=[],elements=new Map(),notifications=[],page={id:'page-ctaemp'};
 function el(id){if(['ctaemp-migracion-banner','modal-nuevo','page-reportes','page-rentabilidad'].includes(id))return null;if(!elements.has(id)){const item={style:{},dataset:{},value:'',textContent:'',className:'',htmlWrites:0,setAttribute(){},remove(){elements.delete(id);}};let html='';Object.defineProperty(item,'innerHTML',{get:()=>html,set:value=>{html=value;item.htmlWrites++;}});elements.set(id,item);}return elements.get(id);}
 class Clock extends Date{constructor(...args){super(...(args.length?args:['2026-10-23T15:00:00Z']));}static now(){return new Date('2026-10-23T15:00:00Z').getTime();}}
 const permissions=new Set(manager?['empleados.verCuentas']:[]),auth={uid:'fixture-uid'},c={console,Date:Clock,Math,JSON,Promise,Set,Map,WeakMap,Object,Array,String,Number,parseFloat,isNaN,isFinite,
  document:{hidden:false,visibilityState:'visible',getElementById:el,querySelector:selector=>selector==='.page.active'?page:null,addEventListener:(name,fn)=>{if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}},
  isAuthenticated:true,currentUserUid:auth.uid,currentUser:'Persona ficticia',currentRole:manager?'admin':'tecnico',fbAuth:{currentUser:auth},fbDB:{},PERMISOS_ROLES:{admin:{indiceRevision:1},tecnico:{indiceRevision:1}},_svOperacionesSesionEpoch:0,_impersonacionOriginal:null,_ctaEmpLectura:null,_ctaEmpUnsubscribe:null,
  empData:{e:{fbKey:'e',nombre:'Persona ficticia',activo:true},other:{fbKey:'other',nombre:'Otra persona',activo:true}},CARGOS_DATA:{},own:{fbKey:'e'},svEmpleadoPropio:()=>c.own,
  ctaEmpActual:'',movsEmpData:[],gastosData:[],_gastosDataReady:ready,_gastosCargaError:'',_gastosUnsubscribe:null,_gastosPagosCache:null,_gastosFechaImputacionCache:null,_ctaEmpPeriodoOffset:0,_ctaEmpVista:'todos',_dashAvisosOrigen:null,_dashAvisosRetorno:null,_dashAvisosGeneracion:0,_dashAvisosCTA:null,_dashAvisosGastosFuente:null,_dashHorasPropias:null,
  tienePermiso:name=>permissions.has(name),permisoModulo:()=>true,_svEsPaginaActiva:name=>page.id==='page-'+name,SVForegroundSession:{isVisible:()=>!c.document.hidden},
  fbRef:(_db,path)=>path,fbOrderByChild:field=>({field}),fbEqualTo:value=>({value}),fbQuery:(path,field,value)=>({path,...field,...value}),fbOnValue:(ref,next,error)=>{const row={ref,path:typeof ref==='string'?ref:ref.path,next,error,stops:0};subs.push(row);return()=>{row.stops++;};},
  fbGet:()=>assert.fail('No GET'),fetch:()=>assert.fail('No HTTP'),fbSet:()=>{writes.push('set');assert.fail('No writes');},fbUpdate:()=>{writes.push('update');assert.fail('No writes');},fbPush:()=>assert.fail('No push'),fbRemove:()=>assert.fail('No remove'),fbRunTransaction:()=>assert.fail('No CAS'),
  setTimeout:(fn,delay)=>{timers.push({fn,delay});return timers.length;},setInterval:()=>assert.fail('No clock polling'),requestAnimationFrame:fn=>fn(),
  notify:text=>notifications.push(text),escapeHTML:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),formatoMedioPago:String,
  _paginaGastosActiva:()=>false,svPuedeLeerDominio:()=>broad,_actualizarBadgeSolicitudesGastos:()=>{},_programarTareasSecundariasGastos:()=>{},actualizarTarjetaComisionadosVenta:()=>{},marcarDashboardDatosSucios:()=>{},solicitarRenderDashboard:()=>{},actualizarBotonVolverCtaEmp:()=>{},
  _renderPagosRealizadosEmp:undefined};
 c.window=c;vm.createContext(c);
 const loaded=new Set(),map=maps.get(source);
 function load(name){if(loaded.has(name)||typeof c[name]==='function'||!map.has(name))return;const code=extract(source,name);loaded.add(name);for(const ref of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)){if(ref[1]!==name&&map.has(ref[1])&&typeof c[ref[1]]!=='function')load(ref[1]);}vm.runInContext(code,c);}
 for(const name of ['cargarCtaEmp','iniciarCtaEmp','abrirCuentaEmpleadoDesdeEmpleados','limpiarCtaEmpSinSeleccion','fbCargarGastos','setCtaEmpPeriodo','svDetenerEscuchasModulo'])load(name);
 if(source===active){const start=source.indexOf("document.addEventListener('sisventas:session-ended',svDetenerLecturaCtaEmp)");vm.runInContext(source.slice(start,source.indexOf('window._ctaEmpPeriodoOffset = 0;',start)),c);}
 vm.runInContext(source===baseline?baselineDetails:details,c);
 const entryStart=source.indexOf("if (id === 'ctaemp')"),entryEnd=source.indexOf("if (id === 'rentabilidad')",entryStart);assert.ok(entryStart>0&&entryEnd>entryStart);
 c.showPage=name=>{page.id='page-'+name;if(name==='ctaemp')vm.runInContext('(function(id){'+source.slice(entryStart,entryEnd)+'})("ctaemp");',c);emit('sisventas:page-changed',{page:name});};
 const cta=()=>subs.filter(row=>row.path.startsWith('sisventas/ctaemp/'));
 function deliverCTA(data,index=cta().length-1){cta()[index].next({val:()=>structuredClone(data)});}
 function deliverGastos(data){for(const row of subs.filter(row=>row.path==='sisventas/gastos')){const value=Object.fromEntries(Object.entries(data).filter(([,g])=>g[row.ref.field]===row.ref.value));row.next({val:()=>structuredClone(value)});}}
 function emit(name,detail={}){for(const fn of events.get(name)||[])fn({detail});}
 function output(){return{rows:JSON.parse(JSON.stringify(c.movsEmpData)),duplicates:JSON.parse(JSON.stringify(c._ctaEmpDuplicadosLegacy||[])),html:el('ctaemp-tbody').innerHTML.replace(/<div class="ctaemp-periodo-descuento"[^>]*>Descuento: [^<]*<\/div>/g,''),paymentHTML:el('ctaemp-pagos-tbody').innerHTML,paymentSummary:el('ctaemp-pagos-resumen').textContent,kpi:['ctaemp-base','ctaemp-haberes','ctaemp-adelantos','ctaemp-total','ctaemp-periodo'].map(id=>el(id).textContent)};}
 if(ready){c.fbCargarGastos();deliverGastos({});}
 return{c,subs,cta,events,timers,writes,el,page,permissions,elements,deliverCTA,deliverGastos,emit,output,load,notifications};
}
function data(){
 const movement=(tipo,monto,changes={})=>({tipo,monto,estado:'aprobado',fecha:'2026-10-12',descripcion:tipo+' ficticio',ts:20,...changes});
 const cta={'2':movement('hextra',0.1,{fecha:'2020-01-01',ts:1}),'10':movement('hextra',0.2,{fecha:'2020-01-01',ts:1}),float:movement('hextra',0.4,{fecha:'2020-01-01',ts:1}),
  salary:movement('sueldo',800,{sueldoBruto:1000,sueldoBase:1000,adelantoCompensado:200,pagos:{a:{monto:200,fecha:'2026-10-15',medio:'Efectivo'},void:{monto:100,fecha:'2026-10-15',anulado:true}},gastoFbKey:'salary'}),
  advance:movement('adelanto',200,{fecha:'2026-09-10',estado:'pagado',montoPagado:200,compensaciones:{'2026_10':75},ts:2}),
  sac:movement('aguinaldo',500,{fecha:'2025-06-20',semestre:'2025_S1',estado:'pagado',montoPagado:500,ts:3}),
  bonus:movement('bonificacion',399.95,{periodoComputo:'2026-11',bonificacionCantidad:5,bonificacionValorUnitario:79.99,gastoFbKey:'bonus'}),
  commission:movement('comision',123.45,{estado:'pagado_parcial',montoPagado:50,pct:3.5,gananciaBase:3527.142857,pagos:[{monto:50,fecha:'2026-10-16',medio:'Transferencia'},{monto:20,anulado:true}],ts:22}),
  rejected:movement('otro',10,{estado:'rechazado'}),cancelled:movement('materiales',20,{estado:'anulado'}),legacy:movement('transporte',33.33,{fecha:'',mes:'',descripcion:'Legacy sin fecha',ts:0}),
  collision:movement('bonificacion',399.95,{descripcion:'Colisión legacy',mes:'2026-10',ts:22})};
 const gastos={salary:{empleadoId:'e',tipoPagable:'sueldo',categoria:'Personal',monto:800,estado:'pagado_parcial',fecha:'2026-10-12',descripcion:'Haber ficticio',pagos:{paid:{monto:200,fecha:'2026-10-15'}},ts:20},
  bonus:{empleadoId:'e',empleadoFbKey:'e',tipoPagable:'bonificacion',categoria:'Personal',monto:399.95,estado:'aprobado',aprobadoTs:1,periodoComputo:'2026-11',fecha:'2026-10-12',descripcion:'Bonificación ficticia',ts:20},
  reimburse:{empleadoFbKey:'e',categoria:'Transporte',monto:51.23,estado:'pagado_parcial',fecha:'2026-10-20',descripcion:'Reintegro ficticio',pagos:{live:{monto:10,fecha:'2026-10-21'},void:{monto:20,anulado:true}},ts:23},
  foreign:{empleadoId:'other',monto:99999,estado:'pagado',fecha:'2026-10-01'}};
 return{cta,gastos};
}
test('la proyección compartida conserva los helpers monetarios y de membresía publicados10',()=>{
 assert.match(extract(active,'svAplicarCtaEmpDesdeSnapshot'),/svProyectarCTA\(data,empFbKey\)/);
 assert.match(extract(active,'renderDashMiCuenta'),/svRepintarCuentaDashboard\(\)/);
 assert.match(extract(active,'svRepintarCuentaDashboard'),/svPintarCuentaDashboard\(state.data\|\|\{\},key\)/);
 assert.match(extract(active,'svPintarCuentaDashboard'),/svProyectarCTA\(data,empFbKey\)/);
 for(const name of ['_movEmpTotalPagado','_movEmpSaldoPendiente','_ctaEmpMovimientoLegacyDuplicadoPorGasto','_ctaEmpEstadoDesdeGasto','_ctaEmpPagosRealizadosEnMes'])assert.equal(extract(active,name),extract(baseline,name),name);
});
test('paridad rica10/11 de registros/orden/HTML/KPI y todos los filtros sin escribir ni recortar',()=>{
 const input=data(),before=structuredClone(input),old=fixture(baseline,{manager:true}),next=fixture(active,{manager:true});
 for(const f of [old,next]){f.deliverGastos(input.gastos);f.c.cargarCtaEmp('e');f.deliverCTA(input.cta);}
 assert.equal(next.c._ctaEmpLectura.status,'ready');assert.ok(next.c.movsEmpData.length>5);
 assert.match(next.el('ctaemp-tbody').innerHTML,/class="ctaemp-periodo-descuento"[^>]*>Descuento: octubre de 2026/);
 assert.deepEqual(next.output(),old.output());
 for(const period of ['actual','anterior','todos','pendientes'])for(const type of ['','comision','bonificacion','hextra'])for(const state of ['','aprobado','pagado_parcial','pagado']){
  for(const f of [old,next]){f.el('ctaemp-filtro-tipo').value=type;f.el('ctaemp-filtro-estado').value=state;f.c.setCtaEmpPeriodo(period);}
  const expected=old.output();
  // This fixture delivered its advance in September: the new authorized rule
  // starts deducting it in October, while every payment/row stays unchanged.
  if(period==='anterior'){expected.kpi[3]='$34,03';assert.equal(next.c._adelantoDescontableEnMes(input.cta.advance,'2026-09'),false);}
  assert.deepEqual(next.output(),expected,period+'/'+type+'/'+state);
 }
 assert.deepEqual(input,before);assert.deepEqual(next.writes,[]);assert.equal(next.cta().length,1);
});
test('mismo guion: tres entregas Gastos conservan la cuenta sin recrear su escucha ni perder paridad',()=>{
 const input=data(),results=[];
 for(const source of [baseline,active]){const f=fixture(source,{manager:true});f.c.cargarCtaEmp('e');f.deliverCTA(input.cta);f.c.fbCargarGastos();
  const states=[];for(let i=0;i<3;i++){const gastos=structuredClone(input.gastos);gastos.reimburse.pagos.live.monto=10+i;f.deliverGastos(gastos);if(source===baseline)f.deliverCTA(input.cta);states.push(f.output());}
  results.push({states,registrations:f.cta().length,stops:f.cta().reduce((sum,row)=>sum+row.stops,0),writes:f.writes});}
 assert.deepEqual(results[1].states,results[0].states);assert.equal(results[0].registrations,7);assert.equal(results[1].registrations,1);assert.equal(results[1].stops,0);assert.deepEqual(results[1].writes,[]);
});
for(const order of ['CTA-first','Gastos-first'])test(order+' espera ambas fuentes, distingue error/vacío y conserva un solo listener',()=>{
 const f=fixture(active,{ready:false}),input=data();f.c.cargarCtaEmp('e');f.c.fbCargarGastos();
 if(order==='CTA-first'){f.deliverCTA(input.cta);assert.match(f.el('ctaemp-tbody').innerHTML,/Cargando los gastos/);f.deliverGastos(input.gastos);}else{f.deliverGastos(input.gastos);assert.match(f.el('ctaemp-tbody').innerHTML,/Cargando la cuenta/);f.deliverCTA(input.cta);}
 assert.equal(f.cta().length,1);assert.ok(f.c.movsEmpData.length>5);const size=f.cta().length;f.c._gastosDataReady=false;f.c._gastosCargaError='Fallo';f.c.svRepintarCtaEmpDesdeFuentes();assert.equal(f.el('ctaemp-total').textContent,'—');assert.match(f.el('ctaemp-tbody').innerHTML,/No se pudieron/);assert.equal(f.cta().length,size);
});
test('error CTA no se reintenta por Gastos/ensure/visible, pero el botón explícito sí abre una lectura',()=>{
 const f=fixture();f.c.cargarCtaEmp('e');f.cta()[0].error(Error('denied'));assert.match(f.el('ctaemp-tbody').innerHTML,/Reintentar/);for(let i=0;i<3;i++){f.c.cargarCtaEmp('e');f.c.svRepintarCtaEmpDesdeFuentes();}assert.equal(f.cta().length,1);assert.equal(f.el('ctaemp-total').textContent,'—');f.c.svReintentarLecturaCtaEmp();assert.equal(f.cta().length,2);f.deliverCTA({});assert.equal(f.c._ctaEmpLectura.status,'ready');
});
for(const mutate of [f=>f.c.fbAuth.currentUser={uid:'fixture-uid'},f=>f.c.currentUserUid='other',f=>f.c.currentRole='admin',f=>f.c.PERMISOS_ROLES.tecnico.indiceRevision++,f=>f.c._svOperacionesSesionEpoch++,f=>f.c._impersonacionOriginal={},f=>f.c.own={fbKey:'other'},f=>f.c.permisoModulo=()=>false])test('contexto cambiado retira copia/acciones y no interpreta snapshot tardío: '+mutate.toString(),()=>{
 const f=fixture();f.c.cargarCtaEmp('e');f.deliverCTA(data().cta);mutate(f);f.c.svRepintarCtaEmpDesdeFuentes();assert.equal(f.c._ctaEmpLectura,null);assert.equal(f.c.movsEmpData.length,0);assert.equal(f.cta()[0].stops,1);f.cta()[0].next({val(){assert.fail('No process stale');}});assert.equal(f.cta().length,1);
});
test('salir, timers250/300/360 y respuesta anterior no abren escucha; retorno sólo por nueva entrada',()=>{
 const f=fixture(active,{manager:true});f.c.ctaEmpActual='e';f.emit('sisventas:page-changed',{page:'ctaemp'});f.c.iniciarCtaEmp();assert.equal(f.cta().length,1);f.c.abrirCuentaEmpleadoDesdeEmpleados('e');assert.equal(f.timers.filter(timer=>timer.delay===360).length,1);
 f.page.id='page-productos';f.emit('sisventas:page-changed',{page:'productos'});for(const timer of f.timers)timer.fn();f.c.iniciarCtaEmp();assert.equal(f.cta().length,1);assert.equal(f.c._ctaEmpLectura,null);f.cta()[0].next({val(){assert.fail('No stale response');}});
 f.page.id='page-ctaemp';f.c.iniciarCtaEmp();assert.equal(f.cta().length,2);
});
test('entregas ocultas se guardan sin pintar/reescuchar; restaurar sólo proyecta memoria vigente',()=>{
 const f=fixture();f.c.cargarCtaEmp('e');f.deliverCTA({});const before=f.el('ctaemp-tbody').innerHTML;f.c.document.hidden=true;f.deliverCTA(data().cta);assert.equal(f.el('ctaemp-tbody').innerHTML,before);f.c.cargarCtaEmp('e');assert.equal(f.cta().length,1);f.c.document.hidden=false;f.emit('visibilitychange');assert.ok(f.c.movsEmpData.length>5);assert.equal(f.cta().length,1);
});
test('cambiar empleado/Ver como no reutiliza cuenta ajena; error síncrono no deja registro zombi',()=>{
 const f=fixture(active,{manager:true});f.c.cargarCtaEmp('e');f.deliverCTA(data().cta);f.c.cargarCtaEmp('other');assert.equal(f.cta().length,2);assert.equal(f.cta()[0].stops,1);assert.equal(f.c.movsEmpData.length,0);f.c._impersonacionOriginal={usuarioFbKey:'view'};f.c.svRepintarCtaEmpDesdeFuentes();assert.equal(f.c._ctaEmpLectura,null);
 const g=fixture();let stops=0;g.c.fbOnValue=(_ref,_next,error)=>{error(Error('sync'));return()=>stops++;};g.c.cargarCtaEmp('e');assert.equal(stops,1);assert.equal(g.c._ctaEmpLectura.status,'error');g.c.svDetenerLecturaCtaEmp();assert.equal(stops,1);
});
for(const entry of ['notice','employee'])for(const order of [[250,300,360],[360,300,250]])test('entrada '+entry+' orden'+order.join('/')+' conserva sólo la cuenta solicitada y una escucha',()=>{
 const f=fixture(active,{manager:true});f.c.ctaEmpActual='e';if(entry==='employee')f.c.abrirCuentaEmpleadoDesdeEmpleados('other');else f.c.showPage('ctaemp');
 for(const delay of order)for(const timer of f.timers.filter(item=>item.delay===delay))timer.fn();
 assert.equal(f.cta().length,1);assert.equal(f.cta()[0].path,'sisventas/ctaemp/'+(entry==='employee'?'other':'e'));assert.deepEqual(f.writes,[]);
});
test('handlers250/300/360 no sobreviven Auth nuevo con mismo UID, salida o entrada posterior',()=>{
 for(const mode of ['auth','out','new-entry']){const f=fixture(active,{manager:true});f.c.abrirCuentaEmpleadoDesdeEmpleados('e');const previous=f.timers.slice();
  if(mode==='auth')f.c.fbAuth.currentUser={uid:'fixture-uid'};
  if(mode==='out'){f.page.id='page-productos';f.emit('sisventas:page-changed',{page:'productos'});}
  if(mode==='new-entry'){f.page.id='page-productos';f.emit('sisventas:page-changed',{page:'productos'});f.c.abrirCuentaEmpleadoDesdeEmpleados('other');}
  for(const timer of previous)timer.fn();assert.equal(f.cta().length,0,mode);
  if(mode==='new-entry'){for(const timer of f.timers.filter(item=>!previous.includes(item)))timer.fn();assert.equal(f.cta().length,1);assert.equal(f.cta()[0].path,'sisventas/ctaemp/other');}
 }
});
test('error/carga/cambio de cuenta o permiso retiran pagos y comisiones de la presentación anterior',()=>{
 for(const kind of ['error','load','employee','role','permission','gastos']){const f=fixture(active,{manager:true});f.c.cargarCtaEmp('e');f.deliverCTA(data().cta);
  for(const id of ['ctaemp-pagos-card','ctaemp-comision-card','ctaemp-adelanto-pendiente'])f.el(id).style.display='';for(const id of ['ctaemp-pagos-tbody','ctaemp-com-lista','ctaemp-adelanto-pendiente'])f.el(id).innerHTML='Importes anteriores99999';for(const id of ['ctaemp-pagos-resumen','ctaemp-com-total','ctaemp-com-cobrado','ctaemp-com-pendiente','ctaemp-com-cant'])f.el(id).textContent='99999';
  if(kind==='error')f.cta()[0].error(Error('denied'));if(kind==='load'){f.c.svDetenerLecturaCtaEmp();f.c.cargarCtaEmp('e');}if(kind==='employee')f.c.cargarCtaEmp('other');if(kind==='role'){f.c.currentRole='tecnico';f.emit('sisventas:role-changed');}if(kind==='permission'){f.permissions.delete('empleados.verCuentas');f.c.svRepintarCtaEmpDesdeFuentes();}if(kind==='gastos'){f.c._gastosDataReady=false;f.c.svRepintarCtaEmpDesdeFuentes();}
  for(const id of ['ctaemp-pagos-card','ctaemp-comision-card','ctaemp-adelanto-pendiente'])assert.equal(f.el(id).style.display,'none',kind+'/'+id);for(const id of ['ctaemp-pagos-tbody','ctaemp-com-lista','ctaemp-adelanto-pendiente'])assert.equal(f.el(id).innerHTML,'',kind+'/'+id);for(const id of ['ctaemp-pagos-resumen','ctaemp-com-total','ctaemp-com-cobrado','ctaemp-com-pendiente','ctaemp-com-cant'])assert.equal(f.el(id).textContent,'—',kind+'/'+id);assert.deepEqual(f.writes,[]);
 }
});
for(const mutate of [f=>f.c.fbAuth.currentUser={uid:'fixture-uid'},f=>f.c.currentRole='admin',f=>f.c.PERMISOS_ROLES.tecnico.indiceRevision++,f=>f.c._impersonacionOriginal={usuarioFbKey:'v'},f=>f.c.own={fbKey:'other'}])test('ready Gastos anterior + CTA nueva vacía no demuestra cero tras '+mutate.toString(),()=>{
 const f=fixture();f.c.cargarCtaEmp('e');f.deliverCTA(data().cta);mutate(f);f.c.svRepintarCtaEmpDesdeFuentes();const key=f.c.own.fbKey;f.c.cargarCtaEmp(key);f.deliverCTA({});assert.equal(f.c._gastosDataReady,true);assert.equal(f.el('ctaemp-total').textContent,'—');assert.match(f.el('ctaemp-tbody').innerHTML,/incompleta/);assert.match(f.el('ctaemp-tbody').innerHTML,/Actualizar gastos/);assert.deepEqual(f.writes,[]);
});
test('Gastos propio de otro vínculo no acredita la cuenta nueva aunque entregue vacío',()=>{
 const f=fixture();f.c.own={fbKey:'other'};f.c.cargarCtaEmp('other');f.deliverCTA({});f.deliverGastos({});assert.equal(f.el('ctaemp-total').textContent,'—');assert.equal(f.cta().length,1);assert.match(f.el('ctaemp-tbody').innerHTML,/incompleta/);assert.match(f.el('ctaemp-tbody').innerHTML,/Actualizar gastos/);
});
test('snapshot administrativo all vigente cubre al empleado elegido sin otra lectura de Gastos',()=>{
 const f=fixture(active,{manager:true,broad:true});assert.equal(f.subs.filter(row=>row.path==='sisventas/gastos').length,1);f.deliverGastos(data().gastos);f.c.cargarCtaEmp('other');f.deliverCTA({});assert.equal(f.c._ctaEmpGastosSnapshot.origin.employeeId,null);assert.match(f.el('ctaemp-total').textContent,/0/);assert.equal(f.subs.filter(row=>row.path==='sisventas/gastos').length,1);assert.deepEqual(f.writes,[]);
});
test('recuperación real del productor Gastos restaura la vista sin recrear CTA',()=>{
 const f=fixture(),input=data();f.c.cargarCtaEmp('e');f.deliverCTA(input.cta);f.deliverGastos(input.gastos);const source=f.subs.find(row=>row.path==='sisventas/gastos');source.error(Error('Fallo ficticio'));assert.equal(f.el('ctaemp-total').textContent,'—');assert.match(f.el('ctaemp-tbody').innerHTML,/No se pudieron/);assert.equal(f.cta().length,1);
 assert.match(f.el('ctaemp-tbody').innerHTML,/Actualizar gastos/);f.c.svReintentarGastosCuenta();f.deliverGastos(input.gastos);assert.ok(f.c.movsEmpData.length>5);assert.doesNotMatch(f.el('ctaemp-total').textContent,/—/);assert.equal(f.cta().length,1);assert.deepEqual(f.writes,[]);
});
test('vínculo E→F ofrece recuperación manual acotada, sin CTA nueva ni consultas automáticas',()=>{
 const f=fixture(),oldSources=f.subs.filter(row=>row.path==='sisventas/gastos');f.c.own={fbKey:'other'};f.c.cargarCtaEmp('other');f.deliverCTA({});f.deliverGastos({});assert.equal(f.el('ctaemp-total').textContent,'—');assert.match(f.el('ctaemp-tbody').innerHTML,/incompleta/);assert.equal(f.subs.filter(row=>row.path==='sisventas/gastos').length,2);
 f.c.svReintentarGastosCuenta();assert.equal(f.subs.filter(row=>row.path==='sisventas/gastos').length,4);assert.ok(oldSources.every(row=>row.stops===1));assert.equal(f.cta().length,1);assert.match(f.el('ctaemp-tbody').innerHTML,/Cargando los gastos/);
 f.c.svReintentarGastosCuenta();assert.equal(f.subs.filter(row=>row.path==='sisventas/gastos').length,4);for(const row of oldSources)row.next({val(){assert.fail('No interpretar fuente retirada');}});
 f.deliverGastos({valid:{empleadoFbKey:'other',tipoPagable:'bonificacion',monto:150,estado:'aprobado',fecha:'2026-10-23'}});assert.equal(f.c.movsEmpData.length,1);assert.match(f.el('ctaemp-total').textContent,/150/);assert.equal(f.cta().length,1);assert.equal(f.c._ctaEmpGastosSnapshot.origin.employeeId,'other');assert.deepEqual(f.writes,[]);
});
test('recuperación Gastos no inicia transporte desde contexto viejo, oculto o fuera de la cuenta',()=>{
 for(const change of [f=>f.c.fbAuth.currentUser={uid:'fixture-uid'},f=>f.c.document.hidden=true,f=>f.page.id='page-productos']){const f=fixture();f.c.cargarCtaEmp('e');f.deliverCTA({});change(f);const count=f.subs.length;f.c.svReintentarGastosCuenta();assert.equal(f.subs.length,count);assert.deepEqual(f.writes,[]);}
});
test('Ver como y actualización manual conservan fuente administrativa all al volver a Admin',()=>{
 const f=fixture(active,{manager:true,broad:true});f.deliverGastos(data().gastos);const source=f.subs.find(row=>row.path==='sisventas/gastos');let all=true;f.c.svPuedeLeerDominio=()=>all;
 f.c.cargarCtaEmp('e');f.deliverCTA(data().cta);all=false;f.c._impersonacionOriginal={role:'admin',usuarioFbKey:'view'};f.c.currentRole='tecnico';f.c.own={fbKey:'other'};f.permissions.delete('empleados.verCuentas');f.c.cargarCtaEmp('other');f.deliverCTA({});assert.equal(f.el('ctaemp-total').textContent,'—');assert.match(f.el('ctaemp-tbody').innerHTML,/Actualizar gastos/);
 f.c.svReintentarGastosCuenta();assert.equal(f.subs.filter(row=>row.path==='sisventas/gastos').length,1);assert.equal(source.stops,0);assert.equal(f.c._ctaEmpGastosOrigen.employeeId,null);assert.equal(f.c.movsEmpData.length,1);assert.equal(f.c.movsEmpData[0].monto,99999);assert.doesNotMatch(f.el('ctaemp-total').textContent,/—/);assert.equal(f.cta().length,2);
 all=true;f.c._impersonacionOriginal=null;f.c.currentRole='admin';f.c.own={fbKey:'e'};f.permissions.add('empleados.verCuentas');f.c.fbCargarGastos();assert.equal(f.subs.filter(row=>row.path==='sisventas/gastos').length,1);assert.equal(source.stops,0);assert.ok(f.c.gastosData.some(row=>row.fbKey==='foreign'));assert.deepEqual(f.writes,[]);
});
test('productor propio no se toma como historial global al volver al alcance administrativo',()=>{
 const f=fixture(active,{manager:true,ready:false});let all=false;f.c.svPuedeLeerDominio=()=>all;f.c._impersonacionOriginal={role:'admin',usuarioFbKey:'view'};f.c.currentRole='tecnico';f.c.own={fbKey:'other'};f.permissions.delete('empleados.verCuentas');f.c.fbCargarGastos();f.deliverGastos(data().gastos);const own=f.subs.slice();assert.equal(f.c._ctaEmpGastosOrigen.employeeId,'other');
 all=true;f.c._impersonacionOriginal=null;f.c.currentRole='admin';f.c.own={fbKey:'e'};f.permissions.add('empleados.verCuentas');f.c.fbCargarGastos();assert.ok(own.every(row=>row.stops===1));const broad=f.subs.filter(row=>row.path==='sisventas/gastos'&&typeof row.ref==='string');assert.equal(broad.length,1);assert.equal(f.c._gastosDataReady,false);for(const row of own)row.next({val(){assert.fail('No fuente anterior');}});broad[0].next({val:()=>structuredClone(data().gastos)});assert.equal(f.c._ctaEmpGastosOrigen.employeeId,null);assert.equal(f.c._gastosDataReady,true);assert.ok(f.c.gastosData.some(row=>row.fbKey==='foreign'));assert.deepEqual(f.writes,[]);
});
test('revocar lectura global impide revalidar su memoria; recuperar sólo inicia el alcance propio vigente',()=>{
 const f=fixture(active,{manager:true,broad:true}),previous=f.subs.find(row=>row.path==='sisventas/gastos');f.deliverGastos(data().gastos);f.c.cargarCtaEmp('e');f.deliverCTA({});f.c.svPuedeLeerDominio=()=>false;f.c.PERMISOS_ROLES.admin.indiceRevision++;f.c.svRepintarCtaEmpDesdeFuentes();assert.equal(f.c._ctaEmpLectura,null);f.c.cargarCtaEmp('e');f.deliverCTA({});assert.equal(f.el('ctaemp-total').textContent,'—');
 f.c.svReintentarGastosCuenta();assert.equal(previous.stops,1);assert.equal(f.c._ctaEmpGastosOrigen.employeeId,'e');assert.equal(f.subs.filter(row=>row.path==='sisventas/gastos').length,3);previous.next({val(){assert.fail('No reutilizar snapshot administrativo revocado');}});f.deliverGastos(data().gastos);assert.ok(!f.c.gastosData.some(row=>row.fbKey==='foreign'));assert.equal(f.cta().length,2);assert.deepEqual(f.writes,[]);
});
test('reemplazar los contenedores o terminar sesión retira sólo la lectura CTA vigente',()=>{
 for(const mode of ['replace','session','stop']){const f=fixture();f.c.cargarCtaEmp('e');f.deliverCTA(data().cta);if(mode==='replace'){f.elements.delete('ctaemp-pagos-tbody');f.el('ctaemp-pagos-tbody');f.c.svRepintarCtaEmpDesdeFuentes();}if(mode==='session')f.emit('sisventas:session-ended');if(mode==='stop')f.c.svDetenerEscuchasModulo('ctaemp');assert.equal(f.c._ctaEmpLectura,null,mode);assert.equal(f.cta()[0].stops,1,mode);assert.ok(f.subs.filter(row=>row.path==='sisventas/gastos').every(row=>row.stops===0),mode);assert.equal(f.el('ctaemp-total').textContent,'—',mode);}
});
test('mismo dato evita reattach; el repintado HTML idéntico sigue siendo un límite explícito',()=>{
 const f=fixture(),input=data();f.c.cargarCtaEmp('e');f.deliverCTA(input.cta);f.deliverGastos(input.gastos);const body=f.el('ctaemp-tbody'),before=body.htmlWrites,html=body.innerHTML;f.deliverGastos(input.gastos);assert.equal(body.innerHTML,html);assert.ok(body.htmlWrites>before);assert.equal(f.cta().length,1);
});
