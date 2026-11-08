'use strict';
const Evidence=require('./commercial-cut-evidence.cjs');
function prepare({manifest,activationId,operationalGeneration}={}){
 const validated=Evidence.validate(manifest);
 for(const value of [activationId,operationalGeneration])if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>160)throw Error('Falta la identidad revisada del corte.');
 const projections={};
 for(const name of Evidence.PROJECTIONS){
  const rows=manifest.operations.map(operation=>operation.projections.find(row=>row.name===name));
  if(rows.some(row=>row.schema!==rows[0].schema||row.generation!==rows[0].generation||row.revision!==rows[0].revision))throw Error('Las operaciones no comparten la misma cobertura revisada.');
  projections[name]={schema:1,generation:rows[0].generation,minimumRevision:rows[0].revision};
 }
 return {pins:{schema:1,...manifest.candidate,manifestSha256:validated.manifestSha256,activationId,operationalGeneration,projections},scope:validated.scope,remoteVerified:false,activationAuthorized:false};
}
module.exports={prepare};
