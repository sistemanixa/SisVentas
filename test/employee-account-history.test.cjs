'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {load}=require('./helpers/app-functions.cjs');

function setup(records,manager=true) {
 const elements=new Map(),reads=[],writes=[],alerts=[],messages=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{id,style:{},value:'',textContent:'',innerHTML:'',className:''});return elements.get(id);};
 const context={window:{_ctaEmpVista:'pendientes',_ctaEmpPeriodoOffset:0,tienePermiso:p=>manager&&p==='empleados.verCuentas',permisoModulo:()=>true,svAlert:(message,options)=>{alerts.push({message,options});return Promise.resolve(true);},fbGet:p=>{reads.push(p);throw Error('Sin nuevas lecturas');},fbSet:(...a)=>{writes.push(a);throw Error('Sin escrituras');},fbUpdate:(...a)=>{writes.push(a);throw Error('Sin escrituras');}},document:{getElementById:el},isAuthenticated:true,currentUserUid:'fixture-user',ctaEmpActual:'fixture-e',empData:{},movsEmpData:structuredClone(records),gastosData:[],svEmpleadoPropio:()=>({fbKey:'fixture-e'}),_mesSistema:offset=>offset===-1?'2026-09':'2026-10',_buscarGastoRelacionadoMovEmp:()=>null,_renderPagosRealizadosEmp(){},_ctaEmpPagosRealizadosEnMes:()=>[],_ctaEmpAdelantosPendientes:()=>[],_ctaEmpAdelantosAplicadosEnMes:()=>[],renderComisionesDelMes(){},_puedeAprobarMovEmp:()=>false,_ctaEmpDescripcionHaberConDescuento:(_m,desc)=>String(desc),escapeHTML:v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),notify:m=>messages.push(m)};
 load(context,['_fechaCalendarioLocal','_fechaMes','_fechaEnMes','_ctaEmpNormalizarTxt','_ctaEmpFechaLocalDesdeTs','_ctaEmpFechaMovimiento','_ctaEmpEsCargo','_ctaEmpEsSueldoMovimiento','_movEmpPagosArray','pagoGastoEstaAnulado','_movEmpTotalPagado','_movEmpSaldoPendiente','_movEmpEstadoCalculado','_movEmpEstaPagado','_movEmpEsCobrable','_movEmpEnPeriodo','_ctaEmpMovHastaPeriodo','_ctaEmpMovVisibleParaRol','_movEmpFechaVisual','_ctaEmpPeriodoMes','ctaEmpPesos','renderMovsEmp','setCtaEmpPeriodo','verDetalleMovEmp']);
 load(context,['_ctaEmpMostrarComisionAnterior']);
 return {context,el,reads,writes,alerts,messages};
}
const commission=(key,changes={})=>({fbKey:key,_fuente:'ctaemp',tipo:'comision',fecha:'2025-02-10',descripcion:'Comisión histórica ficticia',estado:'pagado',monto:123.45,montoPagado:123.45,pct:3.5,gananciaBase:3527.142857,aprobadoPor:'Autor original',aprobadoTs:1000,...changes});

test('Todo el historial muestra una comisión pagada anterior al mes pasado con render real',()=>{
 const h=setup([commission('fixture-old')]),before=JSON.stringify(h.context.movsEmpData);
 for(const period of ['pendientes','actual','anterior']){h.context.setCtaEmpPeriodo(period);assert.doesNotMatch(h.el('ctaemp-tbody').innerHTML,/Comisión histórica ficticia/);}
 h.context.setCtaEmpPeriodo('todos');
 assert.match(h.el('ctaemp-tbody').innerHTML,/Comisión histórica ficticia/);
 assert.match(h.el('ctaemp-tbody').innerHTML,/10\/02\/2025/);
 assert.match(h.el('ctaemp-tbody').innerHTML,/123,45/);
 assert.match(h.el('ctaemp-tbody').innerHTML,/>Pagado</);
 assert.equal(h.el('ctaemp-listado-titulo').textContent,'Movimientos · todo el historial');
 assert.match(h.el('ctaemp-btn-historial').className,/btn-primary/);
 assert.equal(JSON.stringify(h.context.movsEmpData),before);assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);
});

