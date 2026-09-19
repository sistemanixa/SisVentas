const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const src=require('./helpers/active-app').readActiveApp().source;
function extract(n){const a=src.indexOf('function '+n+'('),b=src.indexOf('\n}',a)+2;return (src.slice(a-6,a)==='async '?'async ':'')+src.slice(a,b);}
test('identidad mantiene importe y fila; sólo aprobación posterior aplica precio',async()=>{
 const pv={url:'https://proveedor/item',proveedorKey:'prov',precio:100},p={fbKey:'p',proveedores:[pv]},item={producto:p,proveedor:pv,proveedorKey:'prov',proveedorIdx:0,url:pv.url};
 const fallo={fbKey:'p',proveedorIdx:0,item,requiereConfirmacionIdentidad:true,precioCandidatoArs:600,resultadoCotizador:{codigo:'PRICE_VARIATION_REQUIRES_APPROVAL',precioAnteriorArs:100,precioCandidatoArs:600}};
 let saves=0;
 const c={window:{tienePermiso:()=>true,fbDB:{},fbRef:(_,p)=>p,fbUpdate:async()=>{}},FB_PATHS:{productos:'productos'},prodData:[p],currentUser:'Test',currentUserEmail:'',document:{getElementById:()=>null},_actualizadorSesionPrecios:{fallos:[fallo]},notify:()=>{},actualizadorMarcarProductoVerificando:()=>{},urlsProveedorEquivalentes:(a,b)=>a===b,parsePrecioProveedorARS:Number,validarResultadoActualizadorProveedor:()=>({ok:false,requiereAprobacionVariacion:true}),svConfirm:async()=>true,actualizadorFormatoARS:String,datosActualizadosProductoBiosegur:()=>({compraARS:600}),guardarCandidatosSegurosActualizador:async()=>{saves++;return true;}};
 vm.createContext(c);for(const n of ['resultadoManualMercadoLibreActualizador','datosVariacionBloqueadaResultado','confirmarIdentidadMercadoLibreActualizador','aprobarVariacionPrecioActualizador'])vm.runInContext(extract(n),c);
 await c.aprobarVariacionPrecioActualizador('p',0);assert.equal(saves,0);assert.equal(c._actualizadorSesionPrecios.fallos.length,1);
 await c.confirmarIdentidadMercadoLibreActualizador('p',0);
 assert.equal(pv.precio,100);assert.equal(saves,0);assert.equal(fallo.requiereConfirmacionIdentidad,false);assert.equal(c._actualizadorSesionPrecios.fallos.length,1);assert.equal(pv.identidadConfirmadaManualmente,true);assert.equal(fallo.resultadoCotizador.aprobarVariacionManual,false);
 await c.aprobarVariacionPrecioActualizador('p',0);assert.equal(saves,1);assert.equal(c._actualizadorSesionPrecios.fallos.length,0);
});
