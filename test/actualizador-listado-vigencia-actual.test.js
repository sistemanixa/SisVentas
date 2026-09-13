const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const index=fs.readFileSync('index.html','utf8');
const app=fs.readFileSync(index.match(/src="\.\/(js\/app\.v[\d.]+\.js)/)[1],'utf8');
const start=app.indexOf('function productosParaListadoActualizadorPrecios('),end=app.indexOf('\n}',start)+2;
function setup(){
 const old={fbKey:'p1',codigo:'P-1',nombre:'Producto anterior'};
 const current={fbKey:'p1',codigo:'P-1',nombre:'Producto corregido'};
 const links=[{producto:current,tipo:'biosegur',proveedor:{nombre:'BIOSEGUR',vigente:true},estadoResumen:{vigente:false,texto:'Anterior'}}];
 const ctx={_actualizadorResumenCache:{listo:true,enlaces:[{producto:old,tipo:'biosegur',proveedor:{nombre:'BIOSEGUR',vigente:false},estadoResumen:{vigente:false,texto:'Anterior'}}]},proveedoresSeleccionadosActualizador:()=>['biosegur'],productosBiosegurActualizables:()=>links,estadoVigenciaPrecioProveedor:(_,pv)=>({vigente:pv.vigente,texto:pv.vigente?'Actualizado':'Pendiente'})};
 vm.createContext(ctx);vm.runInContext(app.slice(start,end),ctx);return {ctx,links,current};
}
test('un producto resuelto desaparece aunque la caché anterior diga pendiente',()=>{
 const {ctx}=setup();assert.equal(ctx.productosParaListadoActualizadorPrecios('pendientes').length,0);
 const fresh=ctx.productosParaListadoActualizadorPrecios('vigentes');assert.equal(fresh.length,1);assert.equal(fresh[0].producto.nombre,'Producto corregido');
});
test('si otro proveedor seleccionado sigue pendiente, el producto permanece',()=>{
 const {ctx,links,current}=setup();links.push({producto:current,tipo:'biosegur',proveedor:{nombre:'Otro',vigente:false}});
 assert.equal(ctx.productosParaListadoActualizadorPrecios('pendientes').length,1);
 links[1].proveedor.vigente=true;assert.equal(ctx.productosParaListadoActualizadorPrecios('pendientes').length,0);
});
test('enlaces retirados de la ficha no sobreviven por la caché',()=>{
 const {ctx,links}=setup();links.length=0;assert.equal(ctx.productosParaListadoActualizadorPrecios('vinculados').length,0);
});
test('proveedores no seleccionados no mantienen un pendiente falso',()=>{
 const {ctx,links,current}=setup();links.push({producto:current,tipo:'mercado_libre',proveedor:{nombre:'ML',vigente:false}});
 assert.equal(ctx.productosParaListadoActualizadorPrecios('pendientes').length,0);
});