test('Historial conserva filtros de tipo y estado sin traer otras cuentas ni cambiar el resumen mensual',()=>{
 const h=setup([commission('fixture-paid'),commission('fixture-unpaid',{descripcion:'Comisión aprobada ficticia',estado:'aprobado',monto:90,montoPagado:0}),commission('fixture-other-type',{tipo:'hextra',descripcion:'Horas ficticias',monto:50})]);
 h.context.setCtaEmpPeriodo('actual');const summary=h.el('ctaemp-periodo').textContent;
 h.el('ctaemp-filtro-tipo').value='comision';h.el('ctaemp-filtro-estado').value='pagado';
 h.context.setCtaEmpPeriodo('todos');
 assert.match(h.el('ctaemp-tbody').innerHTML,/Comisión histórica ficticia/);
 assert.doesNotMatch(h.el('ctaemp-tbody').innerHTML,/Comisión aprobada ficticia|Horas ficticias/);
 assert.equal(h.el('ctaemp-periodo').textContent,summary);assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);
});

test('Historial respeta la visibilidad de pendientes/rechazados para el empleado',()=>{
 const h=setup([commission('paid',{descripcion:'Pagada propia'}),commission('pending',{descripcion:'Pendiente privada',estado:'pendiente',montoPagado:0}),commission('rejected',{descripcion:'Rechazada privada',estado:'rechazado',montoPagado:0}),commission('approved',{descripcion:'Aprobada propia',estado:'aprobado',montoPagado:0})],false);
 h.context.setCtaEmpPeriodo('todos');
 assert.match(h.el('ctaemp-tbody').innerHTML,/Pagada propia/);
 assert.match(h.el('ctaemp-tbody').innerHTML,/Aprobada propia/);
 assert.doesNotMatch(h.el('ctaemp-tbody').innerHTML,/Pendiente privada|Rechazada privada/);
 assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);
});

test('La opción concreta del selector abre historial y volver a mes actual conserva el comportamiento anterior',()=>{
 const html=fs.readFileSync('index.html','utf8');
 const button=html.match(/<button[^>]*id="ctaemp-btn-historial"[^>]*onclick="setCtaEmpPeriodo\('([^']+)'\)"[^>]*>Todo el historial<\/button>/);
 assert.ok(button,'Falta el control de historial de la cuenta');
 const h=setup([commission('fixture-old'),commission('fixture-current',{fecha:'2026-10-12',descripcion:'Comisión actual ficticia'})]);
 h.context.setCtaEmpPeriodo(button[1]);assert.match(h.el('ctaemp-tbody').innerHTML,/Comisión histórica ficticia/);
 h.context.setCtaEmpPeriodo('actual');assert.doesNotMatch(h.el('ctaemp-tbody').innerHTML,/Comisión histórica ficticia/);assert.match(h.el('ctaemp-tbody').innerHTML,/Comisión actual ficticia/);
 assert.doesNotMatch(h.el('ctaemp-btn-historial').className,/btn-primary/);assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);
});

test('La comisión sólo legacy abre detalle readonly con valores, aprobación y pagos originales',()=>{
 const record=commission('fixture-old',{montoPagado:50,estado:'pagado_parcial',fechaAprobacion:'2025-02-11',pagos:{p1:{fecha:'2025-02-12',monto:50,medio:'Transferencia'},p2:{fecha:'2025-02-13',monto:20,medio:'Efectivo',anulado:true}}});
 const h=setup([record]),before=JSON.stringify(h.context.movsEmpData);
 h.context.verDetalleMovEmp({dataset:{fbkey:'fixture-old'}});
 assert.equal(h.alerts.length,1);const {message,options}=h.alerts[0];
 assert.equal(options.titulo,'Comisión anterior');assert.equal(options.textoAceptar,'Cerrar');assert.equal(options.centrado,true);assert.equal(options.desplazable,true);
 for(const text of ['123,45','3,5%','3.527,14','Pagado registrado: $50,00','Saldo: $73,45','Autor original','11/02/2025','12/02/2025 · $50,00 · Transferencia','13/02/2025 · $20,00 · Efectivo · Anulado'])assert.ok(message.includes(text),text);
 assert.equal(JSON.stringify(h.context.movsEmpData),before);assert.deepEqual(h.messages,[]);assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);
});

