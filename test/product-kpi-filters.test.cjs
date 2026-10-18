'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {source,index}=require('./helpers/active-app').readActiveApp();
function setup(){
 const els={},el=id=>els[id]??={value:'',textContent:'',innerHTML:'',style:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;}};
 const products=Object.fromEntries(Array.from({length:36},(_,i)=>['p'+i,{fbKey:'p'+i,codigo:'P-'+i,nombre:'Producto '+i,categoria:'Grupo',margenDeseado:i<4?0:20,stock:999}]));
 const context={window:{SisVentasCompras:{state:{inventory:Object.fromEntries(Array.from({length:36},(_,i)=>['p'+i,{general:i<32?2:0,reservado:99,enCompra:88}]))}}},document:{getElementById:el},prodData:products,ventasList:[],_filtroProductosSinPrecio:true,_filtroProductosSobrantes:false,_filtroProductosMasVendidos:false,_filtroProductosSinValorAgregado:false,_filtroUsoProductos:'inactivos',_prodCatsAbiertas:{Grupo:false},_sortState:{},_ordenPrecioProductos:'',_prodCategoriasFirma:'fixture',_prodLimiteBusqueda:80,stockData:{},productoSinPrecioCatalogo:p=>p.sinPrecio===true,escapeHTML:s=>String(s),_renderFilaProd:p=>'<tr data-product="'+p.fbKey+'"></tr>',prepararAccionesGrilla(){},_estadoBusquedaProductos(){},poblarSelectCategorias(){},actualizarVistaFiltroProductosSinPrecio(){}};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf('function productoConSobranteReal('),source.indexOf('function cambiarFiltroUsoProductos(')),context);
 vm.runInContext(source.slice(source.indexOf('function _claveInventarioProducto('),source.indexOf('function productoCoincideItemVenta(')),context);
 vm.runInContext(source.slice(source.indexOf('function renderTablaProductos('),source.indexOf('var _todasColapsadas',source.indexOf('function renderTablaProductos('))),context);
 return {context,el,products};
}
test('tarjeta de sobrantes y listado muestran los mismos32 por inventario operativo, no stock histórico',()=>{
 const {context:c,el,products}=setup(),before=JSON.stringify(products);el('prod-search').value='no coincide';el('filter-cat').value='otra';c.window._prodCategoriaFiltro='otra';
 c.toggleFiltroRapidoProductos('sobrantes');assert.equal(el('stat-prod-stock').textContent,32);assert.equal((el('prod-tbody').innerHTML.match(/data-product=/g)||[]).length,32);assert.equal(el('prod-search').value,'');assert.equal(el('filter-cat').value,'');assert.equal(c._filtroUsoProductos,'todos');assert.equal(c._filtroProductosSinPrecio,false);assert.equal(el('stat-prod-stock-card').attributes['aria-pressed'],'true');assert.equal(JSON.stringify(products),before);
 c.toggleFiltroRapidoProductos('sobrantes');assert.equal((el('prod-tbody').innerHTML.match(/data-product=/g)||[]).length,36);assert.equal(el('prod-filtro-sobrantes-activo').style.display,'none');
});
test('valor agregado cuenta y filtra cero explícito, sin confundir faltantes o valores malformados',()=>{
 const {context:c,el}=setup();for(const value of [0,'0','0.00','0,00'])assert.equal(c.productoSinValorAgregado({margenDeseado:value}),true);
 for(const value of [undefined,null,'',' ',0.01,'0,01','0error','error',-1])assert.equal(c.productoSinValorAgregado({margenDeseado:value}),false);
 c.toggleFiltroRapidoProductos('sobrantes');c.toggleFiltroRapidoProductos('sinvalor');assert.equal(c._filtroProductosSobrantes,false);assert.equal(el('stat-prod-sinvalor').textContent,4);assert.equal((el('prod-tbody').innerHTML.match(/data-product=/g)||[]).length,4);assert.equal(el('stat-prod-sinvalor-card').attributes['aria-pressed'],'true');
});
test('ambas tarjetas permiten teclado y tienen un filtro visible que se puede quitar',()=>{
 for(const tipo of ['sobrantes','sinvalor']){assert.ok(index.includes('onclick="toggleFiltroRapidoProductos(\''+tipo+'\')"'));assert.ok(index.includes("event.preventDefault();toggleFiltroRapidoProductos('"+tipo+"');"));assert.ok(index.includes('id="prod-filtro-'+tipo+'-activo"'));}
});

test('más vendidos muestra top50 en la misma grilla, ordena por ventas y permite quitarlo',()=>{
 const {context:c,el}=setup();c.window.SVProductRanking=require('../js/core/product-ranking');c.ventaValidaParaMetricas=v=>!v.anulada;c.fechaVentaOrdenISO=f=>f;
 const now=new Date(),fecha=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-01';
 c.prodData=Object.fromEntries(Array.from({length:60},(_,i)=>['p'+i,{fbKey:'p'+i,codigo:'P-'+i,nombre:'Producto '+String(i).padStart(2,'0')}]));
 c.ventasList=Object.values(c.prodData).map((p,i)=>({id:'v'+i,fecha,items:[{pid:p.fbKey,qty:i===0?10000:1}]}));c.ventasList.push({id:'extra',fecha,items:[{pid:'p59',qty:1}]});
 c.toggleFiltroRapidoProductos('masvendidos');assert.equal((el('prod-tbody').innerHTML.match(/data-product=/g)||[]).length,50);assert.ok(el('prod-tbody').innerHTML.startsWith('<tr data-product="p59"'));assert.ok(el('stat-prod-top').textContent.includes('Producto 59'));assert.equal(el('stat-prod-top-label').textContent,'Más vendidos');assert.equal(el('stat-prod-top-card').attributes['aria-pressed'],'true');
 c.toggleFiltroRapidoProductos('masvendidos');assert.equal((el('prod-tbody').innerHTML.match(/data-product=/g)||[]).length,60);assert.equal(el('prod-filtro-masvendidos-activo').style.display,'none');
 assert.ok(index.includes('id="stat-prod-top-card"'));assert.ok(index.includes('js/core/product-ranking.js?v=3.12.16'));
});
