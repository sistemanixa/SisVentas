const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {calculateDraft}=require('../js/modules/exterior-preparation');
const src=fs.readFileSync('js/modules/purchase-orders.js','utf8');
const c={window:{},safeKey:String,today:()=> '2026-10-02'};vm.createContext(c);vm.runInContext(src.slice(src.indexOf('  function buildPlannedOrders'),src.indexOf('  async function confirmPlannedPurchase')),c);
const make=()=>({parameters:{usd:1000,payment:'USD',shippingInsuredUSD:30,remoteOther:0,revenue:500000,baseline:300000},chosen:'remote',rows:[{key:'A|0|P',productKey:'A',code:'A',qty:1,needed:1,existing:0,agreed:100,method:'exterior',provider:'Exterior',providerKey:'P',baselineUnit:150000},{key:'B|1|L',productKey:'B',code:'B',qty:1,needed:1,existing:0,agreed:80000,method:'local',provider:'Local',providerKey:'L',baselineUnit:150000}],extras:[{productKey:'X',code:'X',qty:1,agreed:100,destination:'stock',provider:'Exterior',providerKey:'P'}]});
const list={fbKey:'LIST',numero:'Lista',ventaFbKey:'SALE',ventaId:'V1',items:[{productoKey:'A',codigo:'A',linea:0,proveedorKey:'P',incluir:true,cantidadNecesaria:1},{productoKey:'B',codigo:'B',linea:1,proveedorKey:'L',incluir:true,cantidadNecesaria:1}]};
test('órdenes mantienen proveedor exterior/local y separan extras sin duplicar gastos',()=>{const s=calculateDraft(make()),orders=c.buildPlannedOrders(list,s);assert.equal(orders.length,3);assert.equal(orders.reduce((sum,o)=>sum+o.total,0),s.result.orderTotal);assert.equal(orders.find(o=>o.origen==='extra_stock').total,115000);assert.equal(orders.find(o=>o.proveedorKey==='L').total,80000);assert.ok(orders.filter(o=>o.origen==='venta').every(o=>o.ventaFbKey==='SALE'));});
test('pedido sólo con stock no genera órdenes vacías',()=>{const d=make();d.extras=[];d.rows.forEach(r=>r.method='stock');const s=calculateDraft(d);assert.equal(c.buildPlannedOrders(list,s).length,0);});
test('cambio de cantidad de venta invalida confirmación',()=>{const s=calculateDraft(make());assert.throws(()=>c.buildPlannedOrders({...list,items:list.items.map(i=>({...i,cantidadNecesaria:0}))},s),/selección|cantidades/);});
test('recepción utiliza ingreso neto canónico para el margen',async()=>{const sale={items:[{codigo:'A',qty:1,costoUnitarioCompra:100}],subtotal:200,total:242};const ctx={window:{fbDB:{},_rentIngresoNetoVenta:()=>180,fbRef:(_,p)=>p,fbRunTransaction:async(_,fn)=>fn(sale)}};vm.createContext(ctx);const start=src.indexOf('  function syncSalePurchaseCosts');vm.runInContext(src.slice(start,src.indexOf('  function ',start+12)),ctx);await ctx.syncSalePurchaseCosts({ventaFbKey:'S'},[{item:{codigo:'A'},qty:1,costoUnitarioReal:90}],true);assert.equal(sale.margenPct,50);assert.equal(sale.total,242);});
test('reintentos de creación usan una única lista transaccional por venta',async()=>{const db={},sale={fbKey:'S1',id:'V1',cliente:'Cliente',items:[{descripcion:'Producto'}]};const ctx={Date,Promise,Error,Object,state:{lists:[]},saleRef:()=>sale,existingListForSale:()=>null,buildMaterialItem:i=>i,isPurchasableMaterialItem:()=>true,safeKey:String,today:()=> '2026-10-02',PATH_LISTS:'lists',update:async()=>{},window:{fbDB:{},fbRef:(_,p)=>p,fbRunTransaction:async(p,fn)=>{db[p]=fn(db[p]);return {committed:true,snapshot:{val:()=>db[p]}};}}};vm.createContext(ctx);const start=src.indexOf('  function createListFromSale');vm.runInContext(src.slice(start,src.indexOf('  function ensureModal',start)),ctx);await Promise.all([ctx.createListFromSale(sale,{silent:true}),ctx.createListFromSale(sale,{silent:true})]);assert.equal(Object.keys(db).length,1);assert.equal(ctx.state.lists.length,1);});

