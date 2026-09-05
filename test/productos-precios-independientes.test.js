const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=require('./helpers/active-app').readActiveApp().source;
function entorno(){
 const valores={'pf-codigo':'P-61893','pf-nombre':'Cámara','pf-margen-deseado':'30','pf-unidad':'Unidad','pf-iva':'21','pf-compra':'84234.15','pf-venta':'109504.39','pf-precio-gremio':'84234.15','pf-moneda':'ARS'};
 const campos={};const c={window:{},document:{getElementById(id){return campos[id]||(campos[id]={value:valores[id]||'',checked:false});}},editingProdId:'P-61893',prodImagenArchivoTemp:null,prodImagenUrlActual:'',metrosPorPresentacionFormulario:()=>1,normalizarUrlProveedorProducto:x=>x,obtenerDolarReferenciaProducto:()=>({valor:1530,tipo:'oficial'}),factorIvaProveedorProducto:p=>p.sinIva?1.21:1,costoRealProveedorProducto:p=>Math.round(p.precio*(p.sinIva?1.21:1)*100)/100,proveedorProductoEsFavorito:p=>p.nombre==='BIOSEGUR',getMontoRaw:e=>Number(e.value)||0,notify:m=>{throw Error(m);},cerrarFormProducto(){},fbGuardarProducto:async datos=>{c.guardado=JSON.parse(JSON.stringify(datos));return true;},prodProveedoresActuales:[{nombre:'FREE ELECTRON',precio:75000,url:'https://free.example/producto',sinIva:false,actualizadoOrigen:'cotizador'},{nombre:'BIOSEGUR',precio:69615,url:'https://bio.example/producto',sinIva:true,actualizadoOrigen:'cotizador'}]};
 c.proveedoresData=c.prodProveedoresActuales.map(p=>({nombre:p.nombre}));vm.createContext(c);
 for(const nombre of ['completarReferenciaProveedorProducto','ordenarProveedoresComparacion','guardarProducto']){const a=source.indexOf('function '+nombre+'('),b=source.indexOf('\nfunction ',a+10);vm.runInContext((nombre==='guardarProducto'?'async ':'')+source.slice(a,b),c);}
 return c;
}
test('guardar con favorito conserva importes distintos y al comparar no copia el costo general',async()=>{
 const c=entorno();await c.guardarProducto();assert.deepEqual(c.guardado.proveedores.map(p=>p.precio),[75000,69615]);assert.equal(c.guardado.proveedor,'BIOSEGUR');
 const rows=c.ordenarProveedoresComparacion(c.guardado.proveedores);assert.deepEqual(Array.from(rows,r=>r.costo),[75000,84234.15]);assert.equal(rows[0].proveedor.nombre,'FREE ELECTRON');
 c.prodProveedoresActuales=JSON.parse(JSON.stringify(c.guardado.proveedores));await c.guardarProducto();assert.deepEqual(c.guardado.proveedores.map(p=>p.precio),[75000,69615]);
});
