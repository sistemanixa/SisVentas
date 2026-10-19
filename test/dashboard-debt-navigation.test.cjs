'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {readActiveApp}=require('./helpers/active-app');
const {load}=require('./helpers/app-functions.cjs');
const {index}=readActiveApp();

function fixture({allowed=true,authenticated=true,blocked=false}={}){
 const classes=initial=>{const values=new Set(initial);return {add:name=>values.add(name),remove:name=>values.delete(name),contains:name=>values.has(name)};};
 const card={style:{display:'none'}},metrics={style:{display:'none'}},detail={style:{display:'block'}};
 const dashboard={id:'page-dashboard',classList:classes(['active'])};
 const page={id:'page-cuentacorriente',classList:classes([]),querySelector:selector=>selector===':scope > .card'?card:selector===':scope > .metrics'?metrics:null};
 const search={value:'Cliente ficticio A'},counter={textContent:''},content={scrollTop:90},title={textContent:'Dashboard'},amount={textContent:'$123,45'};
 const rows=[{textContent:'Cliente ficticio A',dataset:{saldo:'123.45'},style:{}},{textContent:'Cliente ficticio B',dataset:{saldo:'0'},style:{}}];
 const nav={classList:classes([])},timers=[],notices=[],reads=[],permissions=[];
 const nodes={'page-dashboard':dashboard,'page-cuentacorriente':page,'cc-detail':detail,'cc-buscador':search,'cc-contador':counter,'page-title':title,'kpi-deuda':amount};
 const context={window:{location:{hash:'#/dashboard'},svBloquearSalidaCotizacion:()=>blocked,_ccCuentaKeyActual:'cliente-anterior'},
  document:{getElementById:id=>nodes[id]||null,querySelector:selector=>selector==='.page.active'?[dashboard,page].find(node=>node.classList.contains('active')):selector==='.content'?content:selector.includes('onclick')?nav:null,
   querySelectorAll:selector=>selector==='.page'?[dashboard,page]:selector==='.nav-item'?[nav]:selector==='#cc-tbody .ccrow'?rows:[]},
  isAuthenticated:authenticated,currentRole:'admin',permisoModulo:id=>{permissions.push(id);return allowed;},
  _svNavegandoAtras:false,_svHistorialPaginas:[],_ccFiltroActual:'pendiente',
  _svGuardarHistorialPaginas(){},_svActualizarRuta(){},_svCerrarUITransitoriaAlNavegar(){},_svProgramarDescargaVista(){},
  svActualizarLecturasPorAccion(){},svActualizarMasUsados(){},sidebarDesktopActivo:()=>true,
  titles:{cuentacorriente:'Cuenta corriente'},notify:message=>notices.push(message),setTimeout:callback=>timers.push(callback),
  fbCargarPagos:()=>reads.push('pagos'),renderTablaCuentaCorriente:()=>reads.push('tabla'),
  verCuentaClienteReal:assert.fail,tabVentas:assert.fail,fbSet:assert.fail,fbUpdate:assert.fail,fbRemove:assert.fail};
 load(context,['showPage','svNavegarDirecto','volverListaCuentaCorriente','buscarCC','kpiNavegar']);
 const onclick=index.match(/onclick="(kpiNavegar\('deuda'\))"/)[1];
 return {context,click:()=>vm.runInContext(onclick,context),card,metrics,detail,dashboard,page,search,counter,content,title,amount,rows,nav,timers,notices,reads,permissions};
}

test('Deuda clientes abre Cuenta corriente general desde la tarjeta real y conserva importes, filtros y buscador',()=>{
 const f=fixture();f.click();
 assert.equal(f.page.classList.contains('active'),true);assert.equal(f.dashboard.classList.contains('active'),false);
 assert.deepEqual(f.permissions,['cuentacorriente']);assert.equal(f.title.textContent,'Cuenta corriente');
 assert.equal(f.detail.style.display,'none');assert.equal(f.card.style.display,'');assert.equal(f.metrics.style.display,'');
 assert.equal(f.search.value,'Cliente ficticio A');assert.equal(f.context._ccFiltroActual,'pendiente');
 assert.equal(f.rows[0].style.display,'');assert.equal(f.rows[1].style.display,'none');assert.equal(f.counter.textContent,'1 cliente');
 assert.equal(f.amount.textContent,'$123,45');assert.equal(f.context.window._ccCuentaKeyActual,'cliente-anterior');
 assert.equal(f.content.scrollTop,0);assert.equal(f.context.window._svProximaVistaDirecta,null);
 f.timers.forEach(callback=>callback());assert.deepEqual(f.reads,['pagos','tabla']);
 assert.match(index,/onclick="kpiNavegar\('deuda'\)" title="Ver cuenta corriente"/);
});

test('Deuda clientes respeta permiso del módulo y no abre el listado ni la ficha si está denegado',()=>{
 const f=fixture({allowed:false});f.click();
 assert.deepEqual(f.permissions,['cuentacorriente']);assert.equal(f.dashboard.classList.contains('active'),true);assert.equal(f.page.classList.contains('active'),false);
 assert.equal(f.detail.style.display,'block');assert.equal(f.card.style.display,'none');assert.equal(f.metrics.style.display,'none');
 assert.deepEqual(f.notices,['Acceso restringido para tu rol']);assert.deepEqual(f.reads,[]);assert.equal(f.timers.length,0);
 assert.equal(f.context.window._svProximaVistaDirecta,null);assert.equal(f.amount.textContent,'$123,45');
});

test('Deuda clientes conserva las barreras de sesión y de salida pendiente',()=>{
 for(const options of [{authenticated:false},{blocked:true}]){
  const f=fixture(options);f.click();assert.equal(f.dashboard.classList.contains('active'),true);assert.equal(f.page.classList.contains('active'),false);
  assert.equal(f.detail.style.display,'block');assert.equal(f.card.style.display,'none');assert.deepEqual(f.permissions,[]);assert.deepEqual(f.reads,[]);assert.equal(f.timers.length,0);
 }
});

test('Las demás tarjetas conservan su destino y filtros anteriores',()=>{
 const calls=[],timers=[],context={document:{querySelector:()=>null,getElementById:()=>null},showPage:id=>calls.push(['page',id]),setTimeout:fn=>timers.push(fn),tabVentas:tab=>calls.push(['ventas',tab]),setFiltroCob:filter=>calls.push(['cobros',filter])};
 load(context,['kpiNavegar']);
 for(const type of ['ventasHoy','cobrosHoy','presupuestos','iva'])context.kpiNavegar(type);
 timers.forEach(fn=>fn());assert.deepEqual(calls,[['page','detalle'],['page','cobranzas'],['page','presupuesto'],['page','creditofiscal'],['ventas','hoy'],['cobros','hoy']]);
});
