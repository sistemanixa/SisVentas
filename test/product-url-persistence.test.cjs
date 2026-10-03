const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
const vieja='https://www.mercadolibre.com.ar/producto/up/MLAU135438615#wid=MLA901203201';
const nueva='https://www.mercadolibre.com.ar/producto/p/MLA2113774564#wid=MLA901203201';
function contexto(){return load({URL,URLSearchParams,proveedoresData:[],normalizarUrlProveedorProducto:x=>String(x||'').trim()},['proveedoresVinculadosProducto','productoConUrlProveedorActualizada','normalizarUrlComparacionProveedor','urlsProveedorEquivalentes','sincronizarUrlGeneralProveedorProducto']);}
function producto(){return {codigo:'P-60821',codWeb:'https://www.mercadolibre.com.ar/antiguo',proveedorUrl:vieja,stock:18,proveedores:[{nombre:'MERCADO LIBRE',proveedorKey:'ml',url:vieja,precio:2386,actualizadoEn:123,identidadConfirmadaManualmente:true,identidadConfirmadaUrl:vieja}]};}
test('cambiar URL conserva costos, sincroniza alias y elimina aprobaciones de la URL anterior',()=>{
 const c=contexto(),p=producto(),r=c.productoConUrlProveedorActualizada(p,0,p.proveedores[0],nueva);
 assert.equal(r.codWeb,nueva);assert.equal(r.proveedorUrl,nueva);assert.equal(r.proveedores[0].url,nueva);
 assert.equal(r.proveedores[0].precio,2386);assert.equal(r.stock,18);assert.equal(r.proveedores[0].actualizadoEn,0);
 assert.equal(r.proveedores[0].identidadConfirmadaManualmente,undefined);assert.equal(p.proveedores[0].url,vieja);
});
test('cambio concurrente de URL o reordenamiento de proveedores aborta sin sobrescribir',()=>{
 const c=contexto(),p=producto(),esperado={...p.proveedores[0]};
 p.proveedores[0].url='https://www.mercadolibre.com.ar/otro';
 assert.equal(c.productoConUrlProveedorActualizada(p,0,esperado,nueva),undefined);
 p.proveedores[0]={...esperado,proveedorKey:'otro'};
 assert.equal(c.productoConUrlProveedorActualizada(p,0,esperado,nueva),undefined);
 assert.equal(c.productoConUrlProveedorActualizada(null,0,esperado,nueva),undefined);
});
test('varios proveedores no pisan la URL general ni datos de otro proveedor',()=>{
 const c=contexto(),p=producto();p.codWeb='https://biosegur.com.ar/otro';p.proveedores.push({nombre:'BIOSEGUR',url:p.codWeb,precio:500});
 const r=c.productoConUrlProveedorActualizada(p,0,p.proveedores[0],nueva);
 assert.equal(r.codWeb,p.codWeb);assert.deepEqual(JSON.parse(JSON.stringify(r.proveedores[1])),p.proveedores[1]);
});
test('producto heredado se materializa con nombre, precio y URL completos',()=>{
 const c=contexto(),p={codigo:'P-1',proveedor:'MERCADO LIBRE',codWeb:vieja,compra:2386};
 const r=c.productoConUrlProveedorActualizada(p,0,c.proveedoresVinculadosProducto(p)[0],nueva);
 assert.equal(r.proveedores[0].nombre,'MERCADO LIBRE');assert.equal(r.proveedores[0].precio,2386);assert.equal(r.codWeb,nueva);
});
test('guardar otra edición no repone una URL general antigua sobre el proveedor',()=>{
 const c=contexto();c._productoEditorBase={codWeb:vieja};c.document={getElementById:()=>({value:vieja})};
 c.prodProveedoresActuales=[{nombre:'MERCADO LIBRE',url:nueva}];
 c.sincronizarUrlGeneralProveedorProducto();assert.equal(c.prodProveedoresActuales[0].url,nueva);
});
test('Mercado Libre distingue publicación y variante, e ignora tracking',()=>{
 const c=contexto();
 assert.equal(c.urlsProveedorEquivalentes(nueva,nueva+'&tracking_id=otro'),true);
 assert.equal(c.urlsProveedorEquivalentes(nueva,nueva.replace('MLA901203201','MLA111111111')),false);
 assert.equal(c.urlsProveedorEquivalentes(nueva,nueva+'&searchVariation=180831368963'),false);
 assert.equal(c.urlsProveedorEquivalentes(vieja,nueva),false);
});
test('Guardar URL confirma persistencia antes de reintentar; el fallo de precio no revierte el enlace',async()=>{
 const c=contexto(),p=producto();p.fbKey='P-60821';
 let remoto=JSON.parse(JSON.stringify(p)),reintentos=0;
 const fallo={fbKey:p.fbKey,proveedorIdx:0,url:vieja,item:{producto:p,proveedor:p.proveedores[0],proveedorKey:'ml',url:vieja}};
 Object.assign(c,{prodData:{[p.fbKey]:p},FB_PATHS:{productos:'productos'},
   _actualizadorSesionPrecios:{fallos:[fallo],sinStock:[],procesados:{}},
   document:{getElementById:id=>id.startsWith('actualizador-url-input')?{value:nueva}:null},
   notify:()=>{},actualizadorMarcarProductoVerificando:()=>{},
   reintentarProductoConNombreCorregidoActualizador:async()=>{reintentos++;assert.equal(remoto.proveedores[0].url,nueva);throw new Error('ML acceso denegado');},
   window:{fbDB:{},fbRef:(_db,path)=>path,fbRunTransaction:async(_ref,fn)=>{
     const r=fn(remoto);if(!r)return {committed:false};remoto=JSON.parse(JSON.stringify(r));return {committed:true,snapshot:{val:()=>remoto}};
   }}
 });
 load(c,['guardarUrlFallidoActualizador']);await c.guardarUrlFallidoActualizador(p.fbKey,0);
 assert.equal(reintentos,1);assert.equal(remoto.codWeb,nueva);assert.equal(remoto.proveedores[0].precio,2386);
 assert.equal(c.proveedoresVinculadosProducto(remoto)[0].url,nueva);assert.equal(fallo.url,nueva);
});
