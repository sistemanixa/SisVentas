(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./dashboard-activity-aggregate-proposal'):root.SVDashboardActivityAggregateProposal);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardBudgetMonthPortProposal=api;})(typeof globalThis==='object'?globalThis:this,function(Aggregate){
'use strict';
const ROOT='sv_dashboard_budget_proposal/v1',fail=(message,code='SV_BUDGET_MONTH_INCOMPLETE')=>Object.assign(Error(message),{code}),check=(v,m)=>{if(!v)throw fail(m);};
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
async function hash(value){const bytes=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');}
function create({enabled=false,readFresh,capture,valid}={}){
 check(typeof readFresh==='function'&&typeof capture==='function'&&typeof valid==='function','Missing month port');
 return Aggregate.port({capture,valid,async read({context:ctx}){
  check(enabled===true,'Month port disabled');function live(){if(!valid(ctx)||!Aggregate.same(ctx,Aggregate.snapshot(capture())))throw fail('Monthly context retired','SV_ACTIVITY_CONTEXT_RETIRED');}
  async function get(path){live();const s=await readFresh({path});live();return s.val();}
  function header(h){check(h?.schema===1&&h.uid===ctx.uid&&h.role===ctx.role&&h.permissionRevision===ctx.permissionRevision&&h.ready===true&&h.directCompatible===true&&h.scope===(ctx.role==='admin'?'all':'u_'+ctx.uid)&&typeof h.generation==='string'&&h.generation&&Number.isSafeInteger(h.revision)&&h.revision>=1&&/^[a-f0-9]{64}$/.test(h.policyHash)&&h.timeZone===ctx.timeZone&&h.sourceLocale===ctx.sourceLocale,'Uncertified budget header');return h;}
  const before=header(await get(ROOT+'/read/'+ctx.uid)),scope=before.scope,bucket=await hash([ctx.employeeLabel,ctx.month]);live();
  const paths=[ROOT+'/months/'+scope+'/'+bucket,ROOT+'/monthProof/'+scope+'/'+bucket,ROOT+'/coverage/scopeAbsenceIsZero'];
  const values=await Promise.all(paths.map(get)),[s,proof,absence]=values;let records,converted,bucketRevision;
  async function noMembers(){live();const members=await readFresh({path:ROOT+'/monthMembers/'+scope+'/'+bucket,orderByKey:true,limitToFirst:1});live();check(members.val()===null,'Missing monthly counts still have indexed members');}
  if(s===null){check(proof===null&&absence===true,'Missing month has no certified absence');await noMembers();records=converted=0;bucketRevision=null;}
  else{check(s&&Object.keys(s).length===5&&s.schema===1&&s.generation===before.generation&&Number.isSafeInteger(s.revision)&&s.revision>=1&&s.revision<=before.revision&&Number.isSafeInteger(s.records)&&s.records>=0&&Number.isSafeInteger(s.converted)&&s.converted>=0&&s.converted<=s.records&&proof===await hash(s),'Month metadata/proof mismatched');live();records=s.records;converted=s.converted;bucketRevision=s.revision;}
  const after=header(await get(ROOT+'/read/'+ctx.uid)),final=await Promise.all(paths.map(get));check(canonical(before)===canonical(after)&&values.every((v,i)=>canonical(v)===canonical(final[i])),'Monthly coverage changed');if(s===null)await noMembers();live();
  return {schema:1,uid:ctx.uid,role:ctx.role,permissionRevision:ctx.permissionRevision,generation:before.generation,revision:before.revision,policyHash:before.policyHash,scope,month:ctx.month,employeeLabel:ctx.employeeLabel,records,converted,conversionPercent:records?Math.round(100*converted/records):0,bucketRevision,absenceCertified:s===null,complete:true};
 }});
}
// Separate bounded fresh HTTP port; no changes to the SDK reader owned by the host.
function createFresh({databaseURL,expectedOrigin,allowLoopback=false,auth,capture,valid,fetchImpl=globalThis.fetch}={}){
 let base;try{base=new URL(databaseURL);}catch(_){throw fail('Invalid database URL');}const local=base.protocol==='http:'&&['localhost','127.0.0.1'].includes(base.hostname),remote=base.protocol==='https:'&&(/^[a-z0-9-]+(?:\.[a-z0-9-]+)?\.firebasedatabase\.app$/.test(base.hostname)||/^[a-z0-9-]+\.firebaseio\.com$/.test(base.hostname))&&!base.port;
 check(base.origin===expectedOrigin&&(remote||local&&allowLoopback)&&!base.username&&!base.password&&!base.hash&&base.pathname==='/'&&(!base.search||local&&[...base.searchParams.keys()].every(k=>k==='ns'))&&typeof capture==='function'&&typeof valid==='function'&&typeof fetchImpl==='function','Invalid fresh month transport');
 return async spec=>{
  const ctx=Aggregate.snapshot(capture()),user=ctx.user;function live(){if(auth!==ctx.auth||!valid(ctx)||!Aggregate.same(ctx,Aggregate.snapshot(capture())))throw fail('Fresh month context retired','SV_ACTIVITY_CONTEXT_RETIRED');}live();
  const own=ROOT+'/read/'+ctx.uid,scope=ctx.role==='admin'?'all':'u_'+ctx.uid,leaf=ROOT+'/coverage/scopeAbsenceIsZero',point=new RegExp('^'+ROOT+'/(months|monthProof)/'+scope+'/[a-f0-9]{64}$'),members=new RegExp('^'+ROOT+'/monthMembers/'+scope+'/[a-f0-9]{64}$'),memberQuery=spec&&members.test(spec.path||'');
  check(spec&&typeof spec.path==='string'&&(memberQuery?Object.keys(spec).length===3&&spec.orderByKey===true&&spec.limitToFirst===1:Object.keys(spec).length===1&&(spec.path===own||spec.path===leaf||point.test(spec.path))),'Month transport path denied');
  const token=await user.getIdToken();live();check(typeof token==='string'&&token,'Missing token');const url=new URL(spec.path.split('/').map(encodeURIComponent).join('/')+'.json',base);if(local&&base.searchParams.has('ns'))url.searchParams.set('ns',base.searchParams.get('ns'));url.searchParams.set('auth',token);if(memberQuery){url.searchParams.set('orderBy',JSON.stringify('$key'));url.searchParams.set('limitToFirst','1');}
  const r=await fetchImpl(url,{method:'GET',cache:'no-store',credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(10000)});live();if(!r.ok){await r.body?.cancel();throw Object.assign(fail('Fresh month permission/read denied'),{statusCode:r.status});}const value=await r.json();live();return {val:()=>value};
 };
}
return Object.freeze({ROOT,create,createFresh,hash});
});
