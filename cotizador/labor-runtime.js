'use strict';
function createLaborRuntime({db,databaseURL,accessToken,enabled=false,readOnly=false,fetchImpl,commercialProtocol=false}){
 if(readOnly&&!enabled)throw Error('El modo de revisión requiere conservar el circuito acotado');
 const store=require('./labor-rtdb-store').createLaborRtdbStore({databaseURL,accessToken,fetchImpl});
 const guard=require('./labor-guard').createLaborGuard({store,readOnly});
 const scopedDb=enabled?require('./labor-db').createLaborDb({db,guard}):db;
 const transaction=enabled?require('./labor-scoped-transaction').createScopedTransaction({guard}):require('./labor-transaction').createRootTransaction({databaseURL,accessToken,fetchImpl});
 function run(actor,operation,input,work,{system=false}={}){
  if(!enabled)return work();
  if(!system&&(!actor?.uid||actor.viewing))throw Object.assign(Error('Volvé a tu cuenta para guardar'),{statusCode:403});
  const commercial=!system&&(actor.domain==='ventas'||commercialProtocol===true&&actor.domain==='presupuestos')&&['commercial-prepare','commercial-assign'].includes(operation),uid=system?'sv-labor-service':actor.realUid||actor.uid;
  if(commercial&&(actor.uid!==uid||actor.claims?.uid!==uid||!['ventas','presupuestos'].includes(actor.domain)))throw Object.assign(Error('La sesión comercial no coincide con el usuario autenticado'),{statusCode:403});
  const context={uid,claims:actor?.claims,role:actor?.role,permissionRevision:actor?.permissionRevision,permissionDigest:actor?.permissionDigest,mode:system?'server':commercial?'user':'command',operation,input,...(commercial?{commercialContext:true,domain:actor.domain}:{})};
  let commercialResult;const pending=guard.run(context,commercial?async scope=>{
   if(commercialProtocol===true&&!require('./commercial-view-protocol').active(await scope.get('sv_labor_config')))throw Object.assign(Error('El circuito comercial protegido todavía no está habilitado.'),{statusCode:503,code:'SV_COMMERCIAL_PROTOCOL_OFF'});
   const checked=await Promise.allSettled([scope.get('sv_chat_roles/'+uid),scope.get('sv_permisos/'+actor.role)]),failed=checked.find(result=>result.status==='rejected');if(failed)throw failed.reason;
   require('./commercial-ownership').validateCommercialActor(context,checked[0].value,checked[1].value);commercialResult=await work();return {ok:true,committed:true};
  }:work);
  return commercial?pending.then(()=>commercialResult):pending;
 }
 return {db:scopedDb,store,guard,transaction,run};
}
module.exports={createLaborRuntime};
