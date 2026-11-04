'use strict';
// Inactive same-commit proposal. No transport, persistence or independent lease.
const Index=require('./dashboard-budget-incremental-plan-proposal'),DTO=require('./dashboard-budget-sdk-dto-proposal'),Own=require('./commercial-ownership'),Policy=require('./dashboard-authority-policy-proposal');
const {digest,put,child}=require('./labor-guard'),{normalizeRtdb}=require('./payment-membership-index');
const ROOT=Index.ROOT,READ=ROOT+'/read',AUTH=['sv_usuarios','sv_chat_roles','sv_permisos'],names=['users','identities','permissions'];
const stable=v=>digest(normalizeRtdb(v)),object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v),uid=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const check=(v,m)=>{if(!v)throw Object.assign(Error(m),{code:'SV_BUDGET_UID_HEADERS_RECONCILE',statusCode:409});};
async function augment({enabled=false,planned,raw,get,beforeCommit}={}){
 check(typeof enabled==='boolean'&&object(planned)&&object(planned.patch),'Explicit planned header augment required');
 const entries=Object.entries(planned.patch),needsRefresh=entries.some(([p])=>p===ROOT+'/coverage'||p.startsWith(ROOT+'/coverage/'));
 check(entries.every(([p])=>p.startsWith(ROOT+'/')&&p!==READ&&!p.startsWith(READ+'/')),'Untrusted or precomputed UID header patch');
 check(!planned.requiresReadViewRefresh||needsRefresh,'Required header refresh has no planned coverage');
 if(!needsRefresh)return {...structuredClone(planned),readViewRefreshComplete:false};
 check(enabled===true,'UID header refresh disabled; planned operation cannot be committed');
 check(typeof raw==='function'&&typeof get==='function'&&typeof beforeCommit==='function','Guard-bound header ports required');
 const captured=new Map();
 async function snapshot(path){const value=await raw(path);if(!captured.has(path))captured.set(path,stable(value));return value;}
 async function after(path){await snapshot(path);let value=await get(path);for(const [p,v]of entries){if(p===path)value=structuredClone(v);else if(path.startsWith(p+'/'))value=child(v,path.slice(p.length+1).split('/'));else if(p.startsWith(path+'/'))value=put(value,p.slice(path.length+1).split('/'),v);}return value;}
 const beforeAuthority={},authority={};for(let i=0;i<AUTH.length;i++){beforeAuthority[names[i]]=await raw(AUTH[i]);authority[names[i]]=await get(AUTH[i]);}
 const beforeAuthorityHash=Policy.hash(beforeAuthority),coverage=await after(ROOT+'/coverage'),policy=await after(ROOT+'/policy'),previous=await snapshot(READ);
 check(previous===null||object(previous)&&Object.keys(previous).every(uid),'Previous UID header inventory malformed');
 check(coverage?.schema===1&&Number.isSafeInteger(coverage.revision)&&coverage.revision>=1&&typeof coverage.generation==='string','Planned coverage incomplete');
 const headers=Object.create(null);
 if(coverage.ready===true){
  DTO.validateCoverage({coverage,policy,...authority});
  for(const person of Own.profiles(authority.users,authority.identities)){
   if(!DTO.eligible(person,authority.permissions))continue;
   const scope=person.role==='admin'?'all':'u_'+person.uid,stats=await after(ROOT+'/stats/'+scope),proof=await after(ROOT+'/scopeProof/'+scope);
   if(stats===null&&previous?.[person.uid]?.scope===scope)check(previous[person.uid].records===0,'Previously populated scope lost its metadata');
   const header=DTO.projectReadView({coverage,policy,...authority,person,stats,scopeProof:proof});
   check(header&&header.uid===person.uid&&header.revision===coverage.revision&&header.generation===coverage.generation&&header.policyHash===coverage.policyHash,'Incomplete UID header projection');
   headers[person.uid]=header;
  }
 }else check(coverage.ready===false&&planned.requiresReconciliation===true,'Unknown nonready coverage cannot certify UID retirement');
 const headerPatch=Object.fromEntries([...new Set([...Object.keys(previous||{}),...Object.keys(headers)])].map(id=>[READ+'/'+id,headers[id]??null]));
 beforeCommit(async({readFresh})=>{
  const fresh={};for(let i=0;i<AUTH.length;i++)fresh[names[i]]=await readFresh(AUTH[i]);
  check(Policy.hash(fresh)===beforeAuthorityHash,'Authority changed before UID header commit');
  for(const [path,hash]of captured)check(stable(await readFresh(path))===hash,'UID header source metadata changed before commit');
 });
 return {...structuredClone(planned),patch:{...structuredClone(planned.patch),...headerPatch},requiresReadViewRefresh:false,readViewRefreshComplete:true,uidHeaderCount:Object.keys(headers).length,retiredUidCount:Object.keys(previous||{}).filter(id=>!Object.hasOwn(headers,id)).length,proposal:true,activationAuthorized:false,originalWrites:0,normalWriterIntegrated:false};
}
module.exports={augment};
