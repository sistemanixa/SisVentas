'use strict';
// Retirado por política expresa de costos. La recuperación sigue siendo puntual.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createCommissionGeneration}=require('../cotizador/commission-generation');
test('no queda un módulo de trabajos que instale escuchas permanentes',()=>{
 assert.equal(fs.existsSync('cotizador/commission-job-events.js'),false);
 assert.doesNotMatch(fs.readFileSync('cotizador/commission-generation.js','utf8'),/watchCommissionJobs|setInterval|setTimeout/);
});
test('el contenedor no empaqueta el observador retirado',()=>{
 assert.doesNotMatch(fs.readFileSync('cotizador/Dockerfile','utf8'),/commission-job-events/);
});
test('construir generación no lee históricos ni abre conexiones',()=>{
 const service=createCommissionGeneration({db:{ref(){assert.fail('No hay acción explícita');}},commercial:{},enabled:true});
 assert.equal(service.start,undefined);
});
test('reintentar exige una referencia concreta antes de consultar',async()=>{
 const service=createCommissionGeneration({db:{ref(){assert.fail('No consultar sin clave válida');}},commercial:{},enabled:true});
 for(const key of [undefined,null,'','../otra'])await assert.rejects(service.retryPending(key),{statusCode:400});
});
test('una recuperación puntual no recorre otros trabajos ni crea temporizadores',async()=>{
 const reads=[];
 const service=createCommissionGeneration({db:{ref(path){reads.push(path);assert.equal(path,'sv_commission_generation/una');return {get:async()=>({val:()=>({estado:'completada'})})};}},commercial:{},enabled:true});
 await service.retryPending('una');assert.deepEqual(reads,['sv_commission_generation/una']);
});
