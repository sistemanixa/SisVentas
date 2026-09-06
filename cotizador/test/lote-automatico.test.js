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
