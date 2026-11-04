'use strict';
// Plan only: join the existing guard commit; never acquire a lease or store receipts here.
const {digest}=require('./labor-guard'),Own=require('./commercial-ownership'),Evidence=require('./client-account-owner-evidence'),Model=require('./dashboard-budget-projection-proposal');
const {normalizeRtdb}=require('./payment-membership-index');
const stable=value=>digest(normalizeRtdb(value));
const ROOT='sv_dashboard_budget_proposal/v1',ORIGINAL='sisventas/presupuestos',AUTHORITY=['sv_usuarios','sv_chat_roles','sv_permisos'];
const fields=['records','active','converted','totalNonCancelled','unknownDates'],mod=1n<<256n;
const ownershipFields=['responsableUid','creadaPorUid','creadoPorUid','usuarioUid','empleadoUid','creadoPor','usuario','empleado'];
const rowFields=['key','sourceHash','ownerUid','number','client','status','date','ts','employeeLabel','dueRaw','dueDay','sentDay','admits','approvalStamp','approvedBy','reason','amount'];
const fail=(reason)=>Object.assign(Error(reason),{code:'SV_BUDGET_INCREMENTAL_RECONCILE',statusCode:409});
const check=(value,reason)=>{if(!value)throw fail(reason);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const key=v=>typeof v==='string'&&v.length>0&&v.length<=128&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const ownershipHash=r=>stable(Object.fromEntries(ownershipFields.filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]])));
const scopes=uid=>uid?['all','u_'+uid]:['all'];
const sumHash=(before,hash,sign)=>((BigInt('0x'+before)+BigInt(sign)*BigInt('0x'+hash)+mod)%mod).toString(16).padStart(64,'0');
const zero=()=>Object.fromEntries(fields.map(k=>[k,0]));
const counts=r=>r?{records:1,active:Number(Model.ACTIVE.includes(r.status)),converted:Number(r.status==='convertido'),totalNonCancelled:Number(r.status!=='anulado'),unknownDates:Number(!Model.day(r.date))}:zero();
const monthBucket=row=>/^\d{4}-(0[1-9]|1[0-2])$/.test(row.date.slice(0,7))?stable([row.employeeLabel,row.date.slice(0,7)]):null;
function validateStats(stats,generation){check(object(stats)&&stats.schema===1&&stats.generation===generation&&Number.isSafeInteger(stats.revision)&&stats.revision>=1&&fields.every(k=>Number.isSafeInteger(stats[k])&&stats[k]>=0),'Scope metadata incomplete');check(stats.active+stats.converted<=stats.totalNonCancelled&&stats.totalNonCancelled<=stats.records&&stats.unknownDates<=stats.records,'Scope counts inconsistent');}
function validateRow(row,id,source,owner){
 check(object(row)&&Object.keys(row).length===rowFields.length&&rowFields.every(k=>Object.hasOwn(row,k))&&row.key===id&&row.sourceHash===stable(source)&&row.ownerUid===owner&&(owner===''||/^[A-Za-z0-9_-]{1,128}$/.test(owner)),'Point projector has no matching source evidence');
 check(rowFields.every(k=>row[k]===null||['string','number','boolean'].includes(typeof row[k])),'Point projector leaked nested data');
 check(row.status===String(source.estado||'').slice(0,80)&&row.date===String(source.fecha||'').slice(0,80),'Point projector changed status/date');
 return structuredClone(row);
}
function source(id,original,row){return {key:id,sourceHash:stable(original),ownerUid:row.ownerUid,ownershipHash:ownershipHash(original),ownerEvidence:Evidence.fromRecord(original,'presupuestos'),row:structuredClone(row)};}
function indexes(record){
 if(!record)return {};const row=record.row,out={};
 for(const scope of scopes(record.ownerUid)){
  const date=Model.day(row.date);
  if(date){const sort=String(99999999-Number(date.replaceAll('-',''))).padStart(8,'0')+'_'+Buffer.from(row.key).toString('hex');out[ROOT+'/document/'+scope+'/'+sort]={key:row.key,date,sort,number:row.number,client:row.client,status:row.status,ownerUid:row.ownerUid,amountCents:null};}
  const month=monthBucket(row);if(month)out[ROOT+'/monthMembers/'+scope+'/'+month+'/'+row.key]=true;
  if(row.admits){out[ROOT+'/noticeStatus/'+scope+'/'+stable(row.status)+'/'+row.key]=row;
   if(row.dueDay)out[ROOT+'/noticeDue/'+scope+'/'+row.dueDay+'/'+row.key]=row;
   if(row.sentDay&&row.status==='enviado'&&row.dueDay)out[ROOT+'/noticeSent/'+scope+'/'+row.sentDay+'/'+row.key]=row;
  }
 }
 return out;
}
function set(root,path,value){const keys=path.split('/');let node=root;for(const key of keys.slice(0,-1))node=node[key]??={};node[keys.at(-1)]=structuredClone(value);}
function bootstrap({model,records}={}){
 check(model?.schema===1&&model.proposal===true&&model.complete===true&&model.activationAuthorized===false&&object(records)&&model.sourceCount===Object.keys(records).length&&Object.keys(model.entries).length===Object.keys(records).length,'Complete offline bootstrap is required');
 const tree={sources:{},stats:{},scopeProof:{},months:{},monthProof:{},policy:{hash:model.policyHash}},coverage={schema:1,ready:true,generation:model.generation,revision:model.revision,offsetMinutes:model.offsetMinutes,policyHash:model.policyHash,records:0,unresolvedOwners:0,sourceAccumulator:'0'.repeat(64),scopeAbsenceIsZero:true};
 for(const [id,original]of Object.entries(records)){
  check(key(id)&&object(original),'Invalid bootstrap record');const row=model.entries[id];validateRow(row,id,original,row?.ownerUid);const record=source(id,original,row);tree.sources[id]=record;coverage.records++;coverage.unresolvedOwners+=Number(!row.ownerUid);coverage.sourceAccumulator=sumHash(coverage.sourceAccumulator,stable([id,record.sourceHash]),1);
  for(const scope of scopes(row.ownerUid)){const stats=tree.stats[scope]??={schema:1,generation:model.generation,revision:model.revision,...zero()};for(const field of fields)stats[field]+=counts(row)[field];}
  for(const scope of scopes(row.ownerUid)){const bucket=monthBucket(row);if(bucket){const stats=(tree.months[scope]??={})[bucket]??={schema:1,generation:model.generation,revision:model.revision,records:0,converted:0};stats.records++;stats.converted+=Number(row.status==='convertido');}}
  for(const [path,value]of Object.entries(indexes(record)))set(tree,path.slice(ROOT.length+1),value);
 }
 tree.stats.all??={schema:1,generation:model.generation,revision:model.revision,...zero()};for(const [scope,stats]of Object.entries(tree.stats)){validateStats(stats,model.generation);tree.scopeProof[scope]=stable(stats);}tree.coverage=coverage;
 for(const [scope,buckets]of Object.entries(tree.months))for(const [bucket,stats]of Object.entries(buckets))(tree.monthProof[scope]??={})[bucket]=stable(stats);
 return {proposal:true,activationAuthorized:false,originalWrites:0,patch:{[ROOT]:tree}};
}
function ownerAfter(original,previous){
 const direct=Object.hasOwn(original,'responsableUid')||['creadaPorUid','creadoPorUid','usuarioUid','empleadoUid'].some(k=>original[k]);
 if(direct)return Own.owner(original,'presupuestos',[])||'';
 if(!['creadoPor','usuario','empleado'].some(k=>original[k]))return '';
 check(previous&&previous.ownershipHash===ownershipHash(original),'New or changed legacy owner needs explicit reconciliation');return previous.ownerUid;
}
async function plan({patch,raw,get,generation,revision,beforeCommit,projectRecord}={}){
 check(object(patch)&&typeof raw==='function'&&typeof get==='function'&&typeof beforeCommit==='function'&&key(generation)&&Number.isSafeInteger(revision)&&revision>=1,'Missing guard-bound planner contract');
 const paths=Object.keys(patch);
 check(!paths.some(p=>p===''||[ORIGINAL,...AUTHORITY].some(root=>root.startsWith(p+'/'))),'Parent replacement intersects maintained originals or authority');
 check(!paths.some(p=>p===ROOT||p.startsWith(ROOT+'/')||ROOT.startsWith(p+'/')),'Caller cannot write proposed derived metadata');
 const authorityChange=paths.some(p=>AUTHORITY.some(root=>p===root||p.startsWith(root+'/'))),ids=new Set();
 for(const path of paths)if(path===ORIGINAL||path.startsWith(ORIGINAL+'/')){const parts=path.split('/');check(parts.length>=3&&key(parts[2]),'Individual budget originals required');ids.add(parts[2]);}
 if(!authorityChange&&!ids.size)return {patch:{},maintained:false,activationAuthorized:false};
 const coverage=await raw(ROOT+'/coverage'),ready=coverage?.ready===true||authorityChange&&coverage?.ready===false&&coverage?.requiresReconciliation===true;check(object(coverage)&&coverage.schema===1&&ready&&coverage.generation===generation&&coverage.revision===revision&&coverage.scopeAbsenceIsZero===true&&Number.isSafeInteger(coverage.records)&&coverage.records>=0&&Number.isSafeInteger(coverage.unresolvedOwners)&&coverage.unresolvedOwners>=0&&/^[a-f0-9]{64}$/.test(coverage.sourceAccumulator||'')&&/^[a-f0-9]{64}$/.test(coverage.policyHash||''),'Coverage is incomplete or stale');
 check(Number.isInteger(coverage.offsetMinutes)&&Math.abs(coverage.offsetMinutes)<=840,'Offset metadata is incomplete');
 const policy=await raw(ROOT+'/policy');check(policy?.hash===coverage.policyHash,'Authority policy needs reconciliation');const next=structuredClone(coverage),derived={},captured=[];
 const revisionNext=revision+1;check(Number.isSafeInteger(revisionNext),'Revision exhausted');
 beforeCommit(async({readFresh})=>{check(stable(await readFresh(ROOT+'/coverage'))===stable(coverage)&&stable(await readFresh(ROOT+'/policy'))===stable(policy),'Coverage/policy changed before commit');for(const [path,hash]of captured)check(stable(await readFresh(path))===hash,'Original changed before commit');});
 if(authorityChange){derived[ROOT+'/coverage']={...next,ready:false,revision:revisionNext,requiresReconciliation:true};return {patch:derived,maintained:false,requiresReconciliation:true,activationAuthorized:false};}
 const deltas=new Map(),monthDeltas=new Map();
 for(const id of ids){
  const path=ORIGINAL+'/'+id,sourcePath=ROOT+'/sources/'+id,[beforeRaw,afterRaw,storedPrevious]=await Promise.all([raw(path),get(path),raw(sourcePath)]),before=normalizeRtdb(beforeRaw),after=normalizeRtdb(afterRaw),previous=storedPrevious?{...storedPrevious,row:{ts:null,dueDay:null,sentDay:null,amount:null,...storedPrevious.row}}:null;captured.push([path,stable(before)],[sourcePath,stable(storedPrevious)]);
  check((previous?.sourceHash??stable(null))===stable(before)&&(!before||previous?.ownershipHash===ownershipHash(before)),'Original before hash is not covered');
  if(before){validateRow(previous?.row,id,before,previous?.ownerUid);Evidence.validate(previous.ownerEvidence);check(stable(previous.ownerEvidence)===stable(Evidence.fromRecord(before,'presupuestos'))&&ownerAfter(before,previous)===previous.ownerUid,'Stored ownership no longer matches its source');}
  if(stable(before)===stable(after))continue;let record=null;
  if(after!==null){check(object(after)&&typeof projectRecord==='function','An explicit shared point-row codec is required');if(!previous)check(Object.hasOwn(after,'responsableUid')&&Own.owner(after,'presupuestos',[]),'A new budget needs the canonical owner already resolved by the existing writer protocol');const owner=ownerAfter(after,previous),row=validateRow(await projectRecord({key:id,original:structuredClone(after),ownerUid:owner,offsetMinutes:coverage.offsetMinutes}),id,after,owner);record=source(id,after,row);}
  derived[ROOT+'/sources/'+id]=record;
  for(const [old,sign]of [[previous,-1],[record,1]])if(old){next.records+=sign;next.unresolvedOwners+=sign*Number(!old.ownerUid);next.sourceAccumulator=sumHash(next.sourceAccumulator,stable([id,old.sourceHash]),sign);for(const scope of scopes(old.ownerUid)){const delta=deltas.get(scope)||zero();for(const field of fields)delta[field]+=sign*counts(old.row)[field];deltas.set(scope,delta);}}
  for(const [old,sign]of [[previous,-1],[record,1]])if(old)for(const scope of scopes(old.ownerUid)){const bucket=monthBucket(old.row);if(bucket){const path=scope+'/'+bucket,delta=monthDeltas.get(path)||{records:0,converted:0};delta.records+=sign;delta.converted+=sign*Number(old.row.status==='convertido');monthDeltas.set(path,delta);}}
  const beforeIndexes=indexes(previous),afterIndexes=indexes(record);for(const path of new Set([...Object.keys(beforeIndexes),...Object.keys(afterIndexes)]))if(stable(beforeIndexes[path]??null)!==stable(afterIndexes[path]??null))derived[path]=afterIndexes[path]??null;
 }
 if(!Object.keys(derived).length)return {patch:{},maintained:true,activationAuthorized:false};
 for(const [scope,delta]of deltas){const path=ROOT+'/stats/'+scope,[stored,proof]=await Promise.all([raw(path),raw(ROOT+'/scopeProof/'+scope)]);let stats=stored;
  captured.push([path,stable(stored)],[ROOT+'/scopeProof/'+scope,stable(proof)]);
  if(scope==='all')check(stats!==null&&stats.records===coverage.records,'Global counters do not match coverage');
  if(stats===null){check(proof===null&&delta.records>0,'Missing scope is not a certified new scope');stats={schema:1,generation,revision,...zero()};}else{validateStats(stats,generation);check(stats.revision<=revision&&proof===stable(stats),'Scope metadata proof mismatched');}
  const result={...stats,revision:revisionNext};for(const field of fields)result[field]+=delta[field];validateStats(result,generation);derived[path]=result;derived[ROOT+'/scopeProof/'+scope]=stable(result);
 }
 for(const [bucket,delta]of monthDeltas){const path=ROOT+'/months/'+bucket,proofPath=ROOT+'/monthProof/'+bucket,[stored,proof]=await Promise.all([raw(path),raw(proofPath)]);let stats=stored;captured.push([path,stable(stored)],[proofPath,stable(proof)]);
  if(stats===null){check(proof===null&&delta.records>0,'Month bucket is not a new certified bucket');stats={schema:1,generation,revision,records:0,converted:0};}else check(stats.schema===1&&stats.generation===generation&&Number.isSafeInteger(stats.revision)&&stats.revision>=1&&stats.revision<=revision&&proof===stable(stats),'Month bucket proof mismatched');
  const result={...stats,revision:revisionNext,records:stats.records+delta.records,converted:stats.converted+delta.converted};check(Number.isSafeInteger(result.records)&&Number.isSafeInteger(result.converted)&&result.records>=0&&result.converted>=0&&result.converted<=result.records,'Month bucket counts invalid');derived[path]=result;derived[proofPath]=stable(result);
 }
 check(next.records>=0&&next.unresolvedOwners>=0&&next.unresolvedOwners<=next.records,'Global coverage counts inconsistent');next.revision=revisionNext;derived[ROOT+'/coverage']=next;
 return {patch:derived,maintained:true,activationAuthorized:false,originalWrites:0,recovery:'existing-sv_labor_receipts'};
}
module.exports={ROOT,bootstrap,plan};
