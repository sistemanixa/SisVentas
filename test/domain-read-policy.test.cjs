'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const policy=require('../js/core/domain-read-policy.js'),source=require('./helpers/active-app').readActiveApp().source;
function defaults(role){return module=>(policy.restrictedDefaults[module]||policy.internalRoles).includes(role);}
test('Los roles conservan dependencias compartidas y no cargan dominios fiscales bloqueados',()=>{
 for(const role of policy.internalRoles){
  const fiscal=['admin','administrativo'].includes(role);
  assert.equal(policy.allows('comprobantesCompra',role,defaults(role)),fiscal);
  assert.equal(policy.allows('comprobantesVenta',role,defaults(role)),fiscal);
  assert.equal(policy.allows('ordenes',role,defaults(role)),fiscal);
  assert.equal(policy.allows('equipos',role,m=>m==='garantias'),true);
 }
});
test('Overrides de módulos y métricas del dashboard habilitan únicamente las dependencias correspondientes',()=>{
 assert.equal(policy.allows('comprobantesVenta','tecnico',()=>false,k=>k==='dashboard.metricasGlobales'),true);
 assert.equal(policy.allows('caja','tecnico',m=>m==='gastos'),true);
 assert.equal(policy.allows('ordenes','tecnico',m=>m==='balancecompra'),true);
 assert.equal(policy.allows('config/tfapp','vendedor',()=>false,()=>true),false);
 assert.equal(policy.allows('equipos','tecnico',()=>false),false);
 for(const role of ['', 'inventado','distribuidora','compras_paraguay'])assert.equal(policy.allows('caja',role,()=>true,()=>true),false);
});
const loaders={cfCargar:'comprobantesCompra',fvCargar:'comprobantesVenta',cargarConfigTFAppProtegida:'config/tfapp',fbCargarCaja:'caja',fbCargarOrdenes:'ordenes',fbCargarInformes:'informes',spCargar:'reclamos',fbCargarTickets:'tickets',fbCargarGarantias:'garantias',fbCargarEquipos:'equipos',fbCargarRemitos:'remitos',fbCargarAgenda:'agenda',dashCargarAgendaInterna:'agenda',fbCargarCategorias:'categorias',fbCargarServicios:'servicios',fbCargarClientes:'clientes',fbCargarProductos:'productos',fbCargarVentas:'ventas',fbCargarPagos:'pagos',fbCargarPresupuestos:'presupuestos',fbCargarOTs:'ordenesTrabajo',cargarCargos:'config/cargos'};
test('Cada cargador bloqueado retorna antes de consultar Firebase, incluso si se invoca directamente',async()=>{
 for(const [name,domain] of Object.entries(loaders)){
  const start=source.indexOf('function '+name+'('),ctx={Promise,svPuedeLeerDominio:d=>{assert.equal(d,domain);return false;}};
  vm.runInNewContext(source.slice(start,source.indexOf('\n}',start)+2),ctx);
  await ctx[name](); // Sin window: acceder a Firebase provocaría una excepción.
 }
});
test('La política compartida se carga antes del cliente y está incluida en el shell offline',()=>{
 const active=require('./helpers/active-app').readActiveApp(),html=active.index,sw=fs.readFileSync('sw.js','utf8');
 assert.ok(html.indexOf('domain-read-policy.js')<html.indexOf(active.filename));
 const policyAsset=html.match(/src="\.\/(js\/core\/domain-read-policy\.js\?v=[^"]+)"/);
 assert.ok(policyAsset,'el índice debe declarar la versión del módulo compartido');
 assert.ok(sw.includes(policyAsset[1]),'el shell offline debe precargar exactamente el módulo que usa el índice');
});
test('La carga de permisos espera Firebase y no aplica resultados de otra sesión',async()=>{
 const start=source.indexOf('function cargarPermisosRoles('),fn=source.slice(start,source.indexOf('\n}',start)+2);
 let resolve,applied=0;const ctx={Promise,currentUserUid:'primera',window:{fbDB:{},fbRef:(_,p)=>p,svRutaPermisos:()=> 'sv_permisos',fbGet:()=>new Promise(r=>resolve=r)},aplicarPermisosRolesGuardados:()=>applied++};
 vm.runInNewContext(fn,ctx);const pending=ctx.cargarPermisosRoles();assert.equal(applied,0);
 ctx.currentUserUid='otra';resolve({val:()=>({})});assert.equal(await pending,false);assert.equal(applied,0);
 const next=ctx.cargarPermisosRoles();resolve({val:()=>null});assert.equal(await next,true);assert.equal(applied,1);
});
test('El arranque abre listeners solamente después de confirmar permisos',()=>{
 const start=source.indexOf('var uidArranque = currentUserUid;'),fragment=source.slice(start,start+510);
 assert.match(fragment,/_svPermisosCargaInicial = cargarPermisosRoles\(\)/);
 assert.match(fragment,/\.then\(function\(listos\)/);
 assert.match(fragment,/listos && uidArranque === currentUserUid\) fbCargarTodo\(\)/);
});
