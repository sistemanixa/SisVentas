'use strict';
const Shared=require('./dashboard-budget-reader-proposal'),Index=require('./dashboard-budget-incremental-plan-proposal'),Activity=require('./dashboard-budget-activity-codec-proposal'),Core=require('./commercial-models/dashboard-activity-model.v2');
const {digest}=require('./labor-guard'),{normalizeRtdb}=require('./payment-membership-index');
const ROOT=Index.ROOT,ROUTE='/commercial/dashboard/presupuestos/actividad-v2',hash=v=>digest(normalizeRtdb(v)),check=Activity.check;
const runtimeContext=()=>({timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,sourceLocale:Intl.Collator().resolvedOptions().locale});
function createActivityReader({auth,db,enabled=false,getAsOfDay,maxBadgePages=100,getLegacyContext=runtimeContext}={}){
 check(typeof getAsOfDay==='function'&&typeof getLegacyContext==='function','Missing server activity context');
 const ports=Shared.createIndexPorts(db),{fresh}=Shared.createBudgetAuthority({auth,db});
 async function read(req){
  Shared.selection(req,ROUTE);check(enabled===true,'Proposed activity reader disabled');
  const actor=await fresh(req),pin=Shared.actorPin(actor),scope=actor.role==='admin'?'all':'u_'+actor.uid,legacy=await getLegacyContext();Activity.canonicalZone(legacy.timeZone);
  const paths=[ROOT+'/coverage',ROOT+'/policy',ROOT+'/stats/'+scope,ROOT+'/scopeProof/'+scope],before=await Promise.all(paths.map(p=>ports.raw(p))),[coverage,policy,stats,proof]=before;
  check(coverage?.ready===true&&coverage.activityReady===true&&coverage.activitySchema===Activity.SCHEMA&&coverage.documentOrder===Activity.ORDER&&coverage.activityTimeZone===Activity.canonicalZone(legacy.timeZone)&&coverage.activitySourceLocale===legacy.sourceLocale&&policy?.hash===coverage.policyHash&&stats?.generation===coverage.generation&&stats?.revision<=coverage.revision&&proof===hash(stats),'Activity metadata incomplete or stale');
  check(Number.isSafeInteger(stats.eventEligible)&&stats.eventEligible>=0&&Number.isSafeInteger(stats.eventExcluded)&&stats.eventExcluded>=0&&stats.eventEligible+stats.eventExcluded===stats.records,'Activity counts uncertified');
  const authorize=async()=>{check(digest(Shared.actorPin(await fresh(req)))===digest(pin),'Activity actor or permissions changed');return {scope,policyHash:policy.hash};};
  const [badge,children]=await Promise.all([Index.badgeCounts({...ports,authorize,asOfDay:await getAsOfDay(),maxPages:maxBadgePages,pageSize:50}),ports.query({path:ROOT+'/document/'+scope,orderBy:'key',limit:5})]);
  check(children.length===Math.min(5,stats.eventEligible)&&badge.generation===coverage.generation&&badge.revision===coverage.revision,'Activity prefix incomplete');
  const rows=children.map(({sort,value})=>{const row={...value,amountCents:value?.amountCents??null},fields=['key','date','ms','sort','number','client','status','ownerUid','amountCents'];check(Object.keys(row).length===fields.length&&fields.every(k=>Object.hasOwn(row,k))&&row.sort===sort&&row.sort===Core.eventSort(row.ms,row.key)&&row.amountCents===null&&typeof row.date==='string'&&row.date.length<=80&&row.number?.length<=128&&row.client?.length<=200&&row.status?.length<=80,'Invalid activity point');return row;});
  const finalActor=await fresh(req),after=await Promise.all(paths.map(p=>ports.raw(p)));check(digest(Shared.actorPin(finalActor))===digest(pin)&&before.every((v,i)=>hash(v)===hash(after[i]))&&hash(legacy)===hash(await getLegacyContext()),'Activity context changed during read');
  const recent={schema:2,domain:'presupuestos',kind:'verified-legacy-instant-prefix',scope:actor.role==='admin'?'all':'own',generation:coverage.generation,revision:coverage.revision,order:Activity.ORDER,timeZone:coverage.activityTimeZone,sourceLocale:coverage.activitySourceLocale,fromStart:true,filter:'legacy-ms-truthy',exhausted:stats.eventEligible<=5,rows};
  const context={uid:actor.uid,role:actor.role,auth,db,permissionRevision:actor.permissionRevision,timeZone:coverage.activityTimeZone,sourceLocale:coverage.activitySourceLocale,grants:{ventas:null,pagos:null,ordenes_trabajo:null,presupuestos:recent.scope}};
  check(Core.merge({context,sources:{presupuestos:{...recent,context}},expected:{presupuestos:{generation:coverage.generation,revision:coverage.revision}}}).complete,'Invalid or unauthorized activity prefix');
  return {schema:2,proposal:true,uid:actor.uid,role:actor.role,permissionRevision:actor.permissionRevision,scope:recent.scope,generation:coverage.generation,revision:coverage.revision,counts:{active:stats.active,converted:stats.converted,totalNonCancelled:stats.totalNonCancelled,conversionPercent:stats.totalNonCancelled?Math.round(stats.converted/stats.totalNonCancelled*100):0},recent,badge:{asOfDay:badge.asOfDay,horizon:badge.horizon,badgeCount:badge.badgeCount,upcoming48Count:badge.upcoming48Count,complete:true,contract:badge.contract},notificationCenterComplete:false,mixedActivityComplete:false};
 }
 async function handle(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');try{res.statusCode=200;res.end(JSON.stringify(await read(req)));}catch(e){res.statusCode=[400,401,403,405,409,503].includes(e.statusCode)?e.statusCode:503;res.end(JSON.stringify({error:'Actividad de presupuestos no verificable.',code:'SV_BUDGET_ACTIVITY_RECONCILE'}));}}
 return Object.freeze({read,handle});
}
module.exports={ROUTE,createActivityReader,runtimeContext};
