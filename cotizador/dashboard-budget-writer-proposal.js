'use strict';
// Inject only at the reviewed cut. No independent persistence, receipt or lock.
const Index=require('./dashboard-budget-incremental-plan-proposal'),Headers=require('./dashboard-budget-read-view-augment-proposal'),Model=require('./dashboard-budget-projection-proposal');
const roots=['sisventas/presupuestos','sv_usuarios','sv_chat_roles','sv_permisos'];
const affects=path=>roots.some(root=>path===root||path.startsWith(root+'/')||root.startsWith(path+'/'));
function create({enabled=false,allowPolicyRenewal=false}={}){
 if(typeof enabled!=='boolean'||typeof allowPolicyRenewal!=='boolean')throw Error('Explicit dashboard writer configuration required');
 async function augment({patch,raw,get,beforeCommit}){
  if(!enabled||!Object.keys(patch).some(affects))return;
  const coverage=await raw(Index.ROOT+'/coverage');
  const planned=await Index.plan({patch,raw,get,beforeCommit,generation:coverage?.generation,revision:coverage?.revision,projectRecord:Model.projectRecord,allowPolicyRenewal});
  const result=await Headers.augment({enabled:true,planned,raw,get,beforeCommit});
  Object.assign(patch,result.patch);
 }
 return Object.freeze({enabled,augment,affects});
}
module.exports={create,affects};
