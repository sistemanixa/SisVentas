const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load}=require('./helpers/app-functions.cjs');
const old={fbKey:'p',stock:3,proveedores:[{nombre:'ML',url:'old',precio:10},{nombre:'Local',url:'local',precio:20}]};
const item={producto:old,proveedor:old.proveedores[0],proveedorIdx:0,url:'old'};
function ctx(p){return load({prodData:{p},proveedoresVinculadosProducto:p=>p.proveedores,datosActualizadosProductoBiosegur:(i,r)=>({compra:r.precio,proveedores:i.producto.proveedores.map((p,n)=>n===i.proveedorIdx?{...p,precio:r.precio}:p)})},['proveedorRevisionCoincide','actualizadorItemVigente','actualizadorRespuestaVigente','productoConResultadosActualizador']);}
test('bloque pendiente consulta la URL vigente, no la copia inicial',()=>{
 const p=structuredClone(old);p.proveedores[0].url='new';const c=ctx(p);
 assert.equal(c.actualizadorItemVigente(Object.freeze(item)).url,'new');
 assert.equal(c.actualizadorRespuestaVigente(item),false);
});
test('respuesta antigua no sobrescribe una URL cambiada en el servidor',()=>{
 const p=structuredClone(old);p.proveedores[0].url='new';const c=ctx(p);
 assert.equal(c.productoConResultadosActualizador(p,[{item,resultado:{precio:99}}]),undefined);
 assert.equal(p.proveedores[0].url,'new');assert.equal(p.proveedores[0].precio,10);
});
test('guardar precio conserva cambios concurrentes del producto y otro proveedor',()=>{
 const p=structuredClone(old);p.stock=8;p.proveedores[1].url='local-new';const c=ctx(p);
 const result=c.productoConResultadosActualizador(p,[{item,resultado:{precio:99}}]);
 assert.equal(result.stock,8);assert.equal(result.proveedores[1].url,'local-new');assert.equal(result.proveedores[0].precio,99);
 assert.equal(p.proveedores[0].precio,10);
});
test('reordenamiento de proveedores impide asociar el resultado a otra fila',()=>{
 const p=structuredClone(old);p.proveedores.reverse();const c=ctx(p);
 assert.equal(c.actualizadorItemVigente(item),null);
 assert.equal(c.productoConResultadosActualizador(p,[{item,resultado:{precio:99}}]),undefined);
});
test('guardado verifica nuevamente la URL en Firebase aunque la memoria siga vieja',async()=>{
 const p=structuredClone(old),c=ctx(p);let remoto=structuredClone(p),writes=0;
 remoto.proveedores[0].url='server-new';
 Object.assign(c,{console:{warn(){}},productoActualizadorActivo:()=>true,FB_PATHS:{productos:'productos'},_actualizadorSesionPrecios:{candidatos:[]},actualizadorClaveCandidato:()=> 'p:0',window:{fbRef:(_,path)=>path,fbDB:{},fbRunTransaction:async(_,fn)=>{const r=fn(remoto);if(!r)return {committed:false};writes++;remoto=r;return {committed:true,snapshot:{val:()=>r}};}}});
 load(c,['guardarCandidatosSegurosActualizador']);
 assert.equal(await c.guardarCandidatosSegurosActualizador([{item,resultado:{precio:99}}]),false);
 assert.equal(writes,0);assert.equal(remoto.proveedores[0].url,'server-new');
 remoto.proveedores[0].url='old';remoto.stock=12;
 assert.equal(await c.guardarCandidatosSegurosActualizador([{item,resultado:{precio:99}}]),true);
 assert.equal(remoto.stock,12);assert.equal(p.stock,12);assert.equal(remoto.proveedores[0].precio,99);
});
