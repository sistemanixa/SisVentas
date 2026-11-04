'use strict';
const Index=require('./dashboard-budget-incremental-plan-proposal'),Activity=require('./dashboard-budget-activity-codec-proposal');
const {digest}=require('./labor-guard'),{normalizeRtdb}=require('./payment-membership-index');
function buildActivitySnapshot({model,records,timeZone,sourceLocale}={}){
 const zone=Activity.canonicalZone(timeZone);
 Activity.check(typeof sourceLocale==='string'&&sourceLocale.length>0,'Explicit legacy browser locale required');
 const locale=Intl.getCanonicalLocales(sourceLocale)[0];Activity.check(sourceLocale===locale,'Canonical legacy browser locale required');
 const built=Index.bootstrap({model,records}),tree=built.patch[Index.ROOT];tree.document={};
 for(const [key,record]of Object.entries(tree.sources))record.activity=Activity.point({key,original:records[key],ownerUid:record.ownerUid,offsetMinutes:model.offsetMinutes,timeZone:zone});
 for(const [scope,stats]of Object.entries(tree.stats)){
  const rows=Object.values(tree.sources).filter(record=>scope==='all'||record.ownerUid===scope.slice(2));let eligible=0;
  for(const record of rows){
   const event=Activity.eventRow(record,scope);if(event){(tree.document[scope]??={})[event.sort]=event;eligible++;}
  }
  stats.eventEligible=eligible;stats.eventExcluded=stats.records-eligible;tree.scopeProof[scope]=digest(normalizeRtdb(stats));
 }
 Object.assign(tree.coverage,{documentOrder:Activity.ORDER,activitySchema:Activity.SCHEMA,activityReady:true,requiresActivityReconciliation:false,activityTimeZone:zone,activitySourceLocale:locale});
 return {...built,activitySchema:Activity.SCHEMA,tieOrder:'original stable key encoded as UTF16 hex; deliberately replaces legacy source ranks'};
}
module.exports={buildActivitySnapshot};
