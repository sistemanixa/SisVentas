const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('vm');
const source=require('./helpers/active-app').readActiveApp().source;
const {merge}=require('../js/core/guarded-writes');
function load(c,name){let a=source.indexOf('function '+name+'(');if(source.slice(a-6,a)==='async ')a-=6;let b=source.indexOf('\nfunction ',a+20);const asyncEnd=source.indexOf('\nasync function ',a+20);if(asyncEnd>=0&&asyncEnd<b)b=asyncEnd;vm.runInContext(source.slice(a,b),c);}
test('confirmación propia no causa conflicto; otra edición de proveedor sigue protegida',async()=>{
 const original={proveedores:[{url:'https://local/p',precio:10}]};let current=structuredClone(original);
 const c={_productoEditorBase:structuredClone(original),editingProdId:'p',prodProveedoresActuales:[{url:'https://local/p',precio:12}],prodData:{},currentUser:'Prueba',FB_PATHS:{productos:'productos'},urlsProveedorEquivalentes:(a,b)=>a===b,window:{fbDB:{},fbRef:(_,p)=>p,fbUpdate:async(_,change)=>Object.assign(current.proveedores[0],change)}};
 vm.createContext(c);load(c,'persistirConfirmacionIdentidadProveedor');await c.persistirConfirmacionIdentidadProveedor(0);
 const changes={proveedores:c.prodProveedoresActuales};assert.equal(merge(current,c._productoEditorBase,changes).proveedores[0].precio,12);
 current.proveedores[0].precio=15;assert.equal(merge(current,c._productoEditorBase,changes),undefined);
});
test('cotizar referencia local conserva exento; la URL principal puede actualizar IVA',()=>{
 for(const favorite of [false,true]){
 const iva={value:'0'};const pv={url:'https://local/p',precio:10};
 const c={document:{getElementById:id=>id==='pf-iva'?iva:null},prodProveedoresActuales:[pv],parsePrecioProveedorARS:Number,datosVariacionBloqueadaResultado:()=>({}),evaluarIdentidadCotizacionProveedor:()=>({requiereConfirmacion:false}),urlsProveedorEquivalentes:(a,b)=>a===b,resultadoCotizacionUsaUrlExacta:()=>true,proveedorProductoEsFavorito:()=>favorite,fichaProveedorFavorito:()=>({}),completarReferenciaProveedorProducto:p=>p,identidadProveedorConfirmadaParaUrl:()=>true,escapeHTML:s=>s,renderTablaProveedoresProducto(){},recalcularCompraDesdeProveedores(){},calcMargen(){},notify(){},window:{tienePermiso:()=>false}};
 vm.createContext(c);load(c,'esProveedorReferenciaValor');load(c,'procesarResultadoCotizacionProveedores');
 c.procesarResultadoCotizacionProveedores({resultados:[{url:pv.url,precio:12,ivaAlicuota:21,identidad:{ok:true}}]},[{idx:0,url:pv.url}],null);
 assert.equal(iva.value,favorite?'21':'0');assert.equal(c.prodProveedoresActuales[0].ivaAlicuota,21);
 }
});

test('proveedor de referencia incorporado al sistema, primero y sin duplicar',()=>{
 const c={window:{}};vm.createContext(c);load(c,'proveedoresConReferenciaDeValor');
 const blank=c.proveedoresConReferenciaDeValor([]);assert.equal(blank.length,1);assert.equal(blank[0].nombre,'REFERENCIA DE VALOR');
 const again=c.proveedoresConReferenciaDeValor([...blank,{fbKey:'flytec',nombre:'FLYTEC'}]);assert.equal(again.length,2);assert.equal(again[0].pais,'Argentina');
 load(c,'origenProveedorProducto');assert.equal(c.origenProveedorProducto({proveedorKey:'referencia-de-valor',url:'https://flytec.com.py/p'}).exterior,false);
});

test('actualizador omite referencia incluso con URL heredada y no la envía al cotizador',async()=>{
 const ref={nombre:'REFERENCIA DE VALOR',proveedorKey:'referencia-de-valor',url:'https://flytec.com.py/p',urlProducto:true,precio:606264};
 const real={nombre:'FLYTEC PARAGUAY',proveedorKey:'flytec'};
 const c={window:{},productosProveedoresV3Invocar:()=>[{proveedor:ref},{proveedor:real}],prodData:{},proveedoresData:[],productoEstaActivo:()=>true,precioVigenciaMs:()=>1,enlacesProveedoresAutomaticos:()=>[],SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://test'},fetch(){throw Error('No debe consultar');}};
 vm.createContext(c);for(const n of ['esProveedorReferenciaValor','itemProveedorAutomatico','productosBiosegurActualizables','cotizarProveedoresCloudRun','validarResultadoActualizadorProveedor'])load(c,n);
 assert.equal(c.productosBiosegurActualizables().length,1);assert.equal(c.productosBiosegurActualizables()[0].proveedor,real);
 assert.equal(await c.cotizarProveedoresCloudRun([ref],'P','Producto'),null);
 assert.equal(c.validarResultadoActualizadorProveedor({proveedor:ref},{},{}).ok,false);
 assert.equal(ref.precio,606264);
});
