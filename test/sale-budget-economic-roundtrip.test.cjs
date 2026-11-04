const test=require('node:test'),assert=require('node:assert/strict');
const Transition=require('../js/core/sale-budget-transition.v1.js');
const V3=require('../js/v3/budget-integration.js');
const {load}=require('./helpers/app-functions.cjs');
const clone=value=>JSON.parse(JSON.stringify(value));
function sale(conIva){return {id:'VENTA-ROUNDTRIP-FICTICIA',conIva,subtotal:180,descuento:40,descuentoGeneral:10,iva:conIva?37.8:0,total:conIva?217.8:180,items:[{cod:'STOCK',productoFbKey:'stock-ficticio',qty:2,punit:100,disc:10,sub:180,costoUnitarioCompra:17.37,costoTotalCompra:34.74,costoOrigen:'stock_ultimo_ingreso_final',costoStockReferencia:{orden:'orden-ficticia',cantidad:2}},{desc:'Cero explícito',qty:1,punit:0,sub:0,costoUnitarioCompra:0,costoVersion:1},{desc:'Costo ausente',qty:1,punit:20,sub:20}]};}
for(const conIva of [false,true])test('economic roundtrip with real app functions and fictional JSON transport VAT '+conIva,async()=>{
 const original=sale(conIva),before=clone(original),sent=Transition.toBudget(original,{sourceFormat:'sale'});
 let writes=0;
 const transport=async payload=>{const candidate=clone(payload);Transition.validateEconomicTransition(original,candidate);writes++;return clone(candidate);};
 const received=await transport(sent),nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',style:{},removeAttribute(){}});return nodes.get(id);};
 let edited=null;
 const context=load({window:{},document:{getElementById:node,querySelector:node},pptoV3Invocar:(method,args)=>V3[method](...args),toggleImagenComprobante(){},buscarPptoPorRef:()=>received,puedeEditarPresupuestoPermiso:()=>true,abrirNuevoPresupuesto(){},iaMarcarPresupuesto(){},_svResolverClienteRegistro:()=>null,actualizarAccesoVentasClientePpto(){},mostrarDomicilioOperacionSeleccionado(){},pptoNumeroGuardado:Number,pptoCargarItemsEnEditor:record=>{edited=clone(record.items);},notify(){},obtenerProductoPorCodigoVenta(){throw Error('No catalogue substitution allowed');}},['abrirEditorPpto','_pptoModeloImpresion','pptoDatosParaVenta']);
 const detail=V3.build(received);assert.equal(detail.ready,true);assert.equal(detail.generalDiscount,20);
 context.abrirEditorPpto('PP-ROUNDTRIP-FICTICIO');assert.equal(node('pp-descuento').value,10);assert.deepEqual(edited,original.items);
 const print=context._pptoModeloImpresion(received),back=context.pptoDatosParaVenta(received);
 assert.equal(print.v3Ready,true);assert.equal(back.v3Ready,true);
 for(const result of [print,back]){assert.equal(result.total,original.total);assert.equal(result.iva,original.iva);assert.equal(result.conIva,original.conIva);assert.equal(result.items[0].costoTotalCompra,34.74);assert.deepEqual(result.items[0].costoStockReferencia,original.items[0].costoStockReferencia);assert.equal(result.items[1].costoUnitarioCompra,0);assert.equal(Object.hasOwn(result.items[2],'costoUnitarioCompra'),false);}
 const returned={...clone(original),items:clone(back.items),subtotal:back.subtotalNeto,descuento:back.descuentoMontoTotal,descuentoGeneral:back.descuentoPct,iva:back.iva,total:back.total,conIva:back.conIva};
 const again=Transition.toBudget(returned,{sourceFormat:'sale'});
 for(const key of ['subtotal','descuento','descuentoAmt','iva','total','conIva'])assert.equal(again[key],sent[key]);
 assert.deepEqual(original,before);assert.equal(writes,1);
 const tampered=clone(sent);tampered.items[0].costoTotalCompra=999;await assert.rejects(transport(tampered),/costos originales/);assert.equal(writes,1);
});
test('explicit source format protects corrected native budgets and rejects missing prices',()=>{
 const original=sale(false),native={...Transition.toBudget(original,{sourceFormat:'sale'}),ventaOrigenFbKey:'venta-ficticia',descuento:5,descuentoGeneral:5,descuentoPct:5,descuentoAmt:10,total:190};
 const normalized=Transition.toBudget(native,{sourceFormat:'budget'});assert.equal(V3.printModel(normalized).total,190);assert.equal(V3.toSale(normalized).discountPct,5);assert.throws(()=>Transition.toBudget(native,{sourceFormat:'sale'}));
 const missing=sale(false);delete missing.items[1].punit;assert.throws(()=>Transition.toBudget(missing,{sourceFormat:'sale'}));assert.equal(V3.build(missing).ready,false);
});
