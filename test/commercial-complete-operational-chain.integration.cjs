'use strict';
// Explicit acceptance probe, not the general gate: a missing partial-delivery
// action must remain a visible failing contract, never a simulated green chain.
// Run: node --test test/commercial-complete-operational-chain.integration.cjs
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs');
const {apply}=require('./helpers/labor-ui-flow.cjs');
const {digest}=require('../cotizador/labor-guard');
const Labor=require('../js/core/labor-writes.js'),Operational=require('../js/core/operational-writes.js'),OpModel=require('../js/core/operational-read-model.js');
const Costs=require('../js/core/purchase-receipt-costs.v1.js');
const H=require('../cotizador/client-history-model'),A=require('../cotizador/client-account-projection'),Pages=require('../cotizador/commercial-pages-model');
const purchase=fs.readFileSync(require.resolve('../js/modules/purchase-orders.js'),'utf8');
function extract(name){const start=purchase.search(new RegExp('  (?:async )?function '+name+'\\('));assert(start>=0,name);const next=purchase.slice(start+3).search(/\n  (?:async )?function /);return purchase.slice(start,next<0?undefined:start+3+next);}
async function fixture({loseInventoryAck=false,otherReserved=0}={}){
 const sale={id:'V-CHAIN-FICTICIA',fecha:'2026-10-20',clienteFbKey:'c',cliente:'Persona ficticia',responsableUid:'u',otId:'ot',estadoInst:'en_instalacion',total:300,subtotal:300,iva:0,conIva:false,descuento:0,items:[{cod:'P-FICTICIO',codigo:'P-FICTICIO',productoKey:'p',productoFbKey:'p',qty:3,punit:100,sub:300,costoUnitarioCompra:10,costoTotalCompra:30,costoUnitarioPresupuestado:10,costoTotalPresupuestado:30,costoVersion:1}]};
 const item={codigo:'P-FICTICIO',productoKey:'p',descripcion:'Producto ficticio',cantidadOrdenada:3,cantidadRecibida:0,costoUnitario:10};
 const order={numero:'OC-CHAIN',ventaFbKey:'s',ventaId:sale.id,estado:'ordenada',items:[item],recepciones:[]};
 const ot={id:'OT-CHAIN',ventaFbKey:'s',ventaId:sale.id,clienteFbKey:'c',cliente:sale.cliente,tecnico:'Técnico ficticio',estado:'en_curso',materiales:[{cod:'P-FICTICIO',desc:'Producto ficticio',productoKey:'p',vendida:3,entregada:0,instalada:0,custodiaActiva:false}],audit:[]};
 const f=await createCoordinatedBackend({ventas:{s:sale},pagos:{old:{ventaFbKey:'s',monto:40,fecha:'2026-10-20'}},ordenes:{o:order},ordenes_trabajo:{ot},productos:{p:{codigo:'P-FICTICIO',nombre:'Producto ficticio'}},inventario_operativo:{p:{general:0,reservado:otherReserved,enCompra:3,consumido:0,asignaciones:otherReserved?{other:{reservado:otherReserved,consumido:0,liberado:0}}:{}}},comisiones:{preserved:{monto:7}},gastos:{preserved:{tipo:'Comisión',monto:7,estado:'pendiente_aprobacion'}}});
 const initial=structuredClone(f.state.sisventas),sdkPatches=[],commands=[],notes=[];let seq=0,ackLost=false;
 const ref=(_,path='')=>({path,key:path.split('/').at(-1)||null,toString:()=> 'https://fixture.invalid/'+path});
 const sdk={ref,get:async r=>({val:()=>f.get(r.path)}),update:async(r,patch)=>{assert.equal(r.path,'');assert(!Object.keys(patch).some(p=>p.startsWith('sv_')),'No financial/H7 derived states may be injected by SDK transport');sdkPatches.push(structuredClone(patch));apply(f.state,patch);if(loseInventoryAck&&!ackLost&&Object.hasOwn(patch,'sisventas/inventario_operativo/p')){ackLost=true;throw Error('FICTITIOUS_INVENTORY_ACK_LOST');}},set(){assert.fail('Unexpected raw SDK set');},remove(){assert.fail('Unexpected raw SDK remove');},runTransaction(){assert.fail('Operational writes must use their real adapter');},push(){assert.fail('Unexpected push');}};
 const root={fbDB:{},fbAuth:{currentUser:{uid:'u'}},currentUserUid:'u',currentRole:'admin',currentUser:'Administración ficticia',crypto:{subtle:webcrypto.subtle,randomUUID:()=> 'operational-chain-'+(++seq)},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVServiceAuth:{headers:async()=>({Authorization:'Bearer fixture-token'})},notify:m=>notes.push(m),tienePermiso:()=>true,permisoModulo:()=>true,svConfirm:async()=>true,document:{getElementById:()=>null,addEventListener(){},documentElement:{},body:{}},
  fetch:async(url,options)=>{assert.equal(url,'https://fixture.invalid/laboral/escritura');const body=JSON.parse(options.body);commands.push(body);const actor=await f.gateway.authorize({method:'POST',url:'/laboral/escritura',headers:{authorization:'Bearer fixture-token'}});try{const data=await f.gateway.write(actor,body);return{ok:true,status:200,json:async()=>data};}catch(error){return{ok:false,status:error.statusCode||503,json:async()=>({code:error.code,mensaje:error.message})};}}};
 Object.assign(root,{fbRef:ref,fbGet:sdk.get});root.SVOperationalWrites=Operational.create(root,OpModel);root.SVOperationalWrites.install({sdk});
 root.SVLaborWrites=Labor.create(root);root.SVLaborWrites.install({sdk:{...sdk,runTransaction:root.fbRunTransaction,update:root.fbUpdate}});
 root.SVPurchaseReceiptCosts=Costs;root.obtenerCostoItemVenta=line=>line.costoUnitarioCompra;
 const context={window:root,state:{orders:[{...order,fbKey:'o'}]},PATH_ORDERS:'sisventas/ordenes',PATH_LISTS:'sisventas/listas_materiales',PATH_INVENTORY:'sisventas/inventario_operativo',safeKey:v=>v,today:()=> '2026-10-20',orderProviderSummary:()=> 'Proveedor ficticio',document:{getElementById:()=>({style:{}})}};
 vm.createContext(context);vm.runInContext(['transactionInventory','syncSalePurchaseCosts','finishReceipt'].map(extract).join('\n'),context);
 function unchangedFinance(){assert.deepEqual(f.get('sisventas/pagos'),initial.pagos);assert.deepEqual(f.get('sisventas/comisiones'),initial.comisiones);assert.deepEqual(f.get('sisventas/gastos'),initial.gastos);assert.deepEqual(f.get('sisventas/ctaemp'),initial.ctaemp);assert.deepEqual(f.get('sisventas/productos'),initial.productos);assert.equal(f.get('sisventas/ventas/s/total'),300);assert.equal(f.get(Pages.ROOT+'/totals/all/debtCents'),26000);assert.equal(f.get(A.ROOT+'/totals/all/balanceCents'),26000);assert.equal(f.get(H.ROOT+'/sources/ventas/s/row/balanceCents'),26000);}
 return{f,root,context,initial,notes,commands,sdkPatches,unchangedFinance,order,item,ackLost:()=>ackLost};
}
for(const loseInventoryAck of [false,true])test('single-base operational chain: real receipt2/3 and replay preserve stock, costs and financial/H7 projections; lostACK='+loseInventoryAck,async()=>{
 const x=await fixture({loseInventoryAck});await x.context.finishReceipt({...x.order,fbKey:'o'},[{index:0,item:x.item,qty:2,costoUnitarioReal:12,proveedor:'Proveedor ficticio',proveedorKey:'supplier'}]);
 const order=x.f.get('sisventas/ordenes/o'),inv=x.f.get('sisventas/inventario_operativo/p');assert.equal(order.estado,'recepcion_parcial');assert.equal(order.items[0].cantidadRecibida,2);assert.equal(order.recepciones.length,1);assert.equal(inv.enCompra,1);assert.equal(inv.reservado,2);assert.equal(inv.asignaciones.s.reservado,2);assert.equal(inv.consumido,0);assert.equal(x.f.get('sisventas/ventas/s/items/0/cantidadCompraReal'),2);assert.equal(x.f.get('sisventas/ventas/s/items/0/costoTotalCompra'),34);assert.equal(x.f.get('sisventas/ventas/s/items/0/costoTotalPresupuestado'),30);assert.equal(x.f.get('sisventas/ventas/s/items/0/costoUnitarioPresupuestado'),10);assert.equal(x.ackLost(),loseInventoryAck);x.unchangedFinance();
 const before=structuredClone(x.f.state.sisventas);await assert.rejects(x.context.finishReceipt({...x.order,fbKey:'o'},[{index:0,item:x.item,qty:2,costoUnitarioReal:12,proveedor:'Proveedor ficticio',proveedorKey:'supplier'}]),/orden cambió|confirmación está pendiente/);assert.deepEqual(x.f.state.sisventas,before);
 console.log(JSON.stringify({stage:'receipt2of3',lostAckRecovered:x.ackLost(),sdkPatches:x.sdkPatches.length,guardedCommands:x.commands.length,receipts:order.recepciones.length,reserved:2,inPurchase:1,actualCost:34,budgetCost:30,financialDebtCents:26000}));
});
test('receipt2/3 with lost ACK preserves another allocation and never consumes warehouse stock',async()=>{
 const x=await fixture({otherReserved:5,loseInventoryAck:true});const other=structuredClone(x.f.get('sisventas/inventario_operativo/p/asignaciones/other'));
 await x.context.finishReceipt({...x.order,fbKey:'o'},[{index:0,item:x.item,qty:2,costoUnitarioReal:12,proveedor:'Proveedor ficticio',proveedorKey:'supplier'}]);
 const inv=x.f.get('sisventas/inventario_operativo/p');assert.deepEqual(inv.asignaciones.other,other);assert.equal(inv.reservado,7);assert.equal(inv.asignaciones.s.reservado,2);assert.equal(inv.general,0);assert.equal(inv.consumido,0);assert.equal(inv.enCompra,1);assert.equal(x.f.get('sisventas/ordenes/o/recepciones').length,1);x.unchangedFinance();
});
test('BLOCKED acceptance: receipt2/3 must allow delivery2/3 before installation and return, without inventing a partial-delivery adapter',async()=>{
 const x=await fixture();await x.context.finishReceipt({...x.order,fbKey:'o'},[{index:0,item:x.item,qty:2,costoUnitarioReal:12,proveedor:'Proveedor ficticio',proveedorKey:'supplier'}]);
 const root=x.root;root.otData=[{...x.f.get('sisventas/ordenes_trabajo/ot'),fbKey:'ot'}];root.otActualId='ot';root.prodData={p:{fbKey:'p',codigo:'P-FICTICIO',nombre:'Producto ficticio'}};root.svPrompt=async()=> '2';
 // Memory HTTP transport to the real supported compare gateway; no projection
 // rebuilding or invented stock/delivery business logic in this transport.
 root.SVGuardedWrites={restTransaction:async(r,transform)=>{const before=x.f.get(r.path),next=transform(structuredClone(before));const body=JSON.parse(JSON.stringify({id:'delivery-chain-fictitious',kind:'compare',path:r.path,value:next,expectedHash:digest(before)}));await x.f.gateway.write({uid:'u',claims:{uid:'u'}},body);return{committed:true,value:x.f.get(r.path)};}};
 const context={window:root,document:root.document,requestAnimationFrame(){}};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../js/modules/ot-material-custody.js'),'utf8'),context);
 const inventoryBefore=x.f.get('sisventas/inventario_operativo');await root.otCustodiaEntregar();const current=x.f.get('sisventas/ordenes_trabajo/ot'),documents=Object.values(current.remitosEntrega||{});
 console.log(JSON.stringify({stage:'delivery-gap',received:2,ordered:3,delivered:current.materiales[0].entregada,documentQuantity:documents[0]?.items[0]?.cantidad,notes:x.notes,unexecuted:['installation','return/correction','end-to-end H7 after those stages']}));
 x.unchangedFinance();assert.deepEqual(x.f.get('sisventas/inventario_operativo'),inventoryBefore);assert.equal(documents.length,1);assert.equal(documents[0].items[0].cantidad,current.materiales[0].entregada);
 assert.equal(current.materiales[0].entregada,2,'Missing real partial-delivery action: public action delivers all3; do not rewrite vendida or seed a partial delivery in the fixture');
});