test('El detalle no inventa porcentaje, base ni desglose de un pago legado marcado pagado',()=>{
 const record=commission('fixture-old');delete record.pct;delete record.gananciaBase;delete record.montoPagado;
 const h=setup([record]);h.context.verDetalleMovEmp({dataset:{fbkey:'fixture-old'}});
 assert.equal(h.alerts.length,1);const {message}=h.alerts[0];
 assert.doesNotMatch(message,/Porcentaje:|Ganancia base:|Pagado registrado:|Saldo:/);
 assert.match(message,/Pagado · sin desglose de pago guardado/);
 assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);
});

test('El detalle legado comprueba sesión, módulo, cuenta y estado permitido sin filtrar datos en avisos',()=>{
 const cases=[h=>{h.context.isAuthenticated=false;},h=>{h.context.currentUserUid='';},h=>{h.context.window.permisoModulo=()=>false;},h=>{h.context.svEmpleadoPropio=()=>({fbKey:'fixture-other'});},h=>{h.context.movsEmpData[0].estado='pendiente';h.context.movsEmpData[0].montoPagado=0;}];
 for(const change of cases){const h=setup([commission('fixture-old')],false);change(h);h.context.verDetalleMovEmp({dataset:{fbkey:'fixture-old'}});assert.deepEqual(h.alerts,[]);assert.deepEqual(h.messages,[]);assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);}
 const own=setup([commission('fixture-old')],false);own.context.verDetalleMovEmp({dataset:{fbkey:'fixture-old'}});assert.equal(own.alerts.length,1);
});

test('El resto de movimientos conserva su detalle habitual y la comisión con gasto usa su gestión existente',()=>{
 const h=setup([commission('fixture-ordinary',{tipo:'hextra',descripcion:'Horas ficticias'}),commission('fixture-modern',{gastoFbKey:'fixture-gasto'})]);
 h.context.verDetalleMovEmp({dataset:{fbkey:'fixture-ordinary'}});
 assert.equal(h.messages.length,1);assert.match(h.messages[0],/H\. extra/);assert.deepEqual(h.alerts,[]);
 h.context.setCtaEmpPeriodo('todos');assert.match(h.el('ctaemp-tbody').innerHTML,/abrirComisionDesdeGasto\('fixture-gasto'\)/);
 assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);
});

test('Los pagos como array devuelven copias con índices sin añadir datos al snapshot',()=>{
 const h=setup([]),record={pagos:[{fecha:'2026-10-01',monto:10,ts:1},{fecha:'2026-10-02',monto:20,ts:9,anulado:true},null]};
 const before=JSON.stringify(record),views=h.context._movEmpPagosArray(record);
 assert.equal(JSON.stringify(record),before);
 assert.notEqual(views[0],record.pagos[0]);assert.notEqual(views[1],record.pagos[1]);
 assert.deepEqual(JSON.parse(JSON.stringify(views)),[{fecha:'2026-10-01',monto:10,ts:1,_idx:0},{fecha:'2026-10-02',monto:20,ts:9,anulado:true,_idx:1},{_idx:2}]);
});

test('Los pagos como mapa conservan orden descendente e identidad de clave sin mutar',()=>{
 const h=setup([]),record={pagos:{old:{fecha:'2026-10-01',monto:10,ts:1},recent:{fecha:'2026-10-02',monto:20,ts:9,estado:'anulado'},empty:null}};
 const before=JSON.stringify(record),views=h.context._movEmpPagosArray(record);
 assert.equal(JSON.stringify(record),before);assert.notEqual(views[0],record.pagos.recent);
 assert.deepEqual(Array.from(views,p=>p._key),['recent','old','empty']);
 assert.equal(views[0].estado,'anulado');assert.equal(views[1].monto,10);
 for(const value of [null,undefined,{}, {pagos:null}])assert.deepEqual(Array.from(h.context._movEmpPagosArray(value)),[]);
});

