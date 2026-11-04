(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./dashboard-activity-model.v2'):root.SVDashboardActivityModelV2);if(typeof module==='object'&&module.exports)module.exports=api;else root.SVDashboardActivityAggregateProposal=api;})(typeof globalThis==='object'?globalThis:this,function(Core){
'use strict';
/**
 * @typedef {Object} CapturedContext
 * @property {string} uid
 * @property {string} role
 * @property {number} permissionRevision
 * @property {string} permissionSignature
 * @property {number} sessionEpoch Monotone host epoch, including same-UID reauthentication.
 * @property {number} dataEpoch Monotone host data-reset epoch, independent of Auth/User identity.
 * @property {number} connectionEpoch
 * @property {Object} auth Actual Auth reference; currentUser identity is pinned separately.
 * @property {Object} db Actual database reference.
 * @property {string} timeZone Explicit IANA browser/business zone.
 * @property {string} sourceLocale
 * @property {string} month YYYY-MM, captured with asOfDay.
 * @property {string} asOfDay YYYY-MM-DD in that explicit zone.
 * @property {string} employeeLabel Exact legacy filter label; never identity/ownership.
 * @property {Object<string, string|null>} grants Fresh host grants for all four domains.
 * @typedef {{schema:1, context:CapturedContext, domain?:string}} PortRequest
 * @typedef {{schema:1, context:CapturedContext, value:Object}} PortResponse
 * @typedef {{read:function(PortRequest):Promise<PortResponse>}} VerifiedPort
 * Budget value = existing SDK/server result with recent/counts/badge[/notices].
 * Commercial value = existing verified domain result with recent.
 * Month value = bounded own-scope monthly result, anchored to global budget revision.
 */
const domains=['ventas','pagos','ordenes_trabajo','presupuestos'],fields=['uid','role','permissionRevision','permissionSignature','sessionEpoch','dataEpoch','connectionEpoch','auth','db','timeZone','sourceLocale','month','employeeLabel','asOfDay'];
const fail=(message,retired=false)=>Object.assign(Error(message),{code:retired?'SV_ACTIVITY_CONTEXT_RETIRED':'SV_ACTIVITY_AGGREGATE_INCOMPLETE'}),check=(v,m)=>{if(!v)throw fail(m);};
function snapshot(c){
 check(c&&/^[A-Za-z0-9_-]{1,128}$/.test(c.uid)&&typeof c.role==='string'&&c.role&&Number.isSafeInteger(c.permissionRevision)&&c.permissionRevision>=0&&typeof c.permissionSignature==='string'&&c.permissionSignature.length>0&&Number.isSafeInteger(c.sessionEpoch)&&c.sessionEpoch>=0&&Number.isSafeInteger(c.dataEpoch)&&c.dataEpoch>=0&&Number.isSafeInteger(c.connectionEpoch)&&c.connectionEpoch>=0&&c.connected===true&&!c.viewing&&c.auth?.currentUser?.uid===c.uid&&c.db&&typeof c.timeZone==='string'&&c.timeZone&&typeof c.sourceLocale==='string'&&c.sourceLocale&&/^\d{4}-(0[1-9]|1[0-2])$/.test(c.month)&&/^\d{4}-\d{2}-\d{2}$/.test(c.asOfDay)&&c.asOfDay.slice(0,7)===c.month&&typeof c.employeeLabel==='string'&&c.employeeLabel.length<=160&&domains.every(d=>['all','own',null].includes(c.grants?.[d])),'Missing captured aggregate context');
 return Object.freeze({...Object.fromEntries(fields.map(k=>[k,c[k]])),connected:true,user:c.auth.currentUser,grants:Object.freeze({...c.grants})});
}
function same(a,b){return !!a&&!!b&&fields.every(k=>a[k]===b[k])&&a.user===b.user&&a.auth.currentUser===a.user&&b.auth.currentUser===b.user&&domains.every(d=>a.grants[d]===b.grants[d]);}
function stamp(r){check(r&&typeof r.generation==='string'&&r.generation&&Number.isSafeInteger(r.revision)&&r.revision>=1,'Missing source revision');return r.generation+'|'+r.revision;}
function create({enabled=false,capture,valid,ports,requireNotices=true}={}){
 check(typeof capture==='function'&&typeof valid==='function'&&typeof ports?.budget?.read==='function'&&typeof ports?.commercial?.read==='function'&&typeof ports?.month?.read==='function'&&typeof requireNotices==='boolean','Missing typed activity ports');
 async function read(){
  check(enabled===true,'Aggregate disabled');const ctx=snapshot(capture());check(domains.every(d=>ctx.grants[d]!==null),'Four-domain aggregate not authorized');let error;
  function live(){if(error)throw error;try{if(!valid(ctx)||!same(ctx,snapshot(capture())))throw fail('Aggregate context retired',true);}catch(e){error=e.code==='SV_ACTIVITY_CONTEXT_RETIRED'?e:fail('Aggregate context retired',true);throw error;}}
  async function call(kind,domain){live();try{const envelope=await ports[kind].read({schema:1,context:ctx,...(domain?{domain}:{})});live();check(envelope?.schema===1&&same(ctx,envelope.context)&&envelope.value?.uid===ctx.uid&&envelope.value?.role===ctx.role&&envelope.value?.permissionRevision===ctx.permissionRevision,'Port returned a different context');return envelope.value;}catch(e){if(!error)error=e;throw error;}}
  function budget(b){stamp(b);check(b.recent?.domain==='presupuestos'&&b.recent.generation===b.generation&&b.recent.revision===b.revision&&b.counts&&['active','converted','totalNonCancelled'].every(k=>Number.isSafeInteger(b.counts[k])&&b.counts[k]>=0)&&b.counts.active+b.counts.converted<=b.counts.totalNonCancelled&&b.counts.conversionPercent===(b.counts.totalNonCancelled?Math.round(100*b.counts.converted/b.counts.totalNonCancelled):0)&&b.badge?.complete===true&&b.badge.asOfDay===ctx.asOfDay&&(!requireNotices||b.notices?.complete===true&&Array.isArray(b.notices.rows)),'Budget consumers incomplete');}
  const b0=await call('budget');budget(b0);const m0=await call('month');
  const commercial=await Promise.all(domains.slice(0,3).map(d=>call('commercial',d)));
  check(commercial.every((r,i)=>r.recent?.domain===domains[i]&&r.recent.scope===ctx.grants[domains[i]]),'Unexpected commercial domain/scope');
  check(commercial.every(r=>stamp(r.recent)===stamp(commercial[0].recent)),'Commercial generations/revisions differ');
  const m1=await call('month'),b1=await call('budget');budget(b1);live();
  check(stamp(b0)===stamp(b1)&&JSON.stringify(b0)===JSON.stringify(b1),'Budget changed across commercial interval');
  check(stamp(m0)===stamp(b0)&&stamp(m1)===stamp(b1)&&JSON.stringify(m0)===JSON.stringify(m1)&&m0.complete===true&&m0.scope==='u_'+ctx.uid&&m0.month===ctx.month&&m0.employeeLabel===ctx.employeeLabel&&Number.isSafeInteger(m0.records)&&Number.isSafeInteger(m0.converted)&&m0.records>=0&&m0.converted>=0&&m0.converted<=m0.records&&m0.conversionPercent===(m0.records?Math.round(100*m0.converted/m0.records):0),'Monthly metric is not from the budget interval');
  const sources={},expected={};for(const [i,d]of domains.entries()){const r=d==='presupuestos'?b1.recent:commercial[i].recent;check(r.domain===d&&r.scope===ctx.grants[d],'Unexpected domain/scope');sources[d]={...r,context:ctx};expected[d]={generation:r.generation,revision:r.revision};}
  const activity=Core.merge({context:ctx,sources,expected});check(activity.complete,'Four-prefix merge incomplete');live();
  return {schema:1,uid:ctx.uid,role:ctx.role,permissionRevision:ctx.permissionRevision,sessionEpoch:ctx.sessionEpoch,dataEpoch:ctx.dataEpoch,activity,monthly:m1,counts:b1.counts,badge:b1.badge,notices:b1.notices??null,coverage:{commercial:{generation:commercial[0].recent.generation,revision:commercial[0].recent.revision},budget:{generation:b1.generation,revision:b1.revision}},consumersComplete:requireNotices&&b1.notices?.complete===true,budgetNoticesComplete:requireNotices&&b1.notices?.complete===true,salesAuthorMonthly:null,salesAuthorMonthlyComplete:false,dashboardComplete:false,originalCollectionComplete:false,notificationCenterComplete:false};
 }
 return Object.freeze({read});
}
// Host adapter calls a REAL verified reader, then binds its result to the same live capture.
function port({capture,valid,read}){check(typeof read==='function'&&typeof capture==='function'&&typeof valid==='function','Invalid port');return Object.freeze({async read(request){check(request?.schema===1,'Invalid port request');const ctx=request.context;function live(){if(!valid(ctx)||!same(ctx,snapshot(capture())))throw fail('Port context retired',true);}live();const value=await read(request);live();return {schema:1,context:ctx,value};}});}
return Object.freeze({create,port,snapshot,same});
});
