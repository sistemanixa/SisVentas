const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('vm');
const source=require('./helpers/active-app').readActiveApp().source;
for(const failed of [false,true])test('actualización desde ficha interpreta respuesta real '+(failed?'con error':'y guarda precio'),async()=>{
 const provider={nombre:'FLYTEC PARAGUAY',url:'https://flytec.com.py/producto',precio:306460};
 const product={fbKey:'p',codigo:'P-62933',nombre:'Aspiradora',proveedores:[provider]};
 const item={producto:product,proveedor:provider,proveedorIdx:0,proveedorKey:'flytec',url:provider.url};
 const result=failed?{precio:0,error:'Proveedor no disponible'}:{precio:306460,moneda:'ARS',url:provider.url,identidad:{ok:true}};
 const status={style:{},innerHTML:''};let saved=[];let rendered=0;
 const c={_actualizacionFichaEnCurso:false,editingProdId:'p',prodData:{p:product},_prodDetalleOrigen:'lista',window:{tienePermiso:()=>true},document:{querySelectorAll:()=>[],getElementById:()=>status},productosBiosegurActualizables:()=>[item],actualizadorClaveItem:()=> 'p:0',_costoProveedorProductoSinAuditar:()=>306460,cotizarProveedoresCloudRun:async()=>({resultados:[result],observaciones:'respuesta real'}),evaluarIdentidadCotizacionProveedor:()=>({requiereConfirmacion:false}),validarResultadoActualizadorProveedor:()=>({ok:true}),urlsProveedorEquivalentes:(a,b)=>a===b,guardarCandidatosSegurosActualizador:async items=>{saved=items;return true;},datosVariacionBloqueadaResultado:()=>({}),escapeHTML:s=>s,notify(){},verProducto(){rendered++;}};
 vm.createContext(c);let a=source.indexOf('async function _svCargaOperacion_actualizarProveedoresDesdeFicha('),b=source.indexOf('\nvar _proveedoresEnFicha',a);vm.runInContext(source.slice(a,b),c);
 await c._svCargaOperacion_actualizarProveedoresDesdeFicha();
 assert.equal(saved.length,failed?0:1);assert.equal(rendered,failed?0:1);assert.equal(c._actualizacionFichaEnCurso,false);
 if(failed)assert.match(status.innerHTML,/Proveedor no disponible/);else assert.equal(saved[0].resultado,result);
});