test('Totales e historial de pagos excluyen anulados sin cambiar claves del origen',()=>{
 const record=commission('fixture-payment',{fecha:'2026-10-12',estado:'aprobado',monto:100,montoPagado:0,pagos:{active:{fecha:'2026-10-12',monto:40,ts:1,medio:'Transferencia'},cancelled:{fecha:'2026-10-13',monto:20,ts:2,estado:'anulado'},outside:{fecha:'2026-09-12',monto:10,ts:3}}});
 const h=setup([record]),before=JSON.stringify(h.context.movsEmpData);
 load(h.context,['_ctaEmpPagosRealizadosEnMes']);
 const rows=h.context._ctaEmpPagosRealizadosEnMes(h.context.movsEmpData,'2026-10');
 assert.equal(rows.length,1);assert.equal(rows[0].pago._key,'active');assert.equal(rows[0].monto,40);assert.equal(rows[0].idx,2);
 assert.equal(h.context._movEmpTotalPagado(h.context.movsEmpData[0]),50);
 assert.equal(h.context._movEmpSaldoPendiente(h.context.movsEmpData[0]),50);
 h.context.setCtaEmpPeriodo('todos');
 assert.equal(JSON.stringify(h.context.movsEmpData),before);assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);
});

test('Comprobante y corrección explícita conservan el pago seleccionado en array y mapa',async()=>{
 const {createBackend,copy}=require('./helpers/labor-ui-flow.cjs');
 for(const format of ['array','map']) {
  const p1={fecha:'2026-10-12',monto:40,ts:1,medio:'Transferencia',comprobante:{data:'fixture:first'}},p2={fecha:'2026-10-13',monto:20,ts:2,medio:'Efectivo',comprobante:{data:'fixture:second'}};
  const pagos=format==='array'?[p1,p2]:{first:p1,second:p2},record=commission('fixture-payment',{pagos,gastoFbKey:'g',monto:100,montoPagado:60}),gasto={tipoPagable:'comision',monto:100,montoPagado:60,pagos:copy(pagos),legacyKey:'ctaemp/e/fixture-payment',empleadoFbKey:'e',aprobadoPor:'Autor original'};
  const backend=createBackend({ctaemp:{e:{'fixture-payment':record}},gastos:{g:gasto}}),p=backend.page(),h={context:p.context,el:p.node};h.context.movsEmpData=[copy(record)];h.context.ctaEmpActual='e';
  const before=JSON.stringify(h.context.movsEmpData),opened=[];
  h.context.abrirVisorComprobanteSistema=(comp,title)=>opened.push({comp,title});
  h.context.window.tienePermiso=()=>true;
  h.context._adelantoAprobarCtx=null;h.context.poblarSelectoresMediosPago=()=>{};h.context.cerrarAprobacionAdelanto=()=>{};h.context.fbCargarGastos=()=>{};
  h.context.formatoMedioPago=x=>x;h.context.escapeHTML=x=>String(x);
  load(h.context,['abrirComprobanteMovEmp','corregirMedioPagoMovEmp','confirmarAprobacionAdelanto']);
  h.context.abrirComprobanteMovEmp('fixture-payment',0);
  assert.equal(opened[0].comp.data,format==='array'?'fixture:first':'fixture:second');
  h.context.corregirMedioPagoMovEmp('fixture-payment',0);
  assert.equal(JSON.stringify(h.context.movsEmpData),before);assert.equal(backend.commits.length,0);
  h.el('adelanto-medio').value='Transferencia confirmada';
  await h.context.confirmarAprobacionAdelanto();
  assert.equal(backend.commits.length,1);assert.equal(backend.commands[0].kind,'atomic');
  const token=format==='array'?'0':'second';
  assert.equal(backend.get('sisventas/ctaemp/e/fixture-payment').pagos[token].medio,'Transferencia confirmada');
  assert.equal(backend.get('sisventas/gastos/g').pagos[token].medio,'Transferencia confirmada');
  assert.equal(backend.get('sisventas/gastos/g').montoPagado,60);
  assert.equal(JSON.stringify(h.context.movsEmpData),before);
 }
});

