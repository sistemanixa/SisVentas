'use strict';
const Index=require('./dashboard-budget-incremental-plan-proposal'),Activity=require('./dashboard-budget-activity-codec-proposal');
const {digest}=require('./labor-guard'),{normalizeRtdb}=require('./payment-membership-index');
function buildActivitySnapshot({model,records,timeZone,sourceLocale,maxPairChecks=100000}={}){
 const zone=Activity.assertRuntimeZone(timeZone);
 Activity.check(typeof sourceLocale==='string'&&sourceLocale.length>0,'Explicit legacy browser locale required');
 const locale=Intl.getCanonicalLocales(sourceLocale)[0];Activity.check(sourceLocale===locale,'Canonical legacy browser locale required');
 const built=Index.bootstrap({model,records}),tree=built.patch[Index.ROOT];tree.document={};
 for(const [key,record]of Object.entries(tree.sources))record.activity=Activity.point({key,original:records[key],ownerUid:record.ownerUid,offsetMinutes:model.offsetMinutes,timeZone:zone});
 for(const [scope,stats]of Object.entries(tree.stats)){
  const rows=Activity.sourceOrder(Object.entries(records).filter(([key])=>scope==='all'||tree.sources[key].ownerUid===scope.slice(2)).map(([key,original])=>({key,original})),{maxPairChecks,sourceLocale:locale});let eligible=0;
  for(let ordinal=0;ordinal<rows.length;ordinal++){
   const record=tree.sources[rows[ordinal].key];record.activity.ranks[scope]=ordinal;
   const event=Activity.eventRow(record,scope);if(event){(tree.document[scope]??={})[event.sort]=event;eligible++;}
  }
  stats.eventEligible=eligible;stats.eventExcluded=stats.records-eligible;tree.scopeProof[scope]=digest(normalizeRtdb(stats));
 }
 Object.assign(tree.coverage,{documentOrder:Activity.ORDER,activitySchema:2,activityReady:true,requiresActivityReconciliation:false,activityTimeZone:zone,activitySourceLocale:locale});
 return {...built,activitySchema:2,sourceOrder:'actual scoped legacy loader order, certified over complete offline snapshot'};
}
module.exports={buildActivitySnapshot};
