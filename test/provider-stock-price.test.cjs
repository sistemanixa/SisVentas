const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function setup(){return load({Date,URL,window:{},prodData:{},notify:()=>{},
 proveedoresVinculadosProducto:p=>p.proveedores||[],urlFavoritaProducto:p=>p.codWeb,
 datosVariacionBloqueadaResultado:r=>({requiereAprobacion:!!r.bloqueado}),
 urlsProveedorEquivalentes:(a,b)=>!!a&&a===b,itemProveedorAutomatico:()=>true,
 parsePrecioProveedorARS:x=>Number(x)||0,_costoProveedorProductoSinAuditar:(p,pv)=>pv.precio||0,
 precioGremioARSDesdeProducto:p=>p.compra||0,precioVentaCanonicoProducto:p=>({precioARS:p.venta||0}),
 factorIvaProveedorProducto:()=>1,costoEnvioProveedorProducto:()=>0,svFechaLocalISO:()=> '2026-10-10',
 costoUnitarioProveedorProducto:(p,pv)=>pv.precio,margenProductoDefault:()=>30,
 obtenerDolarReferenciaProducto:()=>({valor:1535,tipo:'oficial'}),fichaProveedorFavorito:()=>({}),
 _relacionCercanaProducto:()=>false
},['proveedorProductoEsFavorito','validarResultadoActualizadorProveedor','precioSinStockVerificado','datosActualizadosProductoBiosegur','avisoStockProveedorFavorito','advertirStockProveedorFavorito']);}
function fixture(){const url='https://proveedor.test/producto';const p={codigo:'P-62902',codWeb:url,stock:5,compra:4850,proveedores:[{nombre:'FREE ELECTRON',url,precio:4850,actualizadoEn:123}]};return {producto:p,proveedor:p.proveedores[0],proveedorIdx:0,url};}
const result=()=>({precio:5148.25,moneda:'ARS',sinIva:false,identidad:{ok:true},url:'https://proveedor.test/producto',disponibilidadProveedor:'sin_stock',disponibilidadProveedorTexto:'Sin stock'});
test('precio verificado sin stock actualiza costo favorito y conserva disponibilidad y stock propio',()=>{const c=setup(),item=fixture(),r=c.datosActualizadosProductoBiosegur(item,result());assert.equal(r.proveedores[0].precio,5148.25);assert.equal(r.compraARS,5148.25);assert.equal(r.proveedores[0].disponibilidadProveedor,'sin_stock');assert.ok(r.proveedores[0].actualizadoEn>123);assert.equal(r.stock,undefined);assert.equal(item.producto.stock,5);assert.equal(item.proveedor.precio,4850);});
test('sin precio válido, identidad, URL o aprobación conserva el costo anterior',()=>{for(const change of [{precio:0},{precio:Infinity},{identidad:{ok:false}},{url:'https://otro.test'},{precio:99999},{bloqueado:true}]){const c=setup(),item=fixture(),r=c.datosActualizadosProductoBiosegur(item,{...result(),...change});assert.equal(r.proveedores[0].precio,4850);assert.equal(r.proveedores[0].actualizadoEn,123);assert.equal(r.compraARS,undefined);assert.equal(r.proveedores[0].disponibilidadProveedor,'sin_stock');}});
test('alternativo sin stock actualiza su precio sin sustituir costo favorito',()=>{const c=setup(),item=fixture();item.producto.codWeb='https://favorito.test';const r=c.datosActualizadosProductoBiosegur(item,result());assert.equal(r.proveedores[0].precio,5148.25);assert.equal(r.compraARS,undefined);});
test('advertencia solo del favorito, independiente del stock propio y sin bloquear',()=>{const c=setup(),item=fixture(),p=item.producto;let messages=[];c.notify=m=>messages.push(m);assert.equal(c.advertirStockProveedorFavorito(p),false);p.proveedores.push({url:'https://alternativo.test',disponibilidadProveedor:'sin_stock'});assert.equal(c.advertirStockProveedorFavorito(p),false);p.proveedores[0].disponibilidadProveedor='sin_stock';assert.equal(c.advertirStockProveedorFavorito(p),true);assert.match(messages[0],/P-62902.*FREE ELECTRON/);assert.equal(p.stock,5);p.fbKey='abc';c.prodData={abc:p};assert.equal(c.advertirStockProveedorFavorito('abc'),true);});
