'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {plan}=require('../cotizador/purchase-preparation-cancel-model');
const clone=value=>structuredClone(value);
function fixture(method='Exterior') {
 const captured={productoKey:'P',cod:'CODE',qty:2,punit:500,sub:1000,iva:210,disc:0,costoUnitarioCompra:12.345678,costoTotalCompra:24.691356,proveedorCompra:'Proveedor capturado',proveedorCompraKey:'V',origenCompra:'Local',monedaCompra:'ARS',precioAcordadoCompra:12.345678,cotizacionCompra:1,unknown:{old:true}};
 const line={...clone(captured),costoUnitarioCompra:20,costoTotalCompra:40,preparacionCompra:{cantidadStock:0,cantidadComprar:2,costoStockUnitario:12.345678,costoCompraUnitario:20},proveedorCompra:'Proveedor aplicado',proveedorCompraKey:'APPLIED',origenCompra:method,costoUnitarioAntesPreparacion:12.345678,compraExteriorAplicada:{cantidad:2},monedaCompra:'USD',precioAcordadoCompra:0.02,cotizacionCompra:1000,unknown:{current:true},punit:550,sub:1100};
 const sale={items:[line],listaMaterialesId:'L',ordenesCompraIds:[],subtotal:1100,total:1331,iva:231,descuento:0,costoTotal:40,margenPct:96,usuario:'Creador',fecha:'2020-01-01',ts:10,pagada:true,pagos:{paid:{importe:1331}},comisiones:{pagada:50},jobs:{ot:'keep'},documents:{doc:1},audit:[{ts:5,accion:'original'}]};
 const material={linea:0,productoKey:'P',codigo:'CODE',cantidadNecesaria:2,costoUnitario:12.345678,proveedor:'Proveedor capturado',proveedorKey:'V',precioPublico:500,referenciaCompra:{amount:12.345678,currency:'ARS',provider:'Proveedor capturado',providerKey:'V'},origenVentaItem:captured};
 return {list:{origen:'venta',ventaFbKey:'S',estado:'preparacion',items:[material],ordenesIds:[],usuario:'Creador lista',fecha:'2020-01-01',simuladorParaguay:{version:6,chosen:'remote',extras:[{key:'extra',qty:1}],rows:[{method:method.toLowerCase()}]},comprobantesCompra:{sha:{doc:'keep'}},documents:{id:'keep'},audit:{old:{keep:true}}},listKey:'L',sourceLists:{},sales:{S:sale},context:{id:'cancel-operation',at:2000,actor:{uid:'u',name:'Operador'}}};
}
function apply(input,out){const records={sisventas:{listas_materiales:{[input.listKey]:clone(input.list),...clone(input.sourceLists)},ventas:clone(input.sales)}};for(const [path,value]of Object.entries(out.patch)){const bits=path.split('/');let node=records;for(const bit of bits.slice(0,-1)){if(node[bit]==null)node[bit]={};node=node[bit];}if(value===null)delete node[bits.at(-1)];else node[bits.at(-1)]=clone(value);}return records.sisventas;}
function review(input,field){const before=clone(input);assert.throws(()=>plan(input),error=>error.code==='SV_PURCHASE_PREPARATION_CANCEL_REVIEW'&&error.statusCode===409&&typeof error.identifier==='string'&&(!field||error.field===field));assert.deepEqual(input,before);}
for(const method of ['Local','Exterior','Stock'])test('restore '+method+' preparation solely from captured local costs',()=>{
 const input=fixture(method),before=clone(input),out=plan(input),next=apply(input,out),sale=next.ventas.S,list=next.listas_materiales.L;
 assert.deepEqual(input,before);assert.equal(sale.items[0].costoTotalCompra,24.691356);assert.equal(sale.items[0].costoUnitarioCompra,12.345678);assert.equal(sale.items[0].proveedorCompra,'Proveedor capturado');assert.equal(sale.items[0].origenCompra,'Local');assert.equal(sale.items[0].monedaCompra,'ARS');assert.equal(Object.hasOwn(sale.items[0],'compraExteriorAplicada'),false);assert.equal(Object.hasOwn(sale.items[0],'preparacionCompra'),false);assert.equal(sale.items[0].costoUnitarioAntesPreparacion,12.345678);
 for(const field of ['punit','sub','qty','iva','disc','unknown'])assert.deepEqual(sale.items[0][field],input.sales.S.items[0][field]);
 for(const field of ['subtotal','total','iva','descuento','usuario','fecha','ts','pagada','pagos','comisiones','jobs','documents'])assert.deepEqual(sale[field],input.sales.S[field]);
 assert.deepEqual(sale.audit[0],input.sales.S.audit[0]);assert.equal(sale.audit.length,2);assert.equal(list.estado,'cancelada');assert.deepEqual(list.items,input.list.items);assert.deepEqual(list.comprobantesCompra,input.list.comprobantesCompra);assert.deepEqual(list.documents,input.list.documents);assert.deepEqual(list.audit.old,input.list.audit.old);assert.deepEqual(list.preparacionExteriorEliminada.simulador,input.list.simuladorParaguay);assert.equal(list.simuladorParaguay,undefined);
 assert.ok(Object.keys(out.patch).every(path=>/^sisventas\/(ventas|listas_materiales)\/[\w-]+\//.test(path)));assert.equal(out.result.inventoryChanged,false);assert.deepEqual(out.readDependencies['sisventas/ventas/S'],input.sales.S);
 assert.equal(Object.keys(out.patch).some(path=>/pagos|comisiones|jobs|documents|comprobantesCompra|inventario|\/items$/.test(path)),false);
});
test('original captured stock source is restored without moving physical stock',()=>{const input=fixture();Object.assign(input.list.items[0].origenVentaItem,{origenCompra:'Stock',proveedorCompra:'Stock disponible',proveedorCompraKey:''});const out=plan(input),next=apply(input,out);assert.equal(next.ventas.S.items[0].origenCompra,'Stock');assert.equal(next.ventas.S.items[0].proveedorCompraKey,'');assert.ok(Object.keys(out.patch).every(path=>!path.includes('inventario')));});
test('a pure stock extras preparation only archives and cancels its own list',()=>{const input=fixture();input.listKey='ST';input.list={origen:'stock_paraguay',estado:'preparacion',ordenesIds:[],items:[],simuladorParaguay:{version:6,extras:[{productKey:'E',qty:1.234567}]},comprobantesCompra:{sha:{keep:true}}};input.sales={};const out=plan(input),next=apply(input,out);assert.ok(Object.keys(out.patch).every(path=>path.startsWith('sisventas/listas_materiales/ST/')));assert.deepEqual(next.listas_materiales.ST.preparacionExteriorEliminada.simulador,input.list.simuladorParaguay);assert.deepEqual(next.listas_materiales.ST.comprobantesCompra,input.list.comprobantesCompra);});
function grouped(){const input=fixture(),child=clone(input.list),other=clone(child);child.compraConjuntaId='J';other.compraConjuntaId='J';other.ventaFbKey='T';input.sourceLists={L:child,M:other};input.sales.T=clone(input.sales.S);input.sales.T.listaMaterialesId='M';input.listKey='J';input.list={origen:'conjunta',estado:'preparacion',ordenesIds:[],sources:[{listId:'L',ventaFbKey:'S'},{listId:'M',ventaFbKey:'T'}],items:[{...clone(child.items[0]),sourceListId:'L',linea:'L:0'},{...clone(other.items[0]),sourceListId:'M',linea:'M:0'}],simuladorParaguay:{version:6,extras:[{qty:2}]},comprobantesCompra:{joint:'keep'},audit:[{old:'keep'}]};return input;}
test('grouped child documents, snapshots, audit and unrelated supplied sources survive',()=>{const input=grouped();input.sourceLists.UNRELATED=clone(input.sourceLists.L);input.sales.UNRELATED=clone(input.sales.S);const out=plan(input),next=apply(input,out);for(const lk of ['L','M']){assert.equal(next.listas_materiales[lk].estado,'cancelada');assert.equal(next.listas_materiales[lk].compraConjuntaId,undefined);assert.deepEqual(next.listas_materiales[lk].items,input.sourceLists[lk].items);assert.deepEqual(next.listas_materiales[lk].comprobantesCompra,input.sourceLists[lk].comprobantesCompra);}assert.deepEqual(next.listas_materiales.J.comprobantesCompra,input.list.comprobantesCompra);assert.deepEqual(next.listas_materiales.UNRELATED,input.sourceLists.UNRELATED);assert.deepEqual(next.ventas.UNRELATED,input.sales.UNRELATED);assert.equal(Object.keys(out.readDependencies).some(path=>path.includes('UNRELATED')),false);assert.equal(next.ventas.S.costoTotal,24.691356);assert.equal(next.ventas.T.costoTotal,24.691356);});
test('missing snapshot provider may use an explicit ARS captured reference, never live catalog',()=>{const input=fixture(),snapshot=input.list.items[0].origenVentaItem;delete snapshot.proveedorCompra;delete snapshot.proveedorCompraKey;delete snapshot.origenCompra;const next=apply(input,plan(input));assert.equal(next.ventas.S.items[0].proveedorCompra,'Proveedor capturado');});
for(const [name,change]of Object.entries({
 missingSnapshot:i=>delete i.list.items[0].origenVentaItem,
 missingSnapshotCost:i=>{delete i.list.items[0].origenVentaItem.costoTotalCompra;delete i.list.items[0].origenVentaItem.costoUnitarioCompra;},
 missingQuantity:i=>delete i.sales.S.items[0].qty,
 zeroQuantity:i=>i.sales.S.items[0].qty=0,
 lineMissing:i=>delete i.list.items[0].linea,
 codeChanged:i=>i.sales.S.items[0].cod='OTHER',
 productChanged:i=>i.list.items[0].origenVentaItem.productoKey='OTHER',
 quantityChanged:i=>i.list.items[0].origenVentaItem.qty=3,
 received:i=>i.sales.S.items[0].cantidadCompraReal=1,
 realCost:i=>i.sales.S.items[0].costoRealCompraAcumulado=1,
 reserved:i=>i.list.reservasInventario={P:{quantity:1}},
 reservedFlag:i=>i.list.stockExistenteReservado=true,
 confirmed:i=>i.list.compraConfirmacion={estado:'completa'},
 existingOrders:i=>i.list.ordenesIds=['O'],
 saleOrders:i=>i.sales.S.ordenesCompraIds=['O'],
 missingOrderReferences:i=>delete i.list.ordenesIds,
 pendingClientSteps:i=>i.list.cancelacionExteriorPendiente={id:i.context.id,steps:[{path:'sisventas',changes:{pagos:null}}]},
 foreignLock:i=>i.list.cancelacionExteriorBloqueo='other',
 applicationPending:i=>i.list.aplicacionExteriorPendiente={id:'other'},
 salePending:i=>i.sales.S.recepcionPendiente={id:'other'},
 wrongBacklink:i=>i.sales.S.listaMaterialesId='M',
 missingSale:i=>delete i.sales.S,
 summary:i=>i.sales.S._svSummary=true,
 originalExteriorWithoutLocalCapture:i=>i.list.items[0].origenVentaItem.origenCompra='Exterior',
 contradictoryCost:i=>i.list.items[0].origenVentaItem.costoTotalCompra=99,
 inconsistentSaleTotal:i=>i.sales.S.costoTotal=0,
 invalidAudit:i=>i.sales.S.audit='unknown',
 alreadyCancelled:i=>i.list.exteriorCanceladoEn=500,
 oldCancellation:i=>i.list.preparacionExteriorEliminada={fecha:500},
 noLocalProviderEvidence:i=>{const s=i.list.items[0].origenVentaItem;delete s.proveedorCompra;delete s.proveedorCompraKey;delete s.origenCompra;i.list.items[0].referenciaCompra.currency='USD';}
}))test('identifiable review '+name+' preserves all sources',()=>{const input=fixture();change(input);review(input);});
for(const [name,change]of Object.entries({missingChild:i=>delete i.sourceLists.M,foreignChild:i=>i.sourceLists.M.compraConjuntaId='OTHER',missingMapping:i=>i.list.items.pop(),orphan:i=>i.list.items.push({...clone(i.list.items[0]),sourceListId:'missing'}),snapshotChanged:i=>i.list.items[0].origenVentaItem.costoTotalCompra=22,duplicateSource:i=>i.list.sources.push(clone(i.list.sources[0])),childPending:i=>i.sourceLists.M.cancelacionExteriorBloqueo='foreign'}))test('group '+name+' fails closed',()=>{const input=grouped();change(input);review(input);});
