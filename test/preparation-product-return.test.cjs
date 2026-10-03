const {test}=require('node:test'),assert=require('node:assert/strict');
const {providerLink}=require('../js/modules/exterior-preparation');
const {load}=require('./helpers/app-functions.cjs');
test('enlace externo distingue web del producto de la página general',()=>{
 const row={productKey:'P',providerKey:'S',method:'local'},masters=[{proveedorKey:'S',web:'https://example.com/'}];
 assert.equal(providerLink(row,[{key:'P',providers:[{proveedorKey:'S',url:'https://example.com/item'}]}],masters).label,'Web del producto');
 assert.equal(providerLink(row,[],masters).label,'Web del proveedor');
});
test('volver desde ficha retorna a la preparación antes de navegar al listado',()=>{
 let returned=0;const c={_proveedoresEnFicha:false,window:{SVExteriorPreparation:{returnFromProduct(){returned++;return true;}}}};
 load(c,['cerrarDetalleProducto']);c.cerrarDetalleProducto();assert.equal(returned,1);
});
test('guardar o descartar edición retorna a preparación respetando confirmación',async()=>{
 let returned=0,allowed=false;const c={_cotizacionProductoActiva:false,_proveedoresEnFicha:false,_pfFirmaNavegacion:'original',firmaNavegacionEditorProducto:()=> 'editado',svConfirm:async()=>allowed,cancelarCotizacionProductoEditor(){},window:{SVExteriorPreparation:{returnFromProduct(){returned++;return true;}}}};
 load(c,['cerrarFormProducto']);await c.cerrarFormProducto();assert.equal(returned,0);
 allowed=true;await c.cerrarFormProducto();assert.equal(returned,1);
 await c.cerrarFormProducto(true);assert.equal(returned,2);
});
