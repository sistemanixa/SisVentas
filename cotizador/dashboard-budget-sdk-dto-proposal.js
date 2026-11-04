'use strict';
const Own=require('./commercial-ownership'),Index=require('./dashboard-budget-incremental-plan-proposal'),Core=require('./commercial-models/dashboard-activity-model.v2');
const {digest}=require('./labor-guard'),{normalizeRtdb}=require('./payment-membership-index');
const AuthorityPolicy=require('./dashboard-authority-policy-proposal'),Activity=require('./dashboard-budget-activity-codec-proposal');
const PermissionIndex=require('./commercial-models/permission-index');
const hash=v=>digest(normalizeRtdb(v)),fields=['records','active','converted','totalNonCancelled','totalDueEligible'];
function check(v,m){if(!v)throw Object.assign(Error(m),{code:'SV_BUDGET_SDK_RECONCILE'});}
// Offline projection only. A future writer must join these views to the same existing guard commit.
function validateCoverage({coverage:c,policy,users,identities,permissions}={}){
 check(c?.schema===1&&c.ready===true&&c.requiresReconciliation!==true&&typeof c.generation==='string'&&c.generation.length>0&&Number.isSafeInteger(c.revision)&&c.revision>=1&&typeof c.activityReady==='boolean'&&c.activitySchema===Activity.SCHEMA&&c.documentOrder===Core.SOURCE_ORDER&&c.scopeAbsenceIsZero===true&&policy?.hash===c.policyHash&&AuthorityPolicy.hash({users,identities,permissions})===c.policyHash,'Complete canonical policy/coverage required');
 check(Number.isSafeInteger(c.records)&&c.records>=0,'Invalid covered source count');
}
function eligible(person,permissions){const cfg=permissions[person.role];return !!cfg&&cfg.indiceVersion===2&&Number.isSafeInteger(cfg.indiceRevision)&&cfg.indiceRevision>=0&&Own.moduleAllowed(person.role,'dashboard',permissions)&&Own.eligible(person.role,'presupuestos',permissions);}
// Point metadata from an installed, proof-checked scope; no sources inventory required.
function projectReadView({coverage:c,policy,users,identities,permissions,person,stats:stored,scopeProof,expectedRecords}={}){
 validateCoverage({coverage:c,policy,users,identities,permissions});
 check(Own.profiles(users,identities).some(p=>digest(p)===digest(person)),'Unverified view identity');
 if(!eligible(person,permissions))return null;
 const cfg=permissions[person.role],scope=person.role==='admin'?'all':'u_'+person.uid;
 let stats=stored;
 if(stats==null){check(c.scopeAbsenceIsZero===true&&scopeProof==null&&scope!=='all'&&(expectedRecords===undefined||expectedRecords===0),'Missing populated scope');stats={...Object.fromEntries(fields.map(f=>[f,0])),eventEligible:0,eventExcluded:0};}
 else check(stats.schema===1&&stats.generation===c.generation&&Number.isSafeInteger(stats.revision)&&stats.revision>=1&&stats.revision<=c.revision&&scopeProof===hash(stats),'Scope proof incomplete');
 const expected=expectedRecords===undefined?(scope==='all'?c.records:stats.records):expectedRecords;
 check(fields.every(f=>Number.isSafeInteger(stats[f])&&stats[f]>=0)&&stats.records===expected&&stats.records<=c.records&&stats.active+stats.converted<=stats.totalNonCancelled&&stats.totalNonCancelled<=stats.records&&stats.totalDueEligible<=stats.active,'Invalid scope counters');
 if(c.activityReady)check(Number.isSafeInteger(stats.eventEligible)&&stats.eventEligible>=0&&Number.isSafeInteger(stats.eventExcluded)&&stats.eventExcluded>=0&&stats.eventEligible+stats.eventExcluded===stats.records,'Activity coverage incomplete');
 // Reuse the current checkbox/action index compiler; do not normalize or save the source config.
 const canonical=PermissionIndex.build({[person.role]:cfg},[],{[person.role]:{indiceRevision:cfg.indiceRevision-1}})[person.role];
 const profile=users[person.id],compatible=!Object.hasOwn(cfg,'bloqueados')&&['dashboard','presupuesto'].every(m=>cfg.indiceModulos[m]===canonical.indiceModulos[m])&&typeof profile.rol==='string'&&profile.rol.length<=80&&Own.linkedBudgetKey(person.id)!==null;
 return {schema:1,uid:person.uid,role:person.role,profileKey:person.id,profileRole:profile.rol,permissionRevision:cfg.indiceRevision,scope,generation:c.generation,revision:c.revision,policyHash:c.policyHash,ready:true,activityReady:c.activityReady===true,order:c.documentOrder,timeZone:c.activityTimeZone,sourceLocale:c.activitySourceLocale,directCompatible:compatible,...Object.fromEntries(fields.map(f=>[f,stats[f]])),eventEligible:c.activityReady?stats.eventEligible:null,eventExcluded:c.activityReady?stats.eventExcluded:null};
}
function projectReadViews({tree,users,identities,permissions}={}){
 const c=tree?.coverage;validateCoverage({coverage:c,policy:tree?.policy,users,identities,permissions});
 check(tree.sources&&Object.keys(tree.sources).length===c.records,'Source inventory incomplete');
 const owned=new Map();for(const s of Object.values(tree.sources))if(s.ownerUid)owned.set(s.ownerUid,(owned.get(s.ownerUid)||0)+1);
 const out={};
 for(const person of Own.profiles(users,identities)){
  if(!eligible(person,permissions))continue;
  const scope=person.role==='admin'?'all':'u_'+person.uid,expected=scope==='all'?c.records:owned.get(person.uid)||0,stored=tree.stats[scope];
  out[Index.ROOT+'/read/'+person.uid]=projectReadView({coverage:c,policy:tree.policy,users,identities,permissions,person,stats:stored,scopeProof:tree.scopeProof[scope],expectedRecords:expected});
 }
 return {proposal:true,patch:out,originalWrites:0,normalWriterIntegrated:false};
}
module.exports={projectReadViews,projectReadView,validateCoverage,eligible};
