const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../index.js'),'utf8');
const fn=source.slice(source.indexOf('async function cotizarLote(reqBody)'),source.indexOf('\nasync function cotizar(reqBody)'));
function contexto(estado='verificado') {
 const llamadas=[];
 const ctx={db:{ref:()=>({get:async()=>({val:()=>({nombre:'Nuevo',conexionAutomatica:{estado,firma:'actual'}})})})},tipoProveedor:()=>'',firmaAcceso:()=> 'actual',cotizar:async body=>{llamadas.push(body);if(body.url==='mala')throw new Error('Identidad incorrecta');return {ok:true,precioArs:100,medioPagoProveedor:'transferencia'};}};
 vm.runInNewContext(fn,ctx);return {ctx,llamadas};
}
test('lote automático consulta cada URL y aísla fallos sin permitir modo alta',async()=>{
 const {ctx,llamadas}=contexto();
 const r=await ctx.cotizarLote({proveedorKey:'nuevo',items:[{url:'buena',codigo:'A',altaProducto:true},{url:'mala',codigo:'B'}]});
 assert.equal(r.actualizados,1);assert.equal(r.fallidos,1);
 assert.equal(r.resultados[0].medioPagoProveedor,'transferencia');
 assert.equal(r.resultados[1].mensaje,'Identidad incorrecta');
 assert.equal(llamadas[0].altaProducto,false);assert.equal(llamadas[0].proveedorKey,'nuevo');
});
test('rechaza conexiones sin verificar y lotes fuera del límite antes de consultar',async()=>{
 const {ctx,llamadas}=contexto('pendiente');
 await assert.rejects(ctx.cotizarLote({proveedorKey:'nuevo',items:[{url:'x'}]}),/Verificá/);
 await assert.rejects(ctx.cotizarLote({proveedorKey:'nuevo',items:Array(5).fill({url:'x'})}),/1 y 4/);
 assert.equal(llamadas.length,0);
});
test('proveedores iniciales usan la misma consulta individual y conservan la confirmación enviada',async()=>{
 const {ctx,llamadas}=contexto();ctx.tipoProveedor=()=> 'biosegur';
 await ctx.cotizarLote({proveedorKey:'base',items:[{url:'buena',confirmarIdentidadManual:true}]});
 assert.equal(llamadas.length,1);assert.equal(llamadas[0].confirmarIdentidadManual,true);
});

test('dos consultas simultáneas conservan orden y aíslan errores con progreso monotónico',async()=>{
 const {ctx}=contexto();let activos=0,maximo=0;const progreso=[];
 ctx.db.ref=()=>({get:async()=>({val:()=>({nombre:'Nuevo',conexionAutomatica:{estado:'verificado',firma:'actual'}})}),update:async d=>{await new Promise(r=>setTimeout(r,1));progreso.push(d.procesados);}});
 ctx.cotizar=async body=>{activos++;maximo=Math.max(maximo,activos);await new Promise(r=>setTimeout(r,body.codigo==='A'?30:5));activos--;if(body.codigo==='B')throw Error('sin respuesta');return {ok:true,precioArs:100};};
 const r=await ctx.cotizarLote({proveedorKey:'nuevo',jobId:'prueba',offset:10,total:14,items:['A','B','C','D'].map(codigo=>({codigo,url:codigo}))});
 assert.equal(maximo,2);assert.equal(activos,0);assert.equal(r.actualizados,3);assert.equal(r.fallidos,1);
 assert.deepEqual(Array.from(r.resultados,x=>x.codigoProducto),['A','B','C','D']);
 assert.equal(progreso.at(-1),14);assert.ok(progreso.every((x,i)=>!i||x>=progreso[i-1]));
});

test('un fallo de progreso espera que terminen las consultas antes de rechazar',async()=>{
 const {ctx}=contexto();let activos=0;
 ctx.db.ref=()=>({get:async()=>({val:()=>({nombre:'Nuevo',conexionAutomatica:{estado:'verificado',firma:'actual'}})}),update:async d=>{if(d.procesados>0)throw Error('firebase desconectado');}});
 ctx.cotizar=async()=>{activos++;await new Promise(r=>setTimeout(r,10));activos--;return {ok:true,precioArs:100};};
 await assert.rejects(ctx.cotizarLote({proveedorKey:'nuevo',jobId:'prueba',items:[{codigo:'A'},{codigo:'B'}]}),/firebase desconectado/);
 assert.equal(activos,0);
});
