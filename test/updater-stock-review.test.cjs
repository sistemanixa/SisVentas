const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
test('sin stock se registra separado, sin duplicar producto/proveedor',()=>{
 const c={_actualizadorSesionPrecios:{fallos:[],sinStock:[]},actualizadorClaveItem:i=>i.producto.fbKey+'::'+i.proveedorIdx};load(c,['actualizadorRegistrarSinStock']);
 const item={producto:{fbKey:'P',codigo:'P-1',nombre:'Producto'},proveedor:{nombre:'Proveedor'},proveedorIdx:0,url:'https://example.com/item'};
 c.actualizadorRegistrarSinStock(item);c.actualizadorRegistrarSinStock(item);assert.equal(c._actualizadorSesionPrecios.sinStock.length,1);assert.equal(c._actualizadorSesionPrecios.fallos.length,0);assert.equal(c._actualizadorSesionPrecios.sinStock[0].item,item);
});
test('panel sin stock ofrece ficha, proveedor, cambio de URL y eliminación',()=>{
 const c={_actualizadorSesionPrecios:{verificando:{}},escapeHTML:s=>String(s??'').replace(/</g,'&lt;'),datosVariacionBloqueadaResultado:()=>({}),window:{tienePermiso:()=>true}};load(c,['actualizadorHtmlFallos']);
 const html=c.actualizadorHtmlFallos([{fbKey:'P',codigo:'P-1',producto:'Producto',proveedorIdx:0,url:'https://example.com/item',motivo:'Sin stock'}],true);
 for(const action of ['abrirProductoDesdeFalloActualizador','editarProductoFallidoActualizador','guardarUrlFallidoActualizador','eliminarProductoFallidoActualizador'])assert.ok(html.includes(action));
 assert.match(html,/Sin stock en el proveedor/);assert.doesNotMatch(html,/Requieren revisión \(conservaron/);
});
