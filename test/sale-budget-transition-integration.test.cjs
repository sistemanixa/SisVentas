const test=require('node:test'),assert=require('node:assert/strict');
const Transition=require('../js/core/sale-budget-transition.v1.js');
const V3=require('../js/v3/budget-integration.js');
const {load}=require('./helpers/app-functions.cjs');

function fixture(conIva){return {id:'VENTA-FICTICIA',cliente:'Cliente ficticio',clienteFbKey:'cliente-ficticio',direccionCliente:'Dirección ficticia',comisionado1FbKey:'persona-ficticia',creadaPorUid:'autor-ficticio',observaciones:'Observaciones ficticias',items:[{cod:'P',productoFbKey:'producto-ficticio',qty:2,punit:100,disc:10,sub:180,costoUnitarioCompra:25,costoTotalCompra:50,costoOrigen:'stock_ultimo_ingreso_final',costoStockReferencia:{orden:'compra-ficticia'}},{cod:'MO',qty:1,punit:20,sub:20,costoUnitarioCompra:0,costoVersion:1},{desc:'Sin costo histórico',qty:1,punit:0,sub:0}],subtotal:180,descuento:40,descuentoGeneral:10,iva:conIva?37.8:0,total:conIva?217.8:180,conIva};}

for(const conIva of [false,true])test('real editor and print/conversion functions share normalized economics, VAT '+conIva,()=>{
 const original=fixture(conIva),budget=Transition.toBudget(original,{sourceFormat:'sale'}),nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',style:{},removeAttribute(){}});return nodes.get(id);};
 let editorItems=null;
 const context=load({window:{},document:{getElementById:node,querySelector:node},pptoV3Invocar:(method,args)=>V3[method](...args),toggleImagenComprobante(){},buscarPptoPorRef:()=>budget,puedeEditarPresupuestoPermiso:()=>true,abrirNuevoPresupuesto(){},iaMarcarPresupuesto(){},_svResolverClienteRegistro:()=>null,actualizarAccesoVentasClientePpto(){},mostrarDomicilioOperacionSeleccionado(){},pptoNumeroGuardado:Number,pptoCargarItemsEnEditor:record=>{editorItems=record.items;},notify(){}},['abrirEditorPpto','_pptoModeloImpresion','pptoDatosParaVenta']);
 context.abrirEditorPpto('presupuesto-ficticio');
 assert.equal(node('pp-descuento').value,10);
 assert.equal(context._pptoConIva,conIva);
 assert.deepEqual(editorItems,budget.items);
 const detail=V3.build(budget),print=context._pptoModeloImpresion(budget),back=context.pptoDatosParaVenta(budget);
 assert.equal(detail.total,original.total);assert.equal(print.total,original.total);assert.equal(back.total,original.total);
 assert.equal(print.descuento,20);assert.equal(print.iva,original.iva);assert.equal(print.conIva,conIva);
 assert.equal(back.descuentoPct,10);assert.equal(back.descuentoMontoTotal,40);assert.equal(back.subtotalNeto,180);assert.equal(back.v3Ready,true);
 assert.equal(print.v3Ready,true);
 for(const items of [print.items,back.items]){assert.equal(items[0].costoUnitarioCompra,25);assert.equal(items[0].costoTotalCompra,50);assert.deepEqual(items[0].costoStockReferencia,original.items[0].costoStockReferencia);assert.equal(items[0].productoFbKey,'producto-ficticio');assert.equal(items[1].costoUnitarioCompra,0);assert.equal(Object.hasOwn(items[2],'costoUnitarioCompra'),false);}
 for(const key of ['direccionCliente','comisionado1FbKey','creadaPorUid','observaciones'])assert.equal(budget[key],original[key]);
});

test('corrected native budget with sale origin passes real V3 without reinterpretation',()=>{
 const native={...fixture(false),ventaOrigenFbKey:'venta-ficticia',subtotal:200,descuento:5,descuentoGeneral:5,descuentoAmt:10,total:190};
 const budget=Transition.toBudget(native,{sourceFormat:'budget'}),print=V3.printModel(budget),back=V3.toSale(budget);
 assert.equal(print.ready,true);assert.equal(print.discount,10);assert.equal(print.total,190);assert.equal(back.discountPct,5);assert.equal(back.discountAmount,30);assert.equal(back.total,190);
});

test('positive sale prices yield ready V3 models while zero and missing costs remain untouched',()=>{
 const input=fixture(false);input.items[1].punit=10;input.items[1].sub=10;input.items[2].punit=10;input.items[2].sub=10;
 const budget=Transition.toBudget(input,{sourceFormat:'sale'});
 for(const model of [V3.printModel(budget),V3.toSale(budget)]){assert.equal(model.ready,true);assert.equal(model.total,180);assert.equal(model.items[1].costoUnitarioCompra,0);assert.equal(Object.hasOwn(model.items[2],'costoUnitarioCompra'),false);}
});
