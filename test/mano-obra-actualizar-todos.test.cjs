const {test}=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
function setup(permission=true){
 const remote={a:{fbKey:'a',mo:true,compra:45000,venta:99000,iva:21,tcGuardado:1540,ventaUSD:64.29},b:{fbKey:'b',mo:true,compra:0,venta:0},c:{fbKey:'c',mo:true,activo:false},d:{fbKey:'d',mo:false},e:{fbKey:'e',mo:true,vigente:true}};
 const c={prodData:structuredClone(remote),console:{warn(){}},FB_PATHS:{productos:'productos'},esProductoManoDeObra:p=>p.mo,productoEstaActivo:p=>p.activo!==false,estadoVigenciaPrecioProducto:p=>({vigente:p.vigente||!!p.precioActualizadoEn}),window:{tienePermiso:()=>permission,fbRef:(_,p)=>p,fbRunTransaction:async(path,fn)=>{const id=path.split('/').pop();if(id==='fail')throw Error('offline');const next=fn(remote[id]);if(!next)return {committed:false};remote[id]=next;return {committed:true,snapshot:{val:()=>next}};}}};
 load(c,['confirmarVigenciaManoObra']);return {c,remote};
}
test('renueva solo vigencia de mano de obra pendiente conservando todos los importes',async()=>{
 const {c,remote}=setup(),original=structuredClone(remote.a);
 const r=await c.confirmarVigenciaManoObra(['a','b','c','d','e','missing']);
 assert.equal(r.actualizados,2);assert.equal(r.omitidos,4);assert.equal(r.fallidos,0);
 const {precioActualizadoEn,precioActualizadoOrigen,...rest}=remote.a;
 assert.deepEqual(rest,original);assert.ok(precioActualizadoEn>0);assert.equal(precioActualizadoOrigen,'revision_mano_obra');
 assert.equal(remote.b.venta,0);assert.equal(c.prodData.a.precioActualizadoEn,precioActualizadoEn);
});
test('informa fallos parciales y reintentar no vuelve a renovar los ya revisados',async()=>{
 const {c,remote}=setup();const r=await c.confirmarVigenciaManoObra(['a','fail']);
 assert.equal(r.actualizados,1);assert.equal(r.fallidos,1);const fecha=remote.a.precioActualizadoEn;
 const retry=await c.confirmarVigenciaManoObra(['a']);assert.equal(retry.omitidos,1);assert.equal(remote.a.precioActualizadoEn,fecha);
});
test('sin permiso no guarda',async()=>{
 const {c,remote}=setup(false);await assert.rejects(c.confirmarVigenciaManoObra(['a']),/Sin permiso/);assert.equal(remote.a.precioActualizadoEn,undefined);
});
