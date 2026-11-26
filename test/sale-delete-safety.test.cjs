'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const {apply}=require('./helpers/labor-ui-flow.cjs');
const {digest}=require('../cotizador/labor-guard');
const Financial=require('../cotizador/sale-financial-dependencies-model');
const Provider=require('../cotizador/sale-financial-dependencies-provider');
const {createSaleDeleteHttpAdapter,PATH}=require('../cotizador/sale-delete-http-adapter');
async function fixture({audit,ot={id:'OT-FICTICIA',ventaFbKey:'s'}}={}){
 const budget={id:'P-FICTICIO',ventaGeneradaFbKey:'s',responsableUid:'u',clienteFbKey:'c',items:[{costo:17,precio:29}],...(audit===undefined?{}:{audit})};
 const backend=await createCoordinatedBackend({ventas:{s:{id:'V-FICTICIA',clienteFbKey:'c',responsableUid:'u',total:100,fecha:'2026-11-01'}},pagos:{p:{ventaFbKey:'s',monto:20,fecha:'2026-11-01'}},presupuestos:{b:budget},ordenes_trabajo:{ot},stock:{p:{general:8,reservado:2,consumido:3}},inventario:{p:{general:8}},comisiones:{historic:{monto:7}},comprobantesVenta:{fiscal:{cae:'FICTICIO'}}});
 apply(backend.state,{'sv_permisos/admin':{indiceVersion:2,indiceModulos:{venta:true,ordentrabajo:true},acciones:{ventas:{eliminar:true},ot:{eliminar:true}}}});
 const prepared=await Financial.prepare({ventas:backend.get('sisventas/ventas'),gastos:{},ctaemp:{},comisiones_generacion:{},sv_commission_generation:{}},{generation:'sale-safety-real-provider'});apply(backend.state,prepared.patch);
 backend.store.saleDeleteFinancialEvidence=Provider.create();backend.store.saleDeleteFenceReady=true;backend.store.saleDeleteActivityFenceReady=true;
 const adapter=createSaleDeleteHttpAdapter({authorize:backend.gateway.authorize,guard:backend.guard,store:backend.store,enabled:true,now:()=>Date.parse('2026-11-26T12:00:00Z')});
 const body={id:'sale-delete-safety-operation',ventaKey:'s',expectedHash:digest(backend.get('sisventas/ventas/s'))};
 return {...backend,body,run:()=>adapter.handle({method:'POST',url:PATH,headers:{authorization:'Bearer fixture-token'}},body)};
}
for(const [name,audit]of [['array',[{accion:'original',fecha:'2020',custom:{value:3}}]],['map',{'0':{accion:'primero'},'2':{accion:'segundo'},push_old:{accion:'tercero',custom:[7]}}]])test('genuine Guard/provider preserves every RAW budget audit entry in '+name,async()=>{
 const f=await fixture({audit}),original=f.get('sisventas/presupuestos/b'),before=structuredClone(f.state.sisventas),r=await f.run();a.equal(r.statusCode,200);a.equal(f.commits.length,1);
 const next=f.get('sisventas/presupuestos/b');a.equal(next.estado,'anulado');a.deepEqual(next.items,original.items);a.equal(Array.isArray(next.audit),Array.isArray(audit));
 for(const [key,value]of Object.entries(audit))a.deepEqual(next.audit[key],value);a.equal(Object.keys(next.audit).length,Object.keys(audit).length+1);
 const added=Object.keys(next.audit).find(k=>!Object.hasOwn(audit,k));a.equal(next.audit[added].accion,'Presupuesto anulado porque la venta generada fue eliminada');
 for(const domain of ['stock','inventario','comisiones','comprobantesVenta'])a.deepEqual(f.get('sisventas/'+domain),before[domain]);
 a.equal(f.get('sisventas/pagos/p'),null);a.equal(f.get('sisventas/ordenes_trabajo/ot'),null);
 a.equal((await f.run()).body.committed,true);a.equal(f.commits.length,1);a.deepEqual(f.get('sisventas/presupuestos/b/audit'),next.audit);
});
for(const [field,value]of [
 ['materiales',[{descripcion:'Producto sin clasificación física',cantidad:1}]],['items',[{descripcion:'Legacy'}]],['materiales',{}],['materiales',null],['materiales','unknown'],
 ['custodiaIniciada',true],['custodiaRendida',false],['stockRegistro','R-FICTICIO'],['stockRegistro',''],['rendicionesOT',{r:{instalada:1}}],['remitosEntrega',{r:{cantidad:1}}],['movimientosStock',[]],['inventarioCompra',{}],['stockDesconocido',0],['physicalUnknown',false],['deliveryLedger',{}],['instalada',0],['devuelta',2],['datos',{inventarioOculto:{unknown:true}}]
])test('physical or unknown OT marker '+field+' '+JSON.stringify(value)+' blocks all writes',async()=>{
 const f=await fixture({ot:{id:'OT-FICTICIA',ventaFbKey:'s',[field]:value}}),before=structuredClone(f.state.sisventas);
 await a.rejects(f.run(),{code:'SV_SALE_DELETE_OT_PHYSICAL',statusCode:409});a.equal(f.commits.length,0);a.deepEqual(f.state.sisventas,before);
});
test('empty explicit materials and items arrays retire only documentary OT with no inventory mutation',async()=>{const f=await fixture({ot:{id:'OT-FICTICIA',ventaFbKey:'s',materiales:[],items:[]}});await f.run();a.equal(f.commits.length,1);a.equal(f.get('sisventas/stock/p/general'),8);});
test('shared OT policy still vetoes recorded work independently of physical marker spelling',async()=>{const f=await fixture({ot:{id:'OT-FICTICIA',ventaFbKey:'s',notasTecnico:{n:{texto:'Trabajo registrado'}}}});await a.rejects(f.run(),{code:'SV_OT_DELETE_ACTIVITY',statusCode:409});a.equal(f.commits.length,0);});
test('unknown budget audit shape is reviewed without discarding it',async()=>{const f=await fixture({audit:'legacy unknown'}),before=structuredClone(f.state.sisventas);await a.rejects(f.run(),{code:'SV_SALE_DELETE_BLOCKED',message:'La auditoría del presupuesto requiere revisión.'});a.equal(f.commits.length,0);a.deepEqual(f.state.sisventas,before);});
test('late physical OT trace invalidates the fresh plan and leaves sale/payment/OT intact',async()=>{const f=await fixture(),read=f.store.read;let visits=0;f.store.read=async path=>{if(path==='sisventas/ordenes_trabajo'&&++visits===2)apply(f.state,{'sisventas/ordenes_trabajo/ot/stockRegistro':'late'});return read(path);};await a.rejects(f.run(),{code:'SV_SALE_DELETE_OT_PHYSICAL'});a.equal(f.commits.length,0);a(f.get('sisventas/ventas/s'));a(f.get('sisventas/pagos/p'));a.equal(visits,2);});

