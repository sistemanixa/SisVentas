'use strict';
const {fixture}=require('./commercial-delete-attestation-fixture.cjs'),{apply}=require('./labor-ui-flow.cjs');
const Fence=require('../../cotizador/labor-fence-policy'),Rules=require('../../scripts/lib/commercial-delete-atomic-rules.cjs'),Protocol=require('../../cotizador/commercial-delete-commit-protocol');
class Snapshot{
 constructor(root,path=[]){this.root=root;this.path=path;}
 val(){return require('../../cotizador/payment-membership-index').normalizeRtdb(this.path.reduce((v,k)=>v?.[k],this.root)??null);}
 exists(){return this.val()!==null;}
 isNumber(){return typeof this.val()==='number';}
 isString(){return typeof this.val()==='string';}
 child(path){return new Snapshot(this.root,this.path.concat(String(path).split('/').filter(Boolean)));}
 parent(){return new Snapshot(this.root,this.path.slice(0,-1));}
 hasChildren(keys){return keys.every(key=>this.child(key).exists());}
}
function baseline(){return {rules:{'.read':false,'.write':false,sisventas:{'.write':false,...Object.fromEntries(['ventas','ordenes','ordenes_trabajo'].map(domain=>[domain,{'.write':false,$record:{'.write':Fence.financialRule(3,"auth.uid === 'u'"),detalle:{'.write':"auth.uid === 'u'"}}}]))},...Fence.metadataRules()}};}
function allowed(rule,{before,after,path,auth,id}){
 if(rule===false||rule===undefined)return false;
 return new Function('root','data','newData','auth','now','$record','return ('+rule.replaceAll('.matches(','.match(')+');')(new Snapshot(before),new Snapshot(before,path),new Snapshot(after,path),auth,Date.now(),id);
}
function service(actor,lease,claims){return {uid:actor.mode==='user'?actor.uid:Fence.SERVICE_UID,token:{...actor.claims,svLaborService:true,mode:'commit',fence:lease.fence,opId:lease.opId,digest:lease.digest,actorUid:lease.actorUid,actorRole:actor.role,actorPermissionRevision:actor.permissionRevision,actorPasswordChangeRequired:false,...Protocol.reservedClaims(actor.claims),...claims}};}
async function create(){const f=await fixture(),rules=Rules.prepare(baseline(),{pins:f.pins}),protocol=Protocol.create({verifier:f.verifier,pins:f.pins});return {...f,rules,protocol};}
function checkCommit(f,patch,lease,actor,claims){
 const before=structuredClone(f.state),after=structuredClone(f.state);apply(after,patch);const auth=service(actor,lease,claims),results=[];
 const records=new Set();for(const path of Object.keys(patch))if(['ventas','ordenes','ordenes_trabajo'].some(domain=>path.startsWith('sisventas/'+domain+'/')))records.add(path.split('/').slice(0,3).join('/'));
 for(const path of records){const [,domain,id]=path.split('/');results.push(allowed(f.rules.rules.sisventas[domain].$record['.write'],{before,after,path:path.split('/'),auth,id}));}
 results.push(allowed(f.rules.rules.sv_labor_guard['.write'],{before,after,path:['sv_labor_guard'],auth}),allowed(f.rules.rules.sv_labor_receipts.$op['.write'].replaceAll('$op','auth.token.opId'),{before,after,path:['sv_labor_receipts',lease.opId],auth}));
 return results.every(Boolean);
}
module.exports={create,baseline,Snapshot,allowed,service,checkCommit};