test('guardar preparación y costo es atómico, mantiene cambios ajenos y rechaza preparación obsoleta',async()=>{
 const api=require('../js/modules/exterior-preparation');const equal=require('../js/core/guarded-writes').equal;
 let db={listas_materiales:{L:{estado:'preparacion'}},ventas:{S:{subtotal:1000,total:1210,observaciones:'Cambio de otro usuario',items:[{cod:'A',qty:1,costoUnitarioCompra:500}]}}};
 const ctx={JSON,Number,Object,Error,materialListLocked:l=>l.estado==='cerrada',window:{currentUserUid:'u',fbDB:{},SVExteriorPreparation:api,SVGuardedWrites:{equal},obtenerCostoItemVenta:i=>i.costoTotalCompra??i.costoUnitarioCompra*i.qty,_rentIngresoNetoVenta:s=>s.subtotal,fbRef:(_,p)=>p,fbGet:async()=>({val:()=>db}),fbRunTransaction:async(_,fn)=>{const next=fn(structuredClone(db));if(next===undefined)return {committed:false};db=next;return {committed:true};}}};vm.createContext(ctx);
 const start=src.indexOf('  async function savePreparationAndSaleCosts');vm.runInContext(src.slice(start,src.indexOf('  window.ocAbrirSimuladorParaguay',start)),ctx);
 const list={fbKey:'L',ventaFbKey:'S'},snapshot={version:6,exteriorAppliedAt:123,parameters:{usd:100},rows:[{code:'A',sourceLine:0,needed:1,existing:0,method:'exterior',agreed:2,providerKey:'P',provider:'P'}]};
 await ctx.savePreparationAndSaleCosts(list,{...snapshot,exteriorAppliedAt:null},{});assert.equal(db.ventas.S.costoTotal,undefined);list.simuladorParaguay=structuredClone(db.listas_materiales.L.simuladorParaguay);
 await ctx.savePreparationAndSaleCosts(list,snapshot,{});assert.equal(db.ventas.S.costoTotal,200);assert.equal(db.ventas.S.total,1210);assert.equal(db.ventas.S.observaciones,'Cambio de otro usuario');assert.equal(db.listas_materiales.L.simuladorParaguay.rows[0].agreed,2);
 await assert.rejects(ctx.savePreparationAndSaleCosts(list,{...snapshot,rows:[{...snapshot.rows[0],agreed:3}]},{}),/Otro usuario/);assert.equal(db.ventas.S.costoTotal,200);
});

test('aplicar exterior permite guardar sin cambios y sin confirmar órdenes',async()=>{
 const text=fs.readFileSync('js/modules/exterior-preparation.js','utf8'),start=text.indexOf('    async function save(confirm');
 let saved,confirmed=false;const ctx={busy:false,frozen:false,dirty:false,status:'',owner:'u',cleanState:'same',editState:()=> 'same',render:()=>({rows:[{method:'exterior',qty:1,providerKey:'P',agreed:10}],parameters:{usd:1000},complete:false}),d:{saved:{}},root:{currentUserUid:'u',currentUser:'Prueba'},ctx:{save:async s=>{saved=s},confirm:async()=>{confirmed=true}},num:v=>Number(v)||0,copy:structuredClone,el:{isConnected:true},Date,Object,Error};
 vm.createContext(ctx);vm.runInContext(text.slice(start,text.indexOf('    function close(',start)),ctx);await ctx.save(false,true);
 assert.ok(saved.exteriorAppliedAt);assert.equal(saved.exteriorAppliedBy,'u');assert.equal(confirmed,false);assert.match(ctx.status,/aplicada/);
});

test('compras de exterior incluye ventas pagadas y pendientes, sin cerrar por pago',()=>{
 const ctx={window:{},saleRef:()=>({estadoPago:'pago_total',items:[{origenCompra:'Exterior',costoUnitarioCompra:100}]})};vm.createContext(ctx);
 for(const [name,next] of [['balanceTieneCompraExterior','balancePurchaseTitle'],['balanceFinalizado','balanceIndicadores']]){const start=src.indexOf('  function '+name);vm.runInContext(src.slice(start,src.indexOf('  function '+next,start)),ctx);}
 for(const estadoPago of ['pago_total','pendiente_pago','seniado']){
 const list={estado:'preparacion',estadoPago,simuladorParaguay:{version:6,rows:[{include:true,qty:1}],extras:[]}};
 assert.equal(ctx.balanceTieneCompraExterior(list),true);assert.equal(ctx.balanceFinalizado(list),false);
 }
 assert.equal(ctx.balanceTieneCompraExterior({ventaId:'V1'}),true);
});

test('borrador exterior sin costos aplicados no aparece y no calcula margen válido',()=>{
 const ctx={window:{},saleRef:()=>({items:[{cod:'A'}]})};vm.createContext(ctx);
 for(const [name,next] of [['balanceTieneCompraExterior','balancePurchaseTitle'],['balanceIndicadores','balanceTieneCompraExterior']]){const start=src.indexOf('  function '+name);vm.runInContext(src.slice(start,src.indexOf('  function '+next,start)),ctx);}
 const list={simuladorParaguay:{version:6,complete:false,parameters:{},result:{margin:76.85},rows:[{include:true,method:'exterior',qty:1,agreed:''}]}};
 assert.equal(ctx.balanceTieneCompraExterior(list),false);assert.equal(ctx.balanceIndicadores(list),null);
});