test('deterministic append key never overwrites a preexisting audit map entry',async()=>{
 const key='sale-delete-'+digest({operationId:'sale-delete-safety-operation',saleKey:'s',budgetKey:'b'}).slice(0,32),f=await fixture({audit:{[key]:{accion:'Conservar'}}}),before=f.get('sisventas/presupuestos/b');
 await a.rejects(f.run(),{code:'SV_SALE_DELETE_BLOCKED',message:'La auditoría del presupuesto cambió.'});a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas/presupuestos/b'),before);
});
test('array audit retains null slots and nested historical properties',async()=>{
 const audit=[{accion:'Primero',raw:{x:1}},null,{accion:'Tercero',autor:'Original'}],f=await fixture({audit});await f.run();const after=f.get('sisventas/presupuestos/b/audit');a.deepEqual(after.slice(0,3),audit);a.equal(after.length,4);
});

function plannedMaterial(){return {productoKey:'P_FICTICIO',cod:'P-FICTICIO',desc:'Planificado',vendida:2,unidad:'un',entregada:0,instalada:0,devueltaPendiente:0,devuelta:0,enTecnico:0,danada:0,faltante:0,custodiaActiva:false,custodiaClasificada:false,adicionalOT:false,destinoVenta:'original'};}
test('explicit canonical zero-motion planned material is eligible without touching any inventory',async()=>{
 const row=plannedMaterial(),f=await fixture({ot:{id:'OT-FICTICIA',ventaFbKey:'s',estado:'pendiente',materiales:[row],items:[structuredClone(row)],custodiaIniciada:false,custodiaRendida:false}}),inventory={stock:f.get('sisventas/stock'),inventario:f.get('sisventas/inventario')};
 await f.run();a.equal(f.commits.length,1);a.equal(f.get('sisventas/ordenes_trabajo/ot'),null);a.deepEqual({stock:f.get('sisventas/stock'),inventario:f.get('sisventas/inventario')},inventory);
});
for(const change of ['missing','numericString','positive','trueCustody','unknownPhysical','unknownField','stockRegistro','stockRevision','historicalItems'])test('planned row rejects '+change+' rather than normalizing a zero',async()=>{
 const row=plannedMaterial(),ot={id:'OT-FICTICIA',ventaFbKey:'s',materiales:[row]};
 if(change==='missing')delete row.devuelta;if(change==='numericString')row.entregada='0';if(change==='positive')row.instalada=1;if(change==='trueCustody')row.custodiaActiva=true;if(change==='unknownPhysical')row.stockUnknown=0;if(change==='unknownField')row.legacyUnknown='';if(change==='stockRegistro')row.stockRegistro='';if(change==='stockRevision')row.stockRevision=0;if(change==='historicalItems')ot.items=[{...plannedMaterial(),devuelta:'0'}];
 const f=await fixture({ot}),before=structuredClone(f.state.sisventas);await a.rejects(f.run(),{code:'SV_SALE_DELETE_OT_PHYSICAL'});a.equal(f.commits.length,0);a.deepEqual(f.state.sisventas,before);
});
