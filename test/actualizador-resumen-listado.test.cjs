const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
test('contador y lista incluyen URL a revisar, sin duplicar productos, y responden a correcciones',()=>{
 const p={fbKey:'p',proveedores:[{nombre:'CIARDI',valida:false,vigente:true},{nombre:'CIARDI',valida:true,vigente:true}]};
 const q={fbKey:'q',proveedores:[{nombre:'CIARDI',valida:true,vigente:false}]};
 const ctx={URL,prodData:{p,q},window:{},_renderActualizadorPreciosToken:1,setTimeout:fn=>fn(),document:{getElementById:()=>null},productoEstaActivo:p=>p.activo!==false,esProductoManoDeObra:()=>false,proveedoresVinculadosProducto:p=>p.proveedores,proveedorAutomaticoDeFila:()=>({fbKey:'ciardi'}),urlAutomaticaValida:pv=>pv.valida,estadoVigenciaPrecioProveedor:(p,pv)=>({vigente:pv.vigente,texto:'Precio vigente'}),leerSeleccionProveedoresActualizador:()=>({auto_ciardi:true}),proveedoresSeleccionadosActualizador:()=>['auto_ciardi'],actualizadorPintarResumenDesdeCache:()=>{}};
 load(ctx,['enlacesResumenActualizadorProducto','iniciarResumenActualizadorIncremental','productosParaListadoActualizadorPrecios']);
 ctx.iniciarResumenActualizadorIncremental(1);
 const listado=ctx.productosParaListadoActualizadorPrecios('pendientes');
 assert.equal(listado.length,2);assert.equal(listado.find(x=>x.producto.fbKey==='p').estado.texto,'Revisar URL del proveedor');
 assert.deepEqual(Array.from(listado,x=>x.producto.fbKey).sort(),Object.keys(ctx._actualizadorResumenCache.porTipo.auto_ciardi.pendientes).sort());
 p.proveedores[0].valida=true;
 assert.equal(ctx.productosParaListadoActualizadorPrecios('pendientes').length,1);
 ctx.iniciarResumenActualizadorIncremental(1);
 assert.equal(Object.keys(ctx._actualizadorResumenCache.porTipo.auto_ciardi.pendientes).length,1);
 q.activo=false;assert.equal(ctx.productosParaListadoActualizadorPrecios('pendientes').length,0);
});
