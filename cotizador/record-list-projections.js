'use strict';
const Model=require('./record-list-model');
async function augment({patch,raw,get,enabled=false,actor,result,operationId}){
 if(!enabled)return;
 const paths=Object.keys(patch),records=new Set(paths.map(Model.recordPath).filter(Boolean)),broad=paths.some(path=>Model.domains.some(domain=>path==='sisventas/'+domain||('sisventas/'+domain).startsWith(path+'/')));
 if(!records.size&&!broad)return;
 const configuration=await raw('sv_record_list_config');if(configuration?.ready!==true||configuration.schema!==1)return;
 if(broad)throw Object.assign(Error('Este guardado debe identificar los registros que modifica.'),{statusCode:409,code:'SV_SCOPED_LIST_WRITE_REQUIRED'});
 for(const record of records){
  const before=await raw(record),after=await get(record),delta=Model.plan(record,before,after,operationId);
  for(const path of Object.keys(patch))if(path===record||path.startsWith(record+'/'))delete patch[path];
  Object.assign(patch,delta);
  if(actor?.input?.kind==='compare'&&actor.input.path===record&&result){result.listRevision=delta[record]?.[Model.revision]??null;result.listOperation=operationId;}
 }
}
module.exports={augment};
