const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {project}=require('../js/modules/public-catalog-share');
const {pdfComparisonText}=require('../js/modules/paraguay-shopping-access');
test('proyección pública USD respeta exención y alícuotas sin publicar pesos ni costos',()=>{
 for(const iva of [0,10.5,21]){
  const p=project({categoria:'COMPRAS PARAGUAY',ventaARS:100000,iva,compra:20},1000);
  assert.equal(p.precioUSD,100*(1+iva/100));assert.equal(p.iva,iva);
  assert.equal(p.precioARS,undefined);assert.equal(p.compra,undefined);
 }
 assert.equal(project({categoria:'COMPRAS PARAGUAY',ventaARS:1000},0).precioUSD,0);
});
test('ahorro impreso en USD y referencia interna en ARS',()=>{
 const c={saving:20000,reference:100000};assert.match(pdfComparisonText(c,1000),/US\$ 20,00/);
 assert.doesNotMatch(pdfComparisonText(c,1000),/ARS/);assert.match(pdfComparisonText(c),/ARS/);
});
test('carrito mixto calcula impuesto por producto y no grava exentos',()=>{
 const src=require('./helpers/active-app').readActiveApp().source;
 let box={};const ctx={actualizarContadorProductoCatalogo(){},document:{getElementById:()=>box},productosVisiblesCatalogo:()=>[{fbKey:'E',iva:0,precio:100},{fbKey:'T',iva:10.5,precio:100}],catalogoCarrito:new Map([['E',2],['T',1]]),precioVentaCanonicoProducto:p=>({precioARS:p.precio}),alicuotaIvaProducto:v=>v??21,_redondearPrecioActual:n=>n,escapeHTML:String,importeComprobanteVenta:String,catalogoAccionSeleccion:()=>''};
 vm.createContext(ctx);vm.runInContext(src.slice(src.indexOf('function renderCarritoCatalogo()'),src.indexOf('async function prepararPresupuestoCatalogo()')),ctx);ctx.renderCarritoCatalogo();assert.match(box.innerHTML,/310.5/);assert.doesNotMatch(box.innerHTML,/con IVA/);
});
