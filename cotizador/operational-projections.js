'use strict';
const Model=require('./operational-read-model');
async function augment({patch,raw,get,enabled=false,actor,result,operationId}){
 if(!enabled)return;
 const paths=Object.keys(patch),records=new Set(paths.map(Model.recordPath).filter(Boolean));
 if(!records.size)return;
 const configuration=await raw('sv_operational_read_config');if(configuration?.ready!==true||configuration.schema!==1)return;
 for(const record of records){
  const before=await raw(record),after=await get(record),delta=Model.plan(record,before,after,operationId);
  for(const path of Object.keys(patch))if(path===record||path.startsWith(record+'/'))delete patch[path];
  Object.assign(patch,delta);
  if(actor?.input?.kind==='compare'&&actor.input.path===record&&result){result.operationalRevision=delta[record]?.[Model.revision]??null;result.operationalOperation=operationId;}
 }
}
module.exports={augment};
