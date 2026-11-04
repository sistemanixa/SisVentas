'use strict';
function createLaborRuntime({db,databaseURL,accessToken,enabled=false,readOnly=false,fetchImpl,operationalSummaries=false,commercialPages=process.env.COMMERCIAL_PAGES_ENABLED==='true',clientAccounts=process.env.CLIENT_ACCOUNTS_ENABLED==='true',clientHistory=process.env.CLIENT_HISTORY_ENABLED==='true'}){
 if(readOnly&&!enabled)throw Error('El modo de revisión requiere conservar el circuito acotado');
 if((clientAccounts||clientHistory)&&!enabled)throw Error('Las cuentas y el historial requieren el guardado coordinado habilitado.');
 const store=require('./labor-rtdb-store').createLaborRtdbStore({databaseURL,accessToken,fetchImpl});
 const guard=require('./labor-guard').createLaborGuard({store,readOnly,operationalSummaries,commercialPages,clientAccounts,clientHistory,saleFinancialDependencies:true});
 store.saleDeleteFinancialEvidence=require('./sale-financial-dependencies-provider').create();
 const scopedDb=enabled?require('./labor-db').createLaborDb({db,guard}):db;
 const transaction=enabled?require('./labor-scoped-transaction').createScopedTransaction({guard}):require('./labor-transaction').createRootTransaction({databaseURL,accessToken,fetchImpl});
 function run(actor,operation,input,work,{system=false}={}){
  if(!enabled)return work();
  if(!system&&(!actor?.uid||actor.viewing))throw Object.assign(Error('Volvé a tu cuenta para guardar'),{statusCode:403});
  const commercial=!system&&(actor.domain==='ventas'||clientAccounts&&actor.domain==='presupuestos')&&['commercial-prepare','commercial-assign'].includes(operation),uid=system?'sv-labor-service':actor.realUid||actor.uid;
  if(commercial&&(actor.uid!==uid||actor.claims?.uid!==uid||!['ventas','presupuestos'].includes(actor.domain)))throw Object.assign(Error('La sesión comercial no coincide con el usuario autenticado'),{statusCode:403});
  const context={uid,claims:actor?.claims,role:actor?.role,permissionRevision:actor?.permissionRevision,permissionDigest:actor?.permissionDigest,mode:system?'server':commercial?'user':'command',operation,input,...(commercial?{commercialContext:true,domain:actor.domain}:{})};
  let commercialResult;const pending=guard.run(context,commercial?async scope=>{
   const checked=await Promise.allSettled([scope.get('sv_chat_roles/'+uid),scope.get('sv_permisos/'+actor.role)]),failed=checked.find(result=>result.status==='rejected');if(failed)throw failed.reason;
   require('./commercial-ownership').validateCommercialActor(context,checked[0].value,checked[1].value);commercialResult=await work();return {ok:true,committed:true};
  }:work);
  return commercial?pending.then(()=>commercialResult):pending;
 }
 function commercialMutation(actor,method,input,work){
  if(!['ventas','presupuestos'].includes(actor?.domain)||!['assign','prepare'].includes(method))throw Object.assign(Error('Operación comercial inválida.'),{statusCode:400});
  return actor.domain==='ventas'||clientAccounts?run(actor,'commercial-'+method,input,work):work();
 }
 const capabilities=()=>Object.freeze({schema:1,coordinated:enabled===true,readOnly:readOnly===true,commercialPages:commercialPages===true,clientAccounts:enabled===true&&commercialPages===true&&clientAccounts===true,clientHistory:enabled===true&&commercialPages===true&&clientAccounts===true&&clientHistory===true,writerMode:require('./commercial-models/client-account-mode.v1').WRITER});
 return {db:scopedDb,store,guard,transaction,run,commercialMutation,capabilities};
}
module.exports={createLaborRuntime};
