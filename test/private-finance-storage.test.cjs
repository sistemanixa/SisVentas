'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{createPrivateDocuments}=require('../cotizador/private-finance-storage');
const path='owner-fixture/'+('a'.repeat(64))+'.pdf';
test('un bucket compartido/default y una referencia fuera del espacio son rechazados antes de acceder a objetos',async()=>{let calls=0;const storage=()=>{calls++;throw Error('No debe acceder');};for(const bucketName of ['nixa-sisventas.appspot.com','other.firebasestorage.app','gs://private-bucket'])await assert.rejects(createPrivateDocuments({storage,bucketName}).get(path),e=>e.statusCode===503);await assert.rejects(createPrivateDocuments({storage,bucketName:'private-fixture'}).get('../outside.pdf'),e=>e.statusCode===503);assert.equal(calls,0);assert.equal(createPrivateDocuments({storage,bucketName:''}),null);});
test('sin prevención pública o acceso uniforme el almacenamiento permanece cerrado',async()=>{let writes=0;for(const iamConfiguration of [{},{publicAccessPrevention:'enforced'},{publicAccessPrevention:'inherited',uniformBucketLevelAccess:{enabled:true}}]){const d=createPrivateDocuments({bucketName:'private-fixture',storage:()=>({bucket:()=>({getMetadata:async()=>[{iamConfiguration}],file:()=>{writes++;}})})});await assert.rejects(d.put(path,Buffer.from('Ficticio')),e=>e.statusCode===503);}assert.equal(writes,0);});
test('almacenamiento privado exige metadata segura, no sobrescribe y no publica URLs',async()=>{
 const bytes=Buffer.from('Ficticio');let attempts=0,config;
 const storage=()=>({bucket(name){
  assert.equal(name,'private-fixture');
  return {
   getMetadata:async()=>[{iamConfiguration:{publicAccessPrevention:'enforced',uniformBucketLevelAccess:{enabled:true}}}],
   file(p){assert.equal(p,path);return {
    save:async(_b,c)=>{config=c;if(attempts++)throw Object.assign(Error('Ya existe'),{code:412});},
    download:async()=>[bytes]
   };}
  };
 }});
 const d=createPrivateDocuments({bucketName:'private-fixture',storage});await d.put(path,bytes);await d.put(path,bytes);
 assert.equal(config.preconditionOpts.ifGenerationMatch,0);assert.equal(config.metadata.cacheControl,'private, no-store');assert.deepEqual(await d.get(path),bytes);assert.equal(d.getSignedUrl,undefined);
});
