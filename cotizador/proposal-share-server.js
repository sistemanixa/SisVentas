'use strict';
const crypto=require('node:crypto'),Model=require('./proposal-share-model');
const KEY=/^[A-Za-z0-9_-]{1,128}$/,TOKEN=/^[A-Za-z0-9_-]{43}$/;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,keys)=>object(v)&&Object.keys(v).every(k=>keys.includes(k));
const fail=(statusCode,message,code='PROPOSAL_SHARE_UNAVAILABLE')=>Object.assign(Error(message),{statusCode,code});
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(object(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
function validKey(value){return typeof value==='string'&&KEY.test(value)&&!['__proto__','prototype','constructor'].includes(value);}
async function batch(values,work){const out=[];for(let i=0;i<values.length;i+=4)out.push(...await Promise.all(values.slice(i,i+4).map((value,j)=>work(value,i+j))));return out;}
function clientRefs(record){return ['clienteFbKey','clienteKey','clienteId','idCliente'].map(k=>record?.[k]).filter(validKey);}
function actorValid(actor){if(!object(actor)||!validKey(actor.uid)||actor.allowed===false||actor.viewing===true)throw fail(403,'No tenés permiso para compartir estas propuestas.','PROPOSAL_SHARE_FORBIDDEN');return actor;}
function tokenOf(body){if(!exact(body,['token'])||typeof body.token!=='string'||!TOKEN.test(body.token)||Buffer.from(body.token,'base64url').toString('base64url')!==body.token)throw fail(400,'El enlace no es válido.','PROPOSAL_SHARE_INPUT');return body.token;}
function createProposalShare({authorize,readBudget,store,now=Date.now,randomBytes=crypto.randomBytes,buildProposal=Model.buildPublicProposal}={}){
 if(typeof authorize!=='function'||typeof readBudget!=='function'||typeof buildProposal!=='function'||!store||!['create','read','revoke'].every(k=>typeof store[k]==='function'))throw Error('Authenticated reader and atomic share store required');
 function clock(){const at=now();if(!Number.isSafeInteger(at)||at<0)throw fail(503,'No se pudo comprobar la vigencia del enlace.');return at;}
 async function create(identity,body){
  if(!exact(body,['budgetKeys','exchangeRate','exchangeLabel','ttlHours'])||!Array.isArray(body.budgetKeys)||!body.budgetKeys.length||body.budgetKeys.length>12||body.budgetKeys.some(k=>!validKey(k))||new Set(body.budgetKeys).size!==body.budgetKeys.length||typeof body.exchangeRate!=='number'||!Number.isFinite(body.exchangeRate)||body.exchangeRate<=0||body.exchangeRate>1e9||typeof body.exchangeLabel!=='string'||!body.exchangeLabel.trim()||body.exchangeLabel.length>160)throw fail(400,'Elegí entre 1 y 12 propuestas del mismo cliente.','PROPOSAL_SHARE_INPUT');
  const ttl=body.ttlHours===undefined?24:body.ttlHours;if(!Number.isInteger(ttl)||ttl<1||ttl>168)throw fail(400,'La vigencia debe ser entre 1 y 168 horas.','PROPOSAL_SHARE_INPUT');
  const actor=actorValid(await authorize(identity,'create',{budgetKeys:[...body.budgetKeys]}));
  const records=await batch(body.budgetKeys,key=>readBudget(identity,key));
  if(records.some(r=>!object(r)||r.eliminado===true||r._svListSummary||r._svPagedSummary))throw fail(409,'No se pudieron consultar todas las propuestas completas.');
  // Every proposal must have one actual common customer reference. A display
  // name, or a chain of unrelated aliases, never proves client membership.
  let refs=clientRefs(records[0]);for(const record of records.slice(1))refs=refs.filter(ref=>clientRefs(record).includes(ref));if(!refs.length)throw fail(409,'Elegí propuestas del mismo cliente.');
  const options={exchangeRate:body.exchangeRate,exchangeLabel:body.exchangeLabel};
  const proposals=records.map(r=>Model.publicProposal(buildProposal(r,options)));
  if(Buffer.byteLength(JSON.stringify(proposals),'utf8')>512*1024)throw fail(413,'Las propuestas superan el tamaño permitido.');
  await batch(body.budgetKeys,async(key,i)=>{const latest=await readBudget(identity,key);if(canonical(latest)!==canonical(records[i]))throw fail(409,'Una propuesta cambió. Volvé a seleccionarlas.','PROPOSAL_SHARE_CONFLICT');});
  const fresh=actorValid(await authorize(identity,'create',{budgetKeys:[...body.budgetKeys]}));if(canonical(fresh)!==canonical(actor))throw fail(403,'Los permisos cambiaron. Volvé a ingresar.','PROPOSAL_SHARE_FORBIDDEN');
  const createdAt=clock(),expiresAt=createdAt+ttl*3600000;if(!Number.isSafeInteger(expiresAt))throw fail(503,'No se pudo comprobar la vigencia del enlace.');
  for(let attempt=0;attempt<3;attempt++){
   const bytes=randomBytes(32);if(!Buffer.isBuffer(bytes)||bytes.length!==32)throw fail(503,'No se pudo crear un enlace seguro.');const token=bytes.toString('base64url'),id=hash(token);
   // create must be atomic create-if-absent. The opaque token is returned once,
   // never persisted, logged, or included in the stored public snapshot.
   if(await store.create(id,{schema:1,createdBy:actor.uid,createdAt,expiresAt,revokedAt:null,proposals})){
    // The capability is not released until authorization is confirmed after
    // storage. A failed/changed authority retires this unissued snapshot.
    try{const confirmed=actorValid(await authorize(identity,'create',{budgetKeys:[...body.budgetKeys]}));if(canonical(confirmed)!==canonical(actor))throw fail(403,'Los permisos cambiaron. Volvé a ingresar.','PROPOSAL_SHARE_FORBIDDEN');if(clock()>=expiresAt)throw fail(503,'La preparación del enlace demoró demasiado.');}
    catch(error){try{await store.revoke(id,{createdBy:actor.uid,at:clock(),by:actor.uid});}catch{}throw error;}
    return {ok:true,schema:1,token,expiresAt,count:proposals.length};
   }
  }
  throw fail(503,'No se pudo crear el enlace. Volvé a intentar.');
 }
 async function read(body){
  const id=hash(tokenOf(body)),record=await store.read(id),at=clock();
  if(!object(record)||record.schema!==1||!Number.isSafeInteger(record.expiresAt)||!Number.isSafeInteger(record.createdAt)||record.createdAt>at||record.expiresAt<=at||record.expiresAt-record.createdAt>168*3600000||record.revokedAt!==null||!Array.isArray(record.proposals)||!record.proposals.length||record.proposals.length>12)throw fail(410,'Este enlace venció o fue desactivado.');
  const proposals=record.proposals.map(Model.publicProposal);if(Buffer.byteLength(JSON.stringify(proposals),'utf8')>512*1024)throw fail(410,'Este enlace no está disponible.');
  return {ok:true,schema:1,expiresAt:record.expiresAt,proposals};
 }
 async function revoke(identity,body){
  const id=hash(tokenOf(body)),actor=actorValid(await authorize(identity,'revoke')),record=await store.read(id);
  if(!object(record)||record.schema!==1||!validKey(record.createdBy))throw fail(404,'El enlace no está disponible.');
  if(record.createdBy!==actor.uid&&actor.role!=='admin'&&actor.rol!=='admin')throw fail(403,'No tenés permiso para desactivar este enlace.','PROPOSAL_SHARE_FORBIDDEN');
  const fresh=actorValid(await authorize(identity,'revoke'));if(canonical(fresh)!==canonical(actor))throw fail(403,'Los permisos cambiaron. Volvé a ingresar.','PROPOSAL_SHARE_FORBIDDEN');
  if(!await store.revoke(id,{createdBy:record.createdBy,at:clock(),by:actor.uid}))throw fail(409,'El enlace cambió. Volvé a intentar.','PROPOSAL_SHARE_CONFLICT');
  return {ok:true,revoked:true};
 }
 return Object.freeze({create,read,revoke});
}
module.exports=Object.freeze({createProposalShare,hashToken:hash});
