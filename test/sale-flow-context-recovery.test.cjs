'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createBackend,apply}=require('./helpers/labor-ui-flow.cjs'),{functionSource}=require('./helpers/app-functions.cjs'),Permission=require('../js/core/permission-index'),Membership=require('../cotizador/payment-membership-index'),Forms=require('../js/core/commercial-form-data.v1'),{digest}=require('../cotizador/labor-guard');
function deferred(){let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};}
function fixture(){
 const sale={id:'FIXTURE',fecha:'2026-11-04',responsableUid:'u',conIva:true,descuentoGeneral:10,items:[{cod:'FIXTURE',desc:'Fixture',qty:2,punit:100,sub:200,costoUnitarioCompra:20,costoVersion:1}],subtotal:180,descuento:20,iva:37.8,total:217.8};
 const backend=createBackend({ventas:{fixture:sale},presupuestos:{},pagos:{}}),page=backend.page(),root=page.context;
 backend.state.sv_permisos=Permission.build({admin:{acciones:{ventas:{moverPresupuesto:true},presupuestos:{crear:true}}}});apply(backend.state,Membership.buildIndex({},{generation:'fixture-context-generation',ready:true}).patch);
 backend.store.query=async(path,field,value)=>Object.fromEntries(Object.entries(backend.get(path)||{}).filter(([,record])=>record?.[field]===value));
 backend.setReturnCapability({ok:true,revision:'fixture-real',saleReturn:require('../cotizador/sale-return-to-budget').capability({enabled:true,coordinated:true,rulesDigest:digest('fixture rules')})});
 vm.runInContext(fs.readFileSync(require.resolve('../js/core/commercial-ownership.js'),'utf8'),root);vm.runInContext(functionSource('_svCargaOperacion_moverVentaAPresupuesto'),root);
 root.ventasList=[{...sale,fbKey:'fixture'}];root.pptoData=[];root._svResolverVentaRegistro=()=>root.ventasList[0];root.svConfirm=async()=>true;root.SisVentasCompras={state:{lists:[]}};let reserved=0;root.reservarSiguientePptoId=async()=>{reserved++;return 'PP-FIXTURE';};root.showPage=()=>{throw Error('fixture render failed after commit');};
 return {backend,page,root,reserved:()=>reserved};
}
test('post-commit render failure recovers receipt through real gateway without a second write',async()=>{
 const f=fixture(),before=f.backend.get('sisventas');
 await assert.rejects(f.root._svCargaOperacion_moverVentaAPresupuesto('FIXTURE'),/render failed/);
 assert.equal(f.backend.commits.length,1);assert.equal(f.backend.commands.length,1);assert.equal(f.backend.get('sisventas/ventas/fixture'),null);
 const budget=f.backend.get('sisventas/presupuestos/desde_venta_fixture');f.root.SVSaleBudgetTransition.validateEconomicTransition(before.ventas.fixture,budget);
 const command=f.backend.commands[0],actor=await f.backend.gateway.authorize({method:'POST',url:'/laboral/operacion',headers:{authorization:'Bearer fixture-token'}});
 assert.deepEqual(await f.backend.gateway.resolve(actor,{id:command.id,digest:digest(command)}),{ok:true,status:'confirmed'});
 assert.equal(f.backend.commits.length,1);assert.equal(f.backend.commands.length,1);assert.deepEqual(f.backend.get('sisventas/pagos'),before.pagos);
});
for(const field of ['uid','auth'])test(field+' change during real ownership reopen rejects stale response',async()=>{
 const f=fixture(),gate=deferred(),originalGet=f.root.fbGet,before=f.backend.get('sisventas');f.root.fbGet=async ref=>{await gate.promise;return originalGet(ref);};
 const pending=f.root.SVCommercialOwnership.prepare('ventas','fixture');if(field==='uid')f.root.currentUserUid='other';else f.root.fbAuth.currentUser={uid:'u'};gate.resolve();await assert.rejects(pending,/sesión cambió/i);assert.deepEqual(f.backend.get('sisventas'),before);assert.equal(f.backend.commands.length,0);
});
test('role changes while capability response is pending prevent reservation and mutation',async()=>{
 const f=fixture(),gate=deferred(),originalFetch=f.root.fetch,before=f.backend.get('sisventas');let entered;const waiting=new Promise(resolve=>{entered=resolve;});f.root.fetch=async(url,options)=>{if(url.endsWith('/capacidades')){entered();await gate.promise;}return originalFetch(url,options);};
 const pending=f.root._svCargaOperacion_moverVentaAPresupuesto('FIXTURE');await waiting;f.root.currentRole='tecnico';gate.resolve();await pending;assert.equal(f.reserved(),0);assert.equal(f.backend.commands.length,0);assert.deepEqual(f.backend.get('sisventas'),before);
});
for(const failing of ['productos','empleados'])test('real form requirement fan-in never reports ready after '+failing+' failure',async()=>{
 const gate=deferred(),entered=[],ready=[];const loaders=Object.fromEntries(Forms.requirements('venta').map(name=>[name,async()=>{entered.push(name);if(name===failing){await gate.promise;throw Error('fixture missing '+name);}}]));
 const pending=Promise.all(Forms.loaders('venta',loaders).map(load=>load())).then(()=>ready.push(true));await Promise.resolve();assert.equal(entered.length,4);assert.equal(ready.length,0);gate.resolve();await assert.rejects(pending,/fixture missing/);assert.equal(ready.length,0);
});
