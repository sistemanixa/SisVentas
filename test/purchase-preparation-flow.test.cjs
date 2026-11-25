'use strict';
// Actual pure models composed over explicit fictitious originals; no mocked
// model outputs, no guard relaxation, IO, SDK or implicit snapshot repair.
const {test}=require('node:test'),a=require('node:assert/strict');
const Prepare=require('../cotizador/purchase-preparation-model'),Generation=require('../cotizador/purchase-list-generation-model'),Linked=require('../cotizador/purchase-inventory-linked-plan'),Reconcile=require('../cotizador/purchase-receipt-reconcile-model'),Costs=require('../cotizador/commercial-models/purchase-receipt-costs.v1'),Canon=require('../cotizador/commercial-models/exterior-preparation.v6'),{digest}=require('../cotizador/labor-guard');
const Money=require('../cotizador/commercial-models/commercial-money');
const clone=x=>structuredClone(x);
function fixture({stale=false}={}){
 const list={origen:'venta',ventaFbKey:'s',ventaId:'V-FICTICIA',estado:'preparacion',ordenesIds:[],items:[],comprobantesCompra:{original:{name:'server-original'}}};
 const sale={id:'V-FICTICIA',listaMaterialesId:'l',ordenesCompraIds:[],items:[],subtotal:1000,total:1210,iva:210,conIva:true,descuento:13.5,totalPagado:1210,estadoPago:'pagada',pagos:{original:{monto:1210,ts:1}},comisionGenerada:true,comisiones:{original:{pagada:true,importe:50,costoOriginal:77}},jobs:{original:{estado:'vigente'}},usuario:'Autor original',usuarioUid:'original',fecha:'2025-01-01',ts:1};
 const products={},providers={},inventories={},references={},rows=[];
 for(const [index,p]of ['p','q'].entries()){
  const providerKey=index?'second':'first',agreed=index?12.345678:10.123456,original=index?7.231234:5.121234;
  // A previously prepared, unreceived line with coherent budget snapshots.
  // stale=true represents exactly the earlier/different preparation risk.
  const planned=Money.quantitySum([original,agreed]);
  const line={productoKey:p,codigo:'OLD-'+p,qty:2,punit:199.876543,sub:399.753086,costoUnitarioAntesPreparacion:original,costoUnitarioPresupuestado:stale?original:planned/2,costoTotalPresupuestado:stale?original*2:planned,costoTotalCompra:Math.round(planned*100)/100,costoUnitarioCompra:Math.round(planned*100)/100/2,preparacionCompra:{cantidadStock:1,cantidadComprar:1,costoStockUnitario:original,costoCompraUnitario:agreed},precioPublico:199.876543,esManoDeObra:false};
  sale.items.push(line);list.items.push({productoKey:p,codigo:line.codigo,descripcion:'Captura '+p,unidad:'Metro',linea:index,incluir:true,esManoDeObra:false,cantidadNecesaria:2,usarExistente:1,cantidadComprar:1,proveedorKey:providerKey,proveedor:'Proveedor '+providerKey,costoUnitario:agreed,precioPublico:199.876543,referenciaCompra:{amount:agreed,currency:'ARS',providerKey},origenVentaItem:clone(line)});
  products[p]={fbKey:p,codigo:'NEW-'+p,nombre:'Catálogo renombrado '+p,unidad:'Metro',activo:true,precioGremio:999999};providers[providerKey]={fbKey:providerKey,nombre:'Proveedor '+providerKey,activo:true};references[p]={productKey:p,inventoryKey:'physical_'+p,receiptIdentityKey:'receipt_'+p};inventories['physical_'+p]={general:10,enCompra:3,reservado:2,operaciones:{prior:1},asignaciones:{otherSale:{reservado:2}},unknown:{keep:true},costoReferenciaStock:{unit:1.23456789}};
  rows.push({key:[p,index,providerKey].join('|'),method:'local',providerKey,agreed,requestedQty:1,existing:1});
 }
 sale.costoTotal=sale.items.reduce((s,i)=>s+i.costoTotalCompra,0);
 return {list,listKey:'l',sales:{s:sale},sourceLists:{},products,providers,inventories,references,decisions:{parameters:{payment:'USD',usd:1000.123456,usdt:1001.234567,shippingInsuredUSD:0,allocation:'value'},rows,extras:[],chosen:'remote'},applyCosts:true,context:{id:'prepare-flow',at:1000,actor:{uid:'operator',name:'Operador ficticio'}}};
}
function stateOf(f){const state={};for(const [k,v]of Object.entries(f.providers))state['sisventas/proveedores/'+k]=clone(v);for(const [k,v]of Object.entries(f.products))state['sisventas/productos/'+k]=clone(v);state['sisventas/listas_materiales/l']=clone(f.list);state['sisventas/ventas/s']=clone(f.sales.s);for(const [k,v]of Object.entries(f.inventories))state['sisventas/inventario_operativo/'+k]=clone(v);return state;}
function apply(state,out){for(const [path,value]of Object.entries(out.preconditions||{}))a.deepEqual(state[path]??null,value,'original CAS '+path);for(const [path,value]of Object.entries(out.readDependencies||{}))if(Object.hasOwn(state,path))a.deepEqual(state[path],value,'read dependency '+path);for(const [path,value]of Object.entries(out.patch))state[path]=clone(value);}
function inventory(state){return Object.fromEntries(Object.entries(state).filter(([p])=>p.startsWith('sisventas/inventario_operativo/')).map(([p,v])=>[p.split('/')[2],clone(v)]));}
// Only NEW receipts credit general; prior physical reservations/receipt snapshots
// are retained exactly and are never converted to descriptive v2 retroactively.
// costoReferenciaStock is the CURRENT arrival projection; the immutable legacy
// cost capture below remains byte-equal even when this current reference advances.
function seedLegacy(state){for(const p of ['p','q']){const inv=state['sisventas/inventario_operativo/physical_'+p];inv.reservado+=2;inv.consumido=1;inv.asignaciones.s={...inv.asignaciones.s,reservado:2,consumido:1,legacyCapture:{unit:8.123456},recepcionesCompra:{'legacy-receipt':{schema:1,orderKey:'legacy-'+p,cantidad:2,ts:10}}};inv.operaciones['legacy-receipt']={ts:10,raw:'keep'};inv.legacyCostCapture=clone(inv.costoReferenciaStock);}}
function legacyBytes(inv){const a=inv.asignaciones.s;return JSON.stringify({reservado:inv.reservado,consumido:inv.consumido,ownedReserved:a.reservado,ownedConsumed:a.consumido,capture:a.legacyCapture,receipt:a.recepcionesCompra['legacy-receipt'],operation:inv.operaciones['legacy-receipt'],cost:inv.legacyCostCapture});}
function assertLegacy(state,baseline){for(const p of ['p','q'])a.equal(legacyBytes(state['sisventas/inventario_operativo/physical_'+p]),legacyBytes(baseline['physical_'+p]));}
function prepareAndGenerate(f){const state=stateOf(f),prepared=Prepare.plan(f);apply(state,prepared);const list=state['sisventas/listas_materiales/l'],sale=state['sisventas/ventas/s'],id='generation-flow',groups=['first','second'].map(p=>Generation.groupKey(p)),originalOrders=Object.fromEntries(groups.map(g=>[Generation.orderKey('l',id,g),null]));const input={sourceList:list,sale,listKey:'l',body:{id,expectedHash:digest(list)},context:{at:2000,date:'2026-11-22',actor:f.context.actor,orderNumbers:Object.fromEntries(groups.map((g,i)=>[g,'OC-FICTICIA-'+i]))},products:f.products,providers:f.providers,references:f.references,inventories:inventory(state),originalOrders,operationReceipt:null,otherOrders:{}};const generated=Generation.plan(input);apply(state,generated);seedLegacy(state);return {state,prepared,generated,baselineInventory:inventory(state)};}
function receiveInput(f,state,orderKey,index,quantity=1){const orders=Object.fromEntries(state['sisventas/ventas/s'].ordenesCompraIds.map(k=>[k,state['sisventas/ordenes/'+k]]));return {sourceOrder:orders[orderKey],sale:state['sisventas/ventas/s'],list:state['sisventas/listas_materiales/l'],body:{kind:'receive',id:'receipt-flow-'+index,orderKey,movements:[{index:0,quantity,realUnitCost:index?13.456789:11.234567}]},inventories:inventory(state),references:f.references,at:3000+index,actorName:'Receptor ficticio',otherOrders:orders};}
const paidFields=['total','subtotal','iva','conIva','descuento','totalPagado','estadoPago','pagos','comisionGenerada','comisiones','jobs','usuario','usuarioUid','fecha','ts'];
function assertProtected(state,original){const sale=state['sisventas/ventas/s'];for(const field of paidFields)a.deepEqual(sale[field],original[field],field);for(const [i,row]of sale.items.entries())for(const field of ['codigo','productoKey','qty','punit','sub','precioPublico','costoUnitarioAntesPreparacion'])a.deepEqual(row[field],original.items[i][field],field);}
test('real pure prepare → multiple provider Orders → linked receipts → reconciliation, renamed SKU and paid originals intact',()=>{
 const f=fixture(),original=clone(f),{state,generated,baselineInventory}=prepareAndGenerate(f);a.deepEqual(f,original);a.equal(generated.result.orderKeys.length,2);
 for(const [index,key]of generated.result.orderKeys.entries()){
  const order=state['sisventas/ordenes/'+key],row=order.items[0],sale=state['sisventas/ventas/s'],saleIndex=Costs.resolve(sale.items,row);
  a.equal(row.codigo,'OLD-'+row.productoKey);a.notEqual(row.codigo,f.products[row.productoKey].codigo);a.equal(row.sourceLine,'sale:s:'+saleIndex);a.equal(row.costoUnitarioPresupuestado,f.decisions.rows[saleIndex].agreed);a.equal(order.proveedor,f.providers[row.productoKey==='p'?'first':'second'].nombre);
  const input=receiveInput(f,state,key,index),before=clone(input),received=Linked.build(input);a.deepEqual(input,before);apply(state,received);assertProtected(state,original.sales.s);
 }
 for(const [index,key]of generated.result.orderKeys.entries()){
  const all=Object.fromEntries(generated.result.orderKeys.map(k=>[k,state['sisventas/ordenes/'+k]])),input={order:all[key],orderKey:key,sale:state['sisventas/ventas/s'],list:state['sisventas/listas_materiales/l'],otherOrders:all,providers:f.providers,body:{movements:[{index:0,realUnitCost:index?14.567891:12.345678,providerKey:index?'second':'first'}]},context:{id:'reconcile-flow-'+index,at:4000+index,actor:'Conciliador ficticio'}};
  const before=clone(input),out=Reconcile.plan(input);a.deepEqual(input,before);a.equal(out.result.inventoryChanged,false);apply(state,out);assertProtected(state,original.sales.s);
 }
 for(const p of ['p','q']){const inv=state['sisventas/inventario_operativo/physical_'+p];a.equal(inv.general,11);a.equal(inv.enCompra,3);a.equal(inv.reservado,baselineInventory['physical_'+p].reservado);a.equal(inv.asignaciones.s.reservado,baselineInventory['physical_'+p].asignaciones.s.reservado);const orderIndex=generated.result.orderKeys.findIndex(key=>state['sisventas/ordenes/'+key].items[0].productoKey===p),key=generated.result.orderKeys[orderIndex];a.deepEqual(inv.asignaciones.s.recepcionesCompra['receipt-flow-'+orderIndex],{schema:2,orderKey:key,cantidad:1,ts:3000+orderIndex});a.deepEqual(inv.asignaciones.otherSale,{reservado:2});a.deepEqual(inv.costoReferenciaStock,{unit:orderIndex?13.456789:11.234567,order:key,number:state['sisventas/ordenes/'+key].numero,stamp:3000+orderIndex,receipt:'receipt-flow-'+orderIndex,basis:'costo_final_con_gastos'});a.equal(legacyBytes(inv),legacyBytes(baselineInventory['physical_'+p]));}
 a.equal(state['sisventas/ventas/s'].items.every(i=>i.cantidadCompraReal===1),true);a.deepEqual(state['sisventas/listas_materiales/l'].comprobantesCompra,f.list.comprobantesCompra);
});
function finishFlow(f,state,generated){const baselineInventory=inventory(state);
 for(const [index,key]of generated.result.orderKeys.entries())apply(state,Linked.build(receiveInput(f,state,key,index)));
 for(const [index,key]of generated.result.orderKeys.entries()){
  const all=Object.fromEntries(generated.result.orderKeys.map(k=>[k,state['sisventas/ordenes/'+k]]));
  const input={order:all[key],orderKey:key,sale:state['sisventas/ventas/s'],list:state['sisventas/listas_materiales/l'],otherOrders:all,providers:f.providers,body:{movements:[{index:0,realUnitCost:index?14.567891:12.345678,providerKey:index?'second':'first'}]},context:{id:'reconcile-completed-'+index,at:5000+index,actor:'Conciliador ficticio'}};
  const before=clone(input);apply(state,Reconcile.plan(input));a.deepEqual(input,before);
 }
 assertProtected(state,f.sales.s);assertLegacy(state,baselineInventory);
}
function assertBudget(line){const p=line.preparacionCompra,raw=Money.quantitySum([Money.rawProduct(p.cantidadStock,p.costoStockUnitario),Money.rawProduct(p.cantidadComprar,p.costoCompraUnitario)]);a.equal(line.costoTotalPresupuestado,raw);a.equal(line.costoUnitarioPresupuestado,raw/line.qty);a.equal(line.costoTotalCompra,Money.amount(raw));}
test('stale budget is replaced from the NEW plan while historical commission cost and paid records survive the full flow',()=>{
 const f=fixture({stale:true}),before=clone(f),{state,generated}=prepareAndGenerate(f),sale=state['sisventas/ventas/s'];
 for(const [index,line]of sale.items.entries()){
  assertBudget(line);a.equal(line.costoUnitarioAntesPreparacion,f.sales.s.items[index].costoUnitarioAntesPreparacion);a.notEqual(line.costoTotalPresupuestado,f.sales.s.items[index].costoTotalPresupuestado);
  a.equal(line.preparacionCompra.costoCompraUnitario,f.decisions.rows[index].agreed);
 }
 a.equal(sale.items[0].costoTotalPresupuestado,15.24469);a.equal(sale.items[0].costoUnitarioPresupuestado,7.622345);
 a.equal(sale.items[1].costoTotalPresupuestado,19.576912);a.equal(sale.items[1].costoUnitarioPresupuestado,9.788456);
 finishFlow(f,state,generated);a.deepEqual(f,before);
});
test('first preparation with missing total-budget snapshot captures it and completes actual receipt and reconciliation',()=>{
 const f=fixture({stale:true});for(const line of f.sales.s.items)delete line.costoTotalPresupuestado;
 const {state,generated}=prepareAndGenerate(f);state['sisventas/ventas/s'].items.forEach(assertBudget);finishFlow(f,state,generated);
});
test('raw precision budget captures stay immutable through multiple linked receipts',()=>{
 const f=fixture(),{state,generated}=prepareAndGenerate(f),captured=state['sisventas/ventas/s'].items.map(i=>({total:i.costoTotalPresupuestado,unit:i.costoUnitarioPresupuestado}));
 for(const [index,key]of generated.result.orderKeys.entries()){
  assertBudget(state['sisventas/ventas/s'].items[index]);apply(state,Linked.build(receiveInput(f,state,key,index)));
  for(const [i,line]of state['sisventas/ventas/s'].items.entries()){a.equal(line.costoTotalPresupuestado,captured[i].total);a.equal(line.costoUnitarioPresupuestado,captured[i].unit);}
 }
 assertProtected(state,f.sales.s);
});
test('changed sale quantity and ambiguous legacy distributions produce identifiable REVIEW without mutation',()=>{for(const kind of ['quantity','legacy']){const f=fixture();if(kind==='quantity')f.sales.s.items[0].qty=3;else f.list.simuladorParaguay={version:5,parameters:{allocation:'manual'}};const before=clone(f);a.throws(()=>Prepare.plan(f),e=>e.code==='SV_PURCHASE_PREPARATION_REVIEW');a.deepEqual(f,before);}});
test('single total rounding fixes the independently witnessed 15.24→15.25 cent defect and the whole flow succeeds',()=>{
 const f=fixture();f.sales.s.items[0].costoUnitarioAntesPreparacion=5.123456;
 const original=clone(f),{state,prepared,generated}=prepareAndGenerate(f),next=state['sisventas/ventas/s'].items[0];
 a.deepEqual(f,original);assertBudget(next);a.equal(next.costoTotalCompra,15.25);a.equal(next.costoTotalPresupuestado,15.246912);a.equal(next.costoUnitarioPresupuestado,7.623456);
 a.equal(next.preparacionCompra.costoCompraUnitario,10.123456);a.equal(next.costoUnitarioAntesPreparacion,5.123456);
 const snapshot=prepared.patch['sisventas/listas_materiales/l'].simuladorParaguay;
 const old=require('../js/modules/exterior-preparation').applySaleCosts(f.sales.s,snapshot.rows,snapshot.parameters.usd,i=>i.costoTotalCompra,s=>s.subtotal);
 a.equal(old.items[0].costoTotalCompra,15.24,'unchanged client still exhibits the original defect');
 // Independent integer-decimal witness: (5123456 + 10123456)/1e6 =
 // 15.246912, whose cents close to 1525. No model output derives this oracle.
 a.equal(Number((5123456n+10123456n+5000n)/10000n)/100,15.25);
 finishFlow(f,state,generated);a.deepEqual(f,original);
});
test('binary previous budget is replaced by canonical raw capture and completes actual receipts and reconcile',()=>{
 const f=fixture();for(const line of f.sales.s.items){const p=line.preparacionCompra;line.costoTotalPresupuestado=p.cantidadStock*p.costoStockUnitario+p.cantidadComprar*p.costoCompraUnitario;line.costoUnitarioPresupuestado=line.costoTotalPresupuestado/line.qty;}
 a.equal(f.sales.s.items[0].costoTotalPresupuestado,15.244689999999999);
 const {state,generated}=prepareAndGenerate(f);a.equal(state['sisventas/ventas/s'].items[0].costoTotalPresupuestado,15.24469);state['sisventas/ventas/s'].items.forEach(assertBudget);finishFlow(f,state,generated);
});

