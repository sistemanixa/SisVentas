'use strict';
// Inactive read-only consumer. Only the maintained notice subset is paged; never originals.
const Shared=require('./dashboard-budget-reader-proposal'),Index=require('./dashboard-budget-incremental-plan-proposal');
const {digest}=require('./labor-guard'),{normalizeRtdb}=require('./payment-membership-index');
const ROOT=Index.ROOT,ROUTE='/commercial/dashboard/presupuestos/avisos',hash=v=>digest(normalizeRtdb(v));
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const check=(ok,message)=>{if(!ok)throw Object.assign(Error(message),{code:'SV_BUDGET_NOTICES_INCOMPLETE',statusCode:409});};
const Notice=require('./commercial-models/dashboard-budget-notice-model-proposal'),project=Notice.project;
function create({auth,db,enabled=false,maxPages=100}={}){
 check(Number.isInteger(maxPages)&&maxPages>=1&&maxPages<=1000,'Invalid notice page budget');
 const {fresh}=Shared.createBudgetAuthority({auth,db}),ports=Shared.createIndexPorts(db);
 async function read(req){
  Shared.selection(req,ROUTE);check(enabled===true,'Notice candidate reader disabled');
  const actor=await fresh(req),pin=Shared.actorPin(actor),scope=actor.role==='admin'?'all':'u_'+actor.uid;
  const paths=[ROOT+'/coverage',ROOT+'/policy',ROOT+'/stats/'+scope,ROOT+'/scopeProof/'+scope];
  const before=await Promise.all(paths.map(p=>ports.raw(p))),[coverage,policy,stored,proof]=before;
  check(coverage?.schema===1&&coverage.ready===true&&coverage.noticeCandidateSchema===1&&coverage.scopeAbsenceIsZero===true&&typeof coverage.generation==='string'&&coverage.generation.length>0&&Number.isSafeInteger(coverage.revision)&&coverage.revision>=1&&Number.isSafeInteger(coverage.records)&&coverage.records>=0&&/^[a-f0-9]{64}$/.test(coverage.policyHash)&&policy?.hash===coverage.policyHash,'Uncertified notice index');
  const stats=stored===null&&proof===null?{noticeEligible:0,records:0}:stored;
  check(object(stats)&&Number.isSafeInteger(stats.noticeEligible)&&stats.noticeEligible>=0&&Number.isSafeInteger(stats.records)&&stats.noticeEligible<=stats.records&&(stored===null||stored.schema===1&&stored.generation===coverage.generation&&Number.isSafeInteger(stored.revision)&&stored.revision>=1&&stored.revision<=coverage.revision&&proof===hash(stored)),'Uncertified notice counts');
  check(scope!=='all'||stored!==null&&stats.records===coverage.records,'Global notice counts contradict coverage');
  const rows=[],seen=new Set();let cursor=null,anchor=null,complete=false;
  for(let page=0;page<maxPages;page++){
   let query=db.ref(ROOT+'/noticeCandidates/'+scope).orderByKey();if(cursor!==null)query=query.startAt(cursor);
   const snapshot=await query.limitToFirst(50).get(),children=[];snapshot.forEach(child=>children.push({key:child.key,value:child.val()}));
   check(children.length<=50,'Excessive notice page');let start=0,previous=cursor;
   if(cursor!==null){check(children.length>0&&children[0].key===cursor&&hash(children[0].value)===anchor,'Notice anchor changed');start=1;}
   for(const child of children.slice(start)){check((previous===null||child.key>previous)&&!seen.has(child.key),'Notice page order changed');rows.push(project(child.value,child.key,actor));seen.add(child.key);previous=child.key;}
   check(rows.length<=stats.noticeEligible,'Notice index exceeds coverage');
   if(children.length<50){complete=true;break;}cursor=children.at(-1).key;anchor=hash(children.at(-1).value);
  }
  check(complete&&rows.length===stats.noticeEligible,'Incomplete notice index');
  const finalActor=await fresh(req),after=await Promise.all(paths.map(p=>ports.raw(p)));
  check(hash(Shared.actorPin(finalActor))===hash(pin)&&before.every((v,i)=>hash(v)===hash(after[i])),'Notice context changed');
  return {schema:1,uid:actor.uid,role:actor.role,permissionRevision:actor.permissionRevision,scope:actor.role==='admin'?'all':'own',generation:coverage.generation,revision:coverage.revision,complete:true,rows};
 }
 return Object.freeze({read});
}
module.exports={ROUTE,create,project};
