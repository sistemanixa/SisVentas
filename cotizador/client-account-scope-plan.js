'use strict';
const P=require('./client-account-projection'),M=require('./commercial-pages-model');
const plans=new WeakMap(),fail=(statusCode,message)=>Object.assign(Error(message),{statusCode}),incomplete=()=>Object.assign(fail(409,'No se pudo verificar esta cuenta. Un administrador debe revisar su habilitación.'),{code:'SV_CLIENT_ACCOUNTS_INCOMPLETE'});
function validScope(coverage,totals,generation){return coverage?.schema===1&&coverage.ready===true&&coverage.generation===generation&&Number.isSafeInteger(coverage.revision)&&coverage.revision>0&&totals?.schema===1&&totals.generation===generation&&totals.revision===coverage.revision&&['salesRecords','paymentRecords'].every(k=>Number.isSafeInteger(coverage[k])&&coverage[k]>=0&&coverage[k]===totals[k])&&['accounts','debtors','totalCents','paidCents','balanceCents'].every(k=>Number.isSafeInteger(totals[k])&&totals[k]>=0)&&totals.totalCents-totals.paidCents===totals.balanceCents;}
// Only actors sealed inside create().execute reach this augmentation. A request
// cannot select a UID or stage arbitrary technical paths through scope.update.
async function augment({actor,patch,raw}){
 const plan=plans.get(actor);if(!plan){if(actor.operation==='client-account-scope')throw fail(403,'Preparación no autorizada.');return;}
 if(Object.keys(patch).length)throw fail(403,'La preparación no admite otras operaciones.');
 const cfg=await raw('sv_client_accounts_config');if(cfg?.schema!==1||cfg.ready!==true||cfg.scopeBootstrapVersion!==1||cfg.generation!==plan.generation)throw incomplete();
 const coverage=await raw(P.ROOT+'/coverage/u_'+actor.uid),totals=await raw(P.ROOT+'/totals/u_'+actor.uid);
 if(coverage||totals){if(!validScope(coverage,totals,plan.generation))throw incomplete();return;}
 const cc=await raw('sv_commercial_pages_config'),commercial=await raw(M.ROOT+'/coverage'),global=await raw(P.ROOT+'/coverage/all');
 if(cc?.ready!==true||cc.schema!==1||cc.nativeCollectionsReady!==true||cc.nativeCollectionsSchema!==1||commercial?.ready!==true||commercial.schema!==1||commercial.generation!==cc.generation||commercial.nativeCollectionsSchema!==1||commercial.sales!==global?.salesRecords||commercial.payments!==global?.paymentRecords)throw incomplete();
 const scope='u_'+actor.uid,meta=await raw(M.ROOT+'/totals/'+scope);if(meta){M.validateMeta(meta);if(meta.generation!==commercial.generation||['sales','payments','activeSales','activePayments','debtCents','debtorCount'].some(k=>meta[k]!==0)||Object.keys(meta.days||{}).length)throw incomplete();}
 const prepared=await P.prepareEmptyScope({uid:actor.uid,aliases:plan.aliases,generation:plan.generation,read:raw});
 Object.assign(patch,prepared);if(!meta)patch[M.ROOT+'/totals/'+scope]={...M.emptyMeta(commercial.generation),revision:commercial.revision};patch[M.ROOT+'/coverage/scopes/'+scope]=true;
}

module.exports={augment,register:(actor,plan)=>plans.set(actor,Object.freeze({generation:plan.generation,aliases:Object.freeze([...plan.aliases])})),release:actor=>plans.delete(actor)};
