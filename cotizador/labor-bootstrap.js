'use strict';
const Index=require('./labor-index'),{digest}=require('./labor-guard');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
// Inicialización única de referencias derivadas, después de retirar escritores
// antiguos. No migra, copia ni recalcula ningún registro financiero.
function createLaborBootstrap({guard,maxIndexBytes=8*1024*1024}){
 return async function bootstrap(){
  return guard.run({uid:'sv-labor-service',mode:'bootstrap',operation:'prepare-labor-indexes'},async scope=>{
   const config=await scope.get('sv_labor_config');if(config!==null)throw fail(409,'Ya existe configuración laboral; revisar antes de modificar');
   const previous=await scope.get(Index.INDEX_ROOT);if(previous!==null)throw fail(409,'Ya hay índices laborales; revisar la preparación anterior');
   const result=await Promise.allSettled(['gastos','hsextra_solicitudes'].map(async domain=>[domain,await scope.get('sisventas/'+domain)]));
   const error=result.find(item=>item.status==='rejected');if(error)throw error.reason;
   const source=Object.fromEntries(result.map(item=>item.value)),patch=Index.buildIndex(source);
   if(Buffer.byteLength(JSON.stringify(patch))>maxIndexBytes)throw fail(413,'El índice requiere una preparación específica por tamaño');
   patch.sv_labor_config={schema:Index.VERSION,ready:true};await scope.update(patch);
   return {ready:true,schema:Index.VERSION,source:Object.fromEntries(Object.entries(source).map(([domain,rows])=>[domain,{records:Object.keys(rows||{}).length,digest:digest(rows)}])),indexLeaves:Object.keys(patch).length-1,indexBytes:Buffer.byteLength(JSON.stringify(patch))};
  });
 };
}
module.exports={createLaborBootstrap};
