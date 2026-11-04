(function(root,factory){'use strict';const api=factory(typeof module==='object'&&module.exports?require('./dashboard-activity-model.v2'):root.SVDashboardActivityModelV2);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardBudgetSDKProposal=api;})(typeof window==='object'?window:globalThis,function(Core){
'use strict';
const ROOT='sv_dashboard_budget_proposal/v1',object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),uid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const fields=['schema','uid','role','profileKey','profileRole','permissionRevision','scope','generation','revision','policyHash','ready','activityReady','order','timeZone','sourceLocale','directCompatible','records','active','converted','totalNonCancelled','totalDueEligible','eventEligible','eventExcluded'];
const fail=(message,code='SV_BUDGET_SDK_INCOMPLETE')=>Object.assign(Error(message),{code});
const check=(v,m)=>{if(!v)throw fail(m);};
const rawSort=s=>Array.from({length:s.length},(_,i)=>s.charCodeAt(i).toString(16).padStart(4,'0')).join('');
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
async function identityHash(key){const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(key)));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function create({readFresh,capture,valid,getAsOfDay,maxPages=100}={}){
 check(Core&&typeof readFresh==='function'&&typeof capture==='function'&&typeof valid==='function'&&typeof getAsOfDay==='function'&&Number.isInteger(maxPages)&&maxPages>=1&&maxPages<=1000,'Missing direct SDK contract');
 async function read({activity=true,badge=true}={}){
  check(typeof activity==='boolean'&&typeof badge==='boolean','Invalid consumer');
  const initial=capture(),user=initial?.auth?.currentUser,ctx={...initial,grants:{...initial?.grants}};
  let cancelled=false,firstError;
  function live(){if(cancelled)throw firstError;const now=capture();if(!uid(ctx.uid)||!user||ctx.auth?.currentUser!==user||user.uid!==ctx.uid||now.auth?.currentUser!==user||!Number.isSafeInteger(ctx.sessionEpoch)||ctx.sessionEpoch<0||now.sessionEpoch!==ctx.sessionEpoch||ctx.connected!==true||now.connected!==true||!Number.isSafeInteger(ctx.connectionEpoch)||now.connectionEpoch!==ctx.connectionEpoch||!valid(ctx)||now.uid!==ctx.uid||now.role!==ctx.role||now.auth!==ctx.auth||now.db!==ctx.db||now.permissionRevision!==ctx.permissionRevision||now.timeZone!==ctx.timeZone||now.sourceLocale!==ctx.sourceLocale||Core.DOMAINS.some(d=>now.grants?.[d]!==ctx.grants[d]))throw fail('Retired SDK context','SV_BUDGET_SDK_RETIRED');}
  async function consumer(work){try{return await work();}catch(error){if(!cancelled){cancelled=true;firstError=error;}throw firstError;}}
  async function get(path,query={}){live();const snap=await readFresh({path,...query});live();return snap;}
  function header(value){const h={...value,eventEligible:value?.eventEligible??null,eventExcluded:value?.eventExcluded??null};check(object(value)&&Object.keys(h).length===fields.length&&fields.every(k=>Object.hasOwn(h,k))&&h.schema===1&&h.ready===true&&h.directCompatible===true&&h.uid===ctx.uid&&h.role===ctx.role&&h.permissionRevision===ctx.permissionRevision&&h.scope===(ctx.role==='admin'?'all':'u_'+ctx.uid)&&ctx.grants.presupuestos===(ctx.role==='admin'?'all':'own')&&typeof h.generation==='string'&&h.generation.length>0&&Number.isSafeInteger(h.revision)&&h.revision>=1&&/^[a-f0-9]{64}$/.test(h.policyHash)&&h.order===Core.SOURCE_ORDER&&h.timeZone===ctx.timeZone&&h.sourceLocale===ctx.sourceLocale,'Uncertified public DTO');check(['records','active','converted','totalNonCancelled','totalDueEligible'].every(f=>Number.isSafeInteger(h[f])&&h[f]>=0)&&h.active+h.converted<=h.totalNonCancelled&&h.totalNonCancelled<=h.records&&h.totalDueEligible<=h.active,'Invalid counters');if(activity)check(h.activityReady===true&&Number.isSafeInteger(h.eventEligible)&&h.eventEligible>=0&&Number.isSafeInteger(h.eventExcluded)&&h.eventExcluded>=0&&h.eventEligible+h.eventExcluded===h.records,'Activity not certified');return h;}
  live();const path=ROOT+'/read/'+ctx.uid,before=header((await get(path)).val());
  async function events(){const snap=await get(ROOT+'/document/'+before.scope,{orderByKey:true,limitToFirst:5}),rows=[];snap.forEach(child=>{const row={...child.val(),amountCents:child.val()?.amountCents??null};check(row.sort===child.key&&Object.keys(row).length===9&&['key','date','ms','sort','number','client','status','ownerUid','amountCents'].every(f=>Object.hasOwn(row,f))&&typeof row.date==='string'&&row.date.length<=80&&row.number?.length<=128&&row.client?.length<=200&&row.status?.length<=80&&row.amountCents===null,'Invalid event DTO');rows.push(row);});check(rows.length===Math.min(5,before.eventEligible),'Incomplete event prefix');return {schema:2,domain:'presupuestos',kind:'verified-legacy-instant-prefix',scope:ctx.grants.presupuestos,generation:before.generation,revision:before.revision,order:before.order,timeZone:before.timeZone,sourceLocale:before.sourceLocale,fromStart:true,filter:'legacy-ms-truthy',exhausted:before.eventEligible<=5,rows};}
  async function badgeCounts(){
   const day=await getAsOfDay(),stamp=Date.parse(day+'T00:00:00Z');check(/^\d{4}-\d{2}-\d{2}$/.test(day)&&+day.slice(0,4)>=100&&Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===day,'Invalid as-of day');const horizon=new Date(stamp+2*86400000).toISOString().slice(0,10);check(/^\d{4}-\d{2}-\d{2}$/.test(horizon),'Unsupported horizon');
   let cursor=null,anchor=null,future=0,upcoming=0,done=false;const seen=new Set();
   for(let page=0;page<maxPages;page++){
    const snap=await get(ROOT+'/noticeBadge/'+before.scope,{orderByKey:true,startAt:cursor||rawSort(day)+'!',limitToFirst:50}),children=[];snap.forEach(child=>{children.push({sort:child.key,value:child.val()});});check(children.length<=50,'Excessive badge page');let start=0,previous=cursor||'';
    if(cursor){check(children.length>0&&children[0].sort===cursor&&canonical(children[0])===anchor,'Badge anchor changed');start=1;}
    for(const child of children.slice(start)){const v=child.value;check(object(v)&&Object.keys(v).length===2&&typeof v.key==='string'&&v.key.length>0&&v.key.length<=128&&typeof v.dueRaw==='string'&&v.dueRaw.length>=1&&v.dueRaw.length<=80&&child.sort===rawSort(v.dueRaw)+'!'+await identityHash(v.key)&&v.dueRaw>=day&&(!previous||child.sort>previous)&&!seen.has(v.key),'Invalid badge candidate');previous=child.sort;seen.add(v.key);if(v.dueRaw>horizon)future++;else upcoming++;}
    check(future+upcoming<=before.totalDueEligible,'Badge contradicts metadata');if(children.length<50){done=true;break;}cursor=children.at(-1).sort;anchor=canonical(children.at(-1));
   }
   check(done,'Badge page budget exhausted');return {asOfDay:day,horizon,badgeCount:before.totalDueEligible-future,upcoming48Count:upcoming,complete:true,contract:'legacy-raw-lex/v1'};
  }
  const tasks=await Promise.all([activity?consumer(events):null,badge?consumer(badgeCounts):null]);
  const after=header((await get(path)).val());check(canonical(before)===canonical(after),'SDK generation/revision changed');live();
  const result={schema:2,uid:ctx.uid,role:ctx.role,permissionRevision:ctx.permissionRevision,scope:ctx.grants.presupuestos,generation:before.generation,revision:before.revision,counts:{active:before.active,converted:before.converted,totalNonCancelled:before.totalNonCancelled,conversionPercent:before.totalNonCancelled?Math.round(before.converted/before.totalNonCancelled*100):0},notificationCenterComplete:false,mixedActivityComplete:false};
  if(activity){result.recent=tasks[0];const prefix=Core.budgetPrefix({result,captured:ctx,context:ctx}),proof=Core.merge({context:ctx,sources:{presupuestos:prefix},expected:{presupuestos:{generation:before.generation,revision:before.revision}}});check(proof.sources.presupuestos.complete,'Uncertified instant rows');}
  if(badge)result.badge=tasks[1];return result;
 }
 return Object.freeze({read,metrics:()=>read({activity:false,badge:false})});
}
return Object.freeze({ROOT,create});
});
