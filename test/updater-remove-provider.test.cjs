const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
const c=load({proveedoresData:[],normalizarUrlProveedorProducto:v=>v||''},['proveedoresVinculadosProducto','proveedorRevisionCoincide','productoSinProveedorRevisado']);
const provider={nombre:'A',proveedorKey:'a',url:'https://a.example/item',precio:300};
const event={id:'audit1',fecha:123,usuario:'Admin',motivo:'Sin stock'};
test('el último proveedor se elimina sin borrar el producto, stock, costo o historial',()=>{
 const p={nombre:'Producto',activo:true,stock:4,compra:300,proveedor:'A',codWeb:provider.url,proveedores:[provider]};
 const r=c.productoSinProveedorRevisado(p,0,provider,event);
 assert.equal(r.activo,false);assert.equal(r.estado,'inactivo');assert.equal(c.proveedoresVinculadosProducto(r).length,0);
 assert.equal(r.nombre,p.nombre);assert.equal(r.stock,4);assert.equal(r.compra,300);
 assert.equal(r.historialProveedores.audit1.usuario,'Admin');assert.equal(r.historialProveedores.audit1.proveedor.precio,300);
 assert.equal(r.historialProveedores.audit1.productoInactivado,true);assert.equal(p.activo,true);
});
test('con otros proveedores conserva su estado y sus vínculos',()=>{
 const other={nombre:'B',url:'https://b.example/item'};
 const p={activo:true,proveedor:'A',codWeb:provider.url,proveedores:[provider,other],historialProveedores:{old:{accion:'previa'}}};
 const r=c.productoSinProveedorRevisado(p,0,provider,event);
 assert.equal(r.activo,true);assert.equal(r.proveedores.length,1);assert.deepEqual(JSON.parse(JSON.stringify(r.proveedores[0])),other);
 assert.equal(r.historialProveedores.old.accion,'previa');assert.equal(r.historialProveedores.audit1.productoInactivado,false);
});
test('no borra otro proveedor ante reordenamiento o URL cambiada',()=>{
 assert.equal(c.productoSinProveedorRevisado({proveedores:[{...provider,url:'https://a.example/new'}]},0,provider,event),undefined);
 assert.equal(c.productoSinProveedorRevisado({proveedores:[{...provider,proveedorKey:'b'}]},0,provider,event),undefined);
 assert.equal(c.productoSinProveedorRevisado(null,0,provider,event),undefined);
});
test('proveedor heredado se elimina sin regenerarse desde alias',()=>{
 const p={proveedor:'A',codWeb:provider.url,compra:300};
 const r=c.productoSinProveedorRevisado(p,0,c.proveedoresVinculadosProducto(p)[0],event);
 assert.equal(c.proveedoresVinculadosProducto(r).length,0);assert.equal(r.activo,false);
});
test('acción completa guarda vínculo e historial atómicamente sin borrar catálogo ni inventario',async()=>{
 const product={fbKey:'P',codigo:'P-1',activo:true,stock:9,proveedores:[{...provider}]};
 let remote=JSON.parse(JSON.stringify(product)),calls=0;
 const notices=[];
 const scope={proveedoresData:[],normalizarUrlProveedorProducto:v=>v||'',prodData:{P:product},currentUser:'Admin',
  FB_PATHS:{productos:'sisventas/productos'},document:{getElementById:()=>null},notify:m=>notices.push(m),svConfirm:async()=>true,
  _actualizadorSesionPrecios:{sinStock:[{fbKey:'P',proveedorIdx:0,url:provider.url,motivo:'Sin stock',item:{proveedor:{...provider}}}],fallos:[],candidatos:[],procesados:{}},
  window:{tienePermiso:()=>true,fbDB:{},fbRef:(_,p)=>p,fbPush:()=>({key:'event'}),fbRunTransaction:async(_,fn)=>{
   calls++;remote=fn(remote);return {committed:true,snapshot:{val:()=>remote}};
  }}
 };
 load(scope,['proveedoresVinculadosProducto','proveedorRevisionCoincide','productoSinProveedorRevisado','eliminarProductoFallidoActualizador']);
 const button={disabled:false};await scope.eliminarProductoFallidoActualizador('P',button,0);
 assert.equal(calls,1);assert.equal(product.stock,9);assert.equal(product.activo,false);assert.equal(scope.prodData.P,product);
 assert.equal(remote.historialProveedores.event.usuario,'Admin');assert.equal(scope._actualizadorSesionPrecios.sinStock.length,0);
 assert.equal(button.disabled,false);assert.match(notices.at(-1),/quedó inactivo/);
});
