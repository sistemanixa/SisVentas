'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),Core=require('./helpers/purchase-manual-core-fixture.cjs'),B=require('../cotizador/purchase-current-pending-baseline'),Current=require('../cotizador/purchase-current-pending-command'),Inventory=require('../cotizador/purchase-inventory-command'),References=require('../cotizador/office-stock-reference-port'),{digest}=require('../cotizador/labor-guard');
const copy=v=>structuredClone(v),P='sisventas/ordenes/classic',J='sisventas/inventario_operativo/legacy';
async function fixture(){
 const f=await Core.fixture({coordinated:true,stockOrder:true,pending:2});f.set('sv_permisos/admin/indiceModulos/configuracion',true);f.set('sv_permisos/admin/acciones/mantenimiento/migrar',true);
 const order={estado:'recepcion_parcial',origen:'manual',moneda:'ARS',proveedorKey:'provider',proveedor:'Proveedor ficticio',items:[{productoKey:'product',cantidadOrdenada:3,cantidadRecibida:1,cantidadCostoReal:1,costoRealAcumulado:2.25,costoUnitario:2.25,precioPublico:9.987654}],total:6.75,monto:6.75};f.set(P,order);
 const commit=f.store.commit;f.store.commit=async(...args)=>{const result=await commit(...args),stored=f.get(P);if(stored?.inventarioCompra){const wire=JSON.parse(JSON.stringify(stored));wire.inventarioCompra.baseline.rows=Object.values(wire.inventarioCompra.baseline.rows);wire.inventarioCompra.references=Object.values(wire.inventarioCompra.references);f.set(P,wire);}return result;};
 const options={enabled:true,authorize:async()=>f.identity,store:f.store,guard:f.guard,mappedAdmission:f.authority,queryPage:f.store.queryPage,now:()=>f.now,assertAdmission:async({read})=>f.authority.admit({read})},body={id:'fiction-shape-baseline',orderKey:'classic',expectedHash:digest(order)};
 const ack=await Current.create(options).execute({},body);return{...f,options,body,ack};
}
test('native command -> RTDB dense arrays -> History -> real future receipt keeps the original baseline seal',async()=>{
 const f=await fixture(),order=f.get(P),baseline=copy(order.inventarioCompra.baseline),receipt=copy(f.get('sv_labor_receipts/'+f.body.id)),stock=copy(f.get(J));a.equal(Array.isArray(baseline.rows),true);a.equal(Array.isArray(order.inventarioCompra.references),true);a.equal(B.validateReceipt(order,receipt),true);
 const body={id:'fiction-shape-future-receipt',kind:'receive',orderKey:'classic',expectedHash:digest(order),expectedRevision:order._svReadRevision,movements:[{index:0,quantity:1,realUnitCost:3.125}]};
 await Inventory.create({...f.options,resolveReference:References.createReferenceResolver({enabled:true,mappedAdmission:f.authority})}).execute({},body);
 a.equal(f.patches.length,2);a.equal(f.get(J+'/general'),stock.general+1);a.equal(f.get(J+'/enCompra'),stock.enCompra-1);a.deepEqual(f.get(P+'/inventarioCompra/baseline'),baseline);a.equal(B.validateReceipt(f.get(P),receipt),true);a.deepEqual(f.get('sv_labor_receipts/'+f.body.id),receipt);
});
test('dense metadata maps and arrays share only the baseline-specific rows and baseline digests',async()=>{
 const f=await fixture(),arrayOrder=f.get(P),mapOrder=copy(arrayOrder);mapOrder.inventarioCompra.baseline.rows=Object.fromEntries(arrayOrder.inventarioCompra.baseline.rows.map((row,index)=>[String(index),row]));mapOrder.inventarioCompra.references=Object.fromEntries(arrayOrder.inventarioCompra.references.map((row,index)=>[String(index),row]));const receipt=f.get('sv_labor_receipts/'+f.body.id);
 a.equal(B.validateReceipt(arrayOrder,receipt),true);a.equal(B.validateReceipt(mapOrder,receipt),true);a.equal(B.rowsDigest(mapOrder.inventarioCompra.baseline.rows),B.rowsDigest(arrayOrder.inventarioCompra.baseline.rows));a.equal(B.baselineDigest(mapOrder.inventarioCompra.baseline),B.baselineDigest(arrayOrder.inventarioCompra.baseline));a.notEqual(digest(mapOrder.inventarioCompra.baseline),digest(arrayOrder.inventarioCompra.baseline));a.equal(receipt.result.baselineDigest,digest(mapOrder.inventarioCompra.baseline));
});
for(const bag of ['rows','references'])for(const scenario of ['hole','null','extra','leadingZero','negative','symbol','arrayExtra'])test('metadata '+bag+' rejects '+scenario+' instead of normalizing it away',async()=>{
 const f=await fixture(),order=f.get(P),marker=order.inventarioCompra,container=bag==='rows'?marker.baseline:marker,key=bag==='rows'?'rows':'references',row=copy(container[key][0]);
 if(scenario==='hole'){container[key]=new Array(2);container[key][1]=row;}
 if(scenario==='null')container[key]=[row,null];
 if(scenario==='extra')container[key]={'0':row,x:row};
 if(scenario==='leadingZero')container[key]={'00':row};
 if(scenario==='negative')container[key]={'-1':row};
 if(scenario==='symbol'){container[key]=[row];container[key][Symbol('extra')]=row;}
 if(scenario==='arrayExtra'){container[key]=[row];container[key].extra=row;}
 a.throws(()=>B.validateReceipt(order,f.get('sv_labor_receipts/'+f.body.id)),{code:'SV_PURCHASE_CURRENT_PENDING_BASELINE_REVIEW'});a.equal(f.patches.length,1);
});
