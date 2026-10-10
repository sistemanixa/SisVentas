const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const source=require('./helpers/active-app').readActiveApp().source;
function setup(){
 let products=Array.from({length:125},(_,i)=>({fbKey:String(i),nombre:'Producto '+i,categoria:'Equipos'}));
 let writes=0,html='';
 const grid={get innerHTML(){return html},set innerHTML(value){writes++;html=value},scrollIntoView(){}};
 const elements={'catalogo-grid':grid,'catalogo-buscar':{value:''},'catalogo-search-field':{value:'principales'},'catalogo-cantidad':{},'catalogo-vacio':{style:{}}};
 const c={document:{getElementById:id=>elements[id]},catalogoCategoriaActual:'',catalogoProductosActuales:[],productosVisiblesCatalogo:()=>products,normalizarTextoCatalogo:v=>v||'',_prodCoincideBusqueda:(p,t)=>p.nombre.includes(t),renderCarritoCatalogo(){},actualizarContadorProductoCatalogo(){},categoriaProductoCatalogo:p=>p.categoria,escapeHTML:String,imagenCatalogoHTML:()=>''};
 vm.createContext(c);
 const filterStart=source.indexOf('function productosFiltradosCatalogo()');
 vm.runInContext(source.slice(filterStart,source.indexOf('\nfunction ',filterStart+10)),c);
 vm.runInContext(source.slice(source.indexOf('var catalogoPaginaActual ='),source.indexOf('function abrirProductoCatalogo(')),c);
 return {c,elements,grid,setProducts:p=>products=p,writes:()=>writes,cards:()=>(html.match(/<article /g)||[]).length};
}
test('125 productos: páginas de 48, 48 y 29; una sola escritura y colección completa para detalle',()=>{
 const r=setup();r.c.renderCatalogo();assert.equal(r.cards(),48);assert.equal(r.writes(),1);assert.equal(r.c.catalogoProductosActuales.length,125);assert.equal(r.elements['catalogo-cantidad'].textContent,'125 productos');assert.match(r.grid.innerHTML,/125 productos<\/small>/);
 r.c.cambiarPaginaCatalogo(1);assert.equal(r.cards(),48);assert.match(r.grid.innerHTML,/data-catalogo-pid="48"/);
 r.c.cambiarPaginaCatalogo(2);assert.equal(r.cards(),29);assert.match(r.grid.innerHTML,/97–125 de 125/);
});
test('búsqueda alcanza productos fuera de página y reinicia página; vacío no muestra navegación',()=>{
 const r=setup();r.c.renderCatalogo();r.c.cambiarPaginaCatalogo(2);r.elements['catalogo-buscar'].value='Producto 10';r.c.renderCatalogo();assert.equal(r.c.catalogoPaginaActual,0);assert.equal(r.cards(),11);assert.equal(r.c.catalogoProductosActuales.length,11);
 r.elements['catalogo-buscar'].value='inexistente';r.c.renderCatalogo();assert.equal(r.cards(),0);assert.equal(r.elements['catalogo-vacio'].style.display,'flex');assert.doesNotMatch(r.grid.innerHTML,/<nav/);
});
test('reducción de datos ajusta página y cambios de campo o categoría vuelven al inicio',()=>{
 const r=setup();r.c.renderCatalogo();r.c.cambiarPaginaCatalogo(2);r.elements['catalogo-search-field'].value='nombre';r.c.renderCatalogo();assert.equal(r.c.catalogoPaginaActual,0);
 r.c.cambiarPaginaCatalogo(2);r.c.catalogoCategoriaActual='Equipos';r.c.renderCatalogo();assert.equal(r.c.catalogoPaginaActual,0);
 r.c.cambiarPaginaCatalogo(2);r.setProducts([{fbKey:'unico',nombre:'Único',categoria:'Equipos'}]);r.c.renderCatalogo();assert.equal(r.c.catalogoPaginaActual,0);assert.equal(r.cards(),1);
});
