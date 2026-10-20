'use strict';
function createLaborRuntime({db,databaseURL,accessToken,enabled=false,readOnly=false,fetchImpl}){
 if(readOnly&&!enabled)throw Error('El modo de revisión requiere conservar el circuito acotado');
 const store=require('./labor-rtdb-store').createLaborRtdbStore({databaseURL,accessToken,fetchImpl});
 const guard=require('./labor-guard').createLaborGuard({store,readOnly});
 const scopedDb=enabled?require('./labor-db').createLaborDb({db,guard}):db;
 const transaction=enabled?require('./labor-scoped-transaction').createScopedTransaction({guard}):require('./labor-transaction').createRootTransaction({databaseURL,accessToken,fetchImpl});
 function run(actor,operation,input,work,{system=false}={}){
  if(!enabled)return work();
  if(!system&&(!actor?.uid||actor.viewing))throw Object.assign(Error('Volvé a tu cuenta para guardar'),{statusCode:403});
  return guard.run({uid:system?'sv-labor-service':actor.realUid||actor.uid,claims:actor?.claims,role:actor?.role,permissionRevision:actor?.permissionRevision,permissionDigest:actor?.permissionDigest,mode:system?'server':'command',operation,input},work);
 }
 return {db:scopedDb,store,guard,transaction,run};
}
module.exports={createLaborRuntime};