const Lifecycle=require('../cotizador/purchase-list-lifecycle-model');
const fingerprint=s=>JSON.stringify({items:s.items||[],total:s.total||0,descuento:s.descuento||0});
function groupedPreparation(){
 const f=fixture({stale:true}),state=stateOf(f),sales={s:clone(f.sales.s),t:{...clone(f.sales.s),id:'V-SECOND',listaMaterialesId:'m'}},lists={l:clone(f.list),m:{...clone(f.list),ventaFbKey:'t',ventaId:'V-SECOND'}};
 for(const [lk,sk]of [['l','s'],['m','t']]){
  // These bases are computed from the explicit original sale, not body values.
  lists[lk].simuladorParaguay={version:6,rows:[],extras:[],pending:[],parameters:{revenue:sales[sk].subtotal,baseline:Money.quantitySum(sales[sk].items.map(i=>Money.rawProduct(i.qty,i.costoUnitarioAntesPreparacion)))}};
  state['sisventas/listas_materiales/'+lk]=clone(lists[lk]);state['sisventas/ventas/'+sk]=clone(sales[sk]);
 }
 const context={id:'group-operation',jointKey:'joint',at:500,date:'2026-11-22',actor:clone(f.context.actor)},group=Lifecycle.planGroup({lists,sales,body:{sources:Object.entries(lists).map(([listKey,list])=>({listKey,expectedHash:digest(list)}))},context,originalJoint:null});
 apply(state,group);
 const joint=state['sisventas/listas_materiales/joint'];
 const decisions={parameters:clone(f.decisions.parameters),rows:joint.items.map(item=>({key:[item.productoKey,item.linea,item.proveedorKey].join('|'),method:'local',providerKey:item.proveedorKey,agreed:Money.quantitySum([item.costoUnitario,1.234567]),requestedQty:1,existing:1})),extras:[],chosen:'remote'};
 function input(applyCosts=true,id='joint-apply') {return {list:clone(state['sisventas/listas_materiales/joint']),listKey:'joint',sales:{s:clone(state['sisventas/ventas/s']),t:clone(state['sisventas/ventas/t'])},sourceLists:{l:clone(state['sisventas/listas_materiales/l']),m:clone(state['sisventas/listas_materiales/m'])},products:clone(f.products),providers:clone(f.providers),decisions:clone(decisions),applyCosts,context:{id,at:1000,actor:clone(f.context.actor)}};}
 return {f,state,sales,lists,group,decisions,input};
}
test('actual group → joint apply → save again → reapply → ungroup refreshes only derived fingerprints under original CAS',()=>{
 const g=groupedPreparation(),originalJoint=clone(g.state['sisventas/listas_materiales/joint']),originalSales=clone(g.sales),input=g.input(),before=clone(input),out=Prepare.plan(input);
 a.deepEqual(input,before);a.deepEqual(out.preconditions['sisventas/listas_materiales/joint'],originalJoint);
 for(const source of originalJoint.sources){
  const sk=source.ventaFbKey,nextSale=out.patch['sisventas/ventas/'+sk],nextSource=out.patch['sisventas/listas_materiales/joint'].sources.find(s=>s.listId===source.listId);
  a.deepEqual(out.preconditions['sisventas/ventas/'+sk],originalSales[sk]);a.deepEqual(out.readDependencies['sisventas/ventas/'+sk],originalSales[sk]);
  a.equal(nextSource.saleFingerprint,fingerprint(nextSale));a.notEqual(nextSource.saleFingerprint,source.saleFingerprint);
  a.deepEqual({...nextSource,saleFingerprint:source.saleFingerprint},source,'only derived fingerprint may change, including original revenue/baseline');
  for(const field of paidFields)a.deepEqual(nextSale[field],originalSales[sk][field]);
  for(const [index,line]of nextSale.items.entries()){a.equal(line.costoUnitarioAntesPreparacion,originalSales[sk].items[index].costoUnitarioAntesPreparacion);a.equal(line.punit,originalSales[sk].items[index].punit);a.equal(line.sub,originalSales[sk].items[index].sub);assertBudget(line);}
 }
 // A parent-only commit would not be sufficient: apply checks ALL original CAS.
 const concurrent=clone(g.state);concurrent['sisventas/ventas/t'].items[0].punit++;
 a.throws(()=>apply(concurrent,out),/original CAS sisventas\/ventas\/t/);
 apply(g.state,out);
 const savedInput=g.input(false,'joint-save-again'),saved=Prepare.plan(savedInput);
 a.deepEqual(Object.keys(saved.patch),['sisventas/listas_materiales/joint']);a.deepEqual(saved.patch['sisventas/listas_materiales/joint'].sources,g.state['sisventas/listas_materiales/joint'].sources);apply(g.state,saved);
 g.decisions.rows[0].agreed=Money.quantitySum([g.decisions.rows[0].agreed,0.234567]);
 const reapplied=Prepare.plan(g.input(true,'joint-reapply'));apply(g.state,reapplied);
 const joint=g.state['sisventas/listas_materiales/joint'];for(const source of joint.sources){a.equal(source.saleFingerprint,fingerprint(g.state['sisventas/ventas/'+source.ventaFbKey]));a.equal(source.baseline,originalJoint.sources.find(s=>s.listId===source.listId).baseline);a.equal(source.revenue,originalJoint.sources.find(s=>s.listId===source.listId).revenue);}
 const ungroupInput={joint:clone(joint),jointKey:'joint',lists:{l:clone(g.state['sisventas/listas_materiales/l']),m:clone(g.state['sisventas/listas_materiales/m'])},sales:{s:clone(g.state['sisventas/ventas/s']),t:clone(g.state['sisventas/ventas/t'])},originalStockList:null,context:{id:'joint-ungroup',at:2000,date:'2026-11-22',actor:g.f.context.actor}},ungroupBefore=clone(ungroupInput),ungrouped=Lifecycle.planUngroup(ungroupInput);
 a.deepEqual(ungroupInput,ungroupBefore);apply(g.state,ungrouped);
 for(const [lk,sk]of [['l','s'],['m','t']]){a.equal(g.state['sisventas/listas_materiales/'+lk].compraConjuntaId,undefined);a.equal(g.state['sisventas/ventas/'+sk].listaMaterialesId,lk);for(const field of paidFields)a.deepEqual(g.state['sisventas/ventas/'+sk][field],originalSales[sk][field]);}
 a.equal(g.state['sisventas/listas_materiales/joint'].desagrupada,true);
});
for(const [field,change]of [
 ['pvp',s=>s.items[0].punit++],['quantity',s=>s.items[0].qty++],['historic commission cost',s=>s.items[0].costoUnitarioAntesPreparacion++],['current cost',s=>s.items[0].costoTotalCompra++],['commercial total',s=>s.total++],['discount',s=>s.descuento++]
])test('refreshed joint fingerprint still rejects external '+field+' changes without mutation',()=>{
 const g=groupedPreparation();apply(g.state,Prepare.plan(g.input()));change(g.state['sisventas/ventas/t']);
 const input=g.input(false,'save-concurrent'),before=clone(input);a.throws(()=>Prepare.plan(input),e=>e.code==='SV_PURCHASE_PREPARATION_REVIEW'&&/cambió desde la agrupación/.test(e.message));a.deepEqual(input,before);
 const ungroupInput={joint:input.list,jointKey:'joint',lists:input.sourceLists,sales:input.sales,originalStockList:null,context:{id:'reject-ungroup',at:2000,date:'2026-11-22',actor:g.f.context.actor}},ungroupBefore=clone(ungroupInput);
 a.throws(()=>Lifecycle.planUngroup(ungroupInput),e=>e.code==='SV_PURCHASE_LIST_LIFECYCLE_REVIEW'&&/venta cambió/.test(e.message));a.deepEqual(ungroupInput,ungroupBefore);
});

