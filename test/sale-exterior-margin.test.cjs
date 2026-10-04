const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {applySaleCosts}=require('../js/modules/exterior-preparation');
const src=require('./helpers/active-app').readActiveApp().source;
const cost=i=>i.costoTotalCompra??i.costoUnitarioCompra*i.qty;
const ctx={obtenerCostoItemVenta:cost,itemVentaEsManoDeObraReporte:i=>i.cod==='MO',_margenCostoGananciaHTML:(c,g,m)=>`${c}/${g}/${m}`,importeComprobanteVenta:n=>'$'+n};
vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('function comparacionMargenExteriorVenta('),src.indexOf('function _comisionManualVentaEtiqueta(')),ctx);
const sale=()=>({subtotal:1000,total:1210,descuento:0,items:[{cod:'A',qty:2,punit:300,costoUnitarioCompra:200},{cod:'L',qty:1,punit:300,costoUnitarioCompra:150},{cod:'MO',qty:1,punit:100,costoUnitarioCompra:50}]});
const rows=()=>[{code:'A',sourceLine:0,needed:2,existing:0,requestedQty:2,agreed:1,method:'exterior',provider:'Flytec',providerKey:'F'}];
test('aplicar exterior conserva venta y comisión y muestra ambas ganancias al reaplicar',()=>{
 const before=sale(),base=ctx._calcularBaseComisionVenta(before);
 const next=applySaleCosts(before,rows(),100,cost,s=>s.subtotal);
 assert.equal(next.total,1210);assert.equal(next.items[0].proveedorCompra,'Flytec');assert.equal(next.items[0].compraExteriorAplicada.cantidad,2);
 assert.deepEqual(ctx._calcularBaseComisionVenta(next),base);
 const result=ctx.comparacionMargenExteriorVenta(next.items,1000);
 assert.equal(result.original,600);assert.equal(result.actual,400);assert.equal(result.gananciaOriginal,400);assert.equal(result.gananciaExterior,600);assert.equal(result.diferencia,200);assert.equal(result.manoActual,50);
 const again=applySaleCosts(next,[{...rows()[0],agreed:0.5}],100,cost,s=>s.subtotal);
 assert.equal(ctx.comparacionMargenExteriorVenta(again.items,1000).original,600);assert.deepEqual(ctx._calcularBaseComisionVenta(again),base);
 const html=ctx.comparacionMargenExteriorVentaHTML(again.items,1000);assert.match(html,/Margen original de la venta/);assert.match(html,/Margen con compra exterior/);assert.match(html,/\$300/);
});
test('volver a local quita marca exterior y un costo mayor muestra disminución',()=>{
 const next=applySaleCosts(sale(),[{...rows()[0],agreed:3}],100,cost,s=>s.subtotal);
 assert.match(ctx.comparacionMargenExteriorVentaHTML(next.items,1000),/Disminución de ganancia: \$200/);
 const local=applySaleCosts(next,[{...rows()[0],method:'local',agreed:200,provider:'Local',providerKey:'L'}],100,cost,s=>s.subtotal);
 assert.equal(local.items[0].compraExteriorAplicada,undefined);assert.equal(ctx.comparacionMargenExteriorVenta(local.items,1000),null);
 assert.equal(ctx.comparacionMargenExteriorVenta(next.items,0).margenExterior,null);
});
test('aplicación masiva respeta costo original conservado por presupuesto individual',()=>{
 const input=sale();input.items[0].costoCompraAnterior=250;
 const next=applySaleCosts(input,rows(),100,cost,s=>s.subtotal);
 assert.equal(next.items[0].costoUnitarioAntesPreparacion,250);
 assert.equal(ctx.comparacionMargenExteriorVenta(next.items,1000).original,700);
});