function dialogFixture() {
 let document;
 function element(tag) {
  const properties=new Map();
  return {tagName:tag.toUpperCase(),children:[],style:{setProperty(name,value,priority){properties.set(name,{value,priority:priority||''});},getPropertyValue:name=>properties.get(name)?.value||'',getPropertyPriority:name=>properties.get(name)?.priority||''},className:'',isConnected:true,setAttribute(){},appendChild(node){node.parentElement=this;this.children.push(node);return node;},remove(){this.isConnected=false;this.parentElement.children=this.parentElement.children.filter(n=>n!==this);},contains(node){return node===this||this.children.some(n=>n.contains(node));},getClientRects(){return this.isConnected?[{}]:[];},closest(){return null;},focus(){document.activeElement=this;}};
 }
 document={body:element('body'),activeElement:null,createElement:element,querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};
 const context=load({document,setTimeout:fn=>fn(),svSincronizarPilaModales(){}},['_svCrearDialogoSistema']);
 return {document,open:options=>context._svCrearDialogoSistema(options)};
}

test('El detalle centrado con muchos pagos reserva cabecera/Cerrar y desplaza sólo su mensaje',async()=>{
 const payments=Object.fromEntries(Array.from({length:300},(_,i)=>['p'+i,{fecha:'2025-02-12',monto:1,medio:'Transferencia ficticia '+i}]));
 const h=setup([commission('fixture-long',{pagos:payments})]);h.context.verDetalleMovEmp({dataset:{fbkey:'fixture-long'}});
 const {message,options}=h.alerts[0],f=dialogFixture(),pending=f.open({...options,tipo:'alert',mensaje:message});
 const overlay=f.document.body.children[0],panel=overlay.children[0],head=panel.children[0],body=panel.children[1],actions=panel.children[2];
 assert.equal(overlay.style.getPropertyValue('align-items'),'center');assert.equal(overlay.style.getPropertyPriority('align-items'),'important');
 assert.equal(panel.style.getPropertyValue('width'),'min(500px, calc(100vw - 32px))');assert.equal(panel.style.getPropertyPriority('width'),'important');assert.equal(panel.style.getPropertyPriority('max-width'),'important');
 assert.equal(panel.style.maxHeight,'calc(100dvh - 32px)');assert.equal(panel.style.overflow,'hidden');assert.equal(panel.style.display,'flex');assert.equal(panel.style.flexDirection,'column');
 assert.equal(head.style.flexShrink,'0');assert.equal(body.style.minHeight,'0');assert.equal(body.style.overflowY,'auto');assert.equal(body.style.overscrollBehavior,'contain');assert.equal(actions.style.flexShrink,'0');
 assert.equal(body.tabIndex,0);
 assert.equal(body.textContent,message);assert.ok(body.textContent.includes('Transferencia ficticia 299'));
 assert.equal(actions.children[0].textContent,'Cerrar');actions.children[0].onclick();assert.equal(await pending,true);assert.equal(f.document.body.children.length,0);
 assert.deepEqual(h.reads,[]);assert.deepEqual(h.writes,[]);
});

test('Los otros diálogos conservan su layout previo cuando no piden centrado o scroll propio',async()=>{
 const f=dialogFixture(),pending=f.open({tipo:'alert',mensaje:'Aviso habitual'}),overlay=f.document.body.children[0],panel=overlay.children[0];
 assert.equal(overlay.style.getPropertyValue('align-items'),'');assert.equal(panel.style.maxHeight,undefined);assert.equal(panel.children[1].style.overflowY,undefined);assert.equal(panel.children[2].style.flexShrink,undefined);
 panel.children[2].children[0].onclick();assert.equal(await pending,true);
});
