'use strict';
const fail=message=>Object.assign(Error(message),{statusCode:503});
function createPrivateDocuments({storage,bucketName}){
 if(!bucketName)return null;
 async function file(path){
  if(!/^[a-z0-9][a-z0-9._-]{2,220}[a-z0-9]$/.test(bucketName)||/\.(?:appspot\.com|firebasestorage\.app)$/.test(bucketName))throw fail('Configurar un bucket privado dedicado');
  if(!/^[a-zA-Z0-9_-]{1,128}\/[a-f0-9]{64}\.pdf$/.test(path))throw fail('Referencia privada inválida');
  const bucket=storage().bucket(bucketName),[metadata]=await bucket.getMetadata();
  if(metadata.iamConfiguration?.publicAccessPrevention!=='enforced'||metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled!==true)throw fail('El bucket requiere prevención de acceso público y acceso uniforme');
  return bucket.file(path);
 }
 return {
  async put(path,bytes){const f=await file(path);try{await f.save(bytes,{resumable:false,preconditionOpts:{ifGenerationMatch:0},contentType:'application/pdf',metadata:{cacheControl:'private, no-store'}});}catch(e){if(e.code!==412)throw e;}},
  async get(path){return (await(await file(path)).download())[0];}
 };
}
module.exports={createPrivateDocuments};