test('new partial flow2 receipts and replay/cancel keep legacy reservations and receipts byte-identical',()=>{const f=fixture(),{state,generated,baselineInventory}=prepareAndGenerate(f),key=generated.result.orderKeys[0],row=state['sisventas/ordenes/'+key].items[0],pk=row.productoKey,path='sisventas/inventario_operativo/physical_'+pk;const firstInput=receiveInput(f,state,key,0,0.4),first=Linked.build(firstInput);apply(state,first);a.equal(state[path].general,10.4);a.equal(state[path].reservado,baselineInventory['physical_'+pk].reservado);a.deepEqual(state[path].asignaciones.s.recepcionesCompra[firstInput.body.id],{schema:2,orderKey:key,cantidad:0.4,ts:3000});assertProtected(state,f.sales.s);assertLegacy(state,baselineInventory);const retry=receiveInput(f,state,key,0,0.4),beforeRetry=clone(retry);a.throws(()=>Linked.build(retry));a.deepEqual(retry,beforeRetry);const second=receiveInput(f,state,key,1,0.6);second.body.id='second-partial-flow2';apply(state,Linked.build(second));a.equal(state[path].general,11);a.equal(state[path].enCompra,3);a.deepEqual(state[path].asignaciones.s.recepcionesCompra[second.body.id],{schema:2,orderKey:key,cantidad:0.6,ts:3001});assertLegacy(state,baselineInventory);const cancel={...receiveInput(f,state,key,2),body:{id:'cancel-after-new-receipts',kind:'cancel',orderKey:key},at:4000},physicalBefore=inventory(state);apply(state,Linked.build(cancel));a.deepEqual(inventory(state),physicalBefore);assertProtected(state,f.sales.s);assertLegacy(state,baselineInventory);});
