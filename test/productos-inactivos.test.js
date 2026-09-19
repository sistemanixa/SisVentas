const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('node:vm');
const src=require('./helpers/active-app').readActiveApp().source;const ctx={prodData:{}};
vm.runInNewContext(src.slice(src.indexOf('function productoEstaActivo('),src.indexOf('function productosBiosegurActualizables(')),ctx);
test('estado activo compartido excluye variantes inactivas y eliminados',()=>{
 for(const p of [{activo:false},{activo:0},{activo:'false'},{estado:'inactivo'},{estado:' Inactivo '},{eliminado:true},null])assert.equal(ctx.productoEstaActivo(p),false);
 for(const p of [{},{activo:true},{estado:'activo'}])assert.equal(ctx.productoEstaActivo(p),true);
});
test('la cola respeta la desactivación posterior a abrir el actualizador',()=>{
 const item={producto:{fbKey:'p',activo:true}};ctx.prodData={p:{fbKey:'p',activo:false}};
 assert.equal(ctx.productoActualizadorActivo(item),false);ctx.prodData.p.activo=true;assert.equal(ctx.productoActualizadorActivo(item),true);
});
test('ruta V3 recibe solo activos y cada bloque revalida su estado',()=>{
 assert.match(src,/Object.values\(prodData \|\| \{\}\).filter\(productoEstaActivo\), proveedoresData/);
 assert.match(src,/grupo.slice\(inicio, inicio \+ ACTUALIZADOR_TAMANIO_BLOQUE\).filter\(productoActualizadorActivo\)/);
});
