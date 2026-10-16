'use strict';
const crypto=require('node:crypto'),M=require('./private-finance-model');
const fail=(statusCode,message)=>Object.assign(Error(message),{statusCode});
function createPrivateFinance({auth,db,ownerUid='',enabled=false,documents=null,now=Date.now}){
 const base='sv_personal_finance',read=async p=>(await db.ref(p).get()).val();
 async function authorize(req){
  const token=String(req.headers.authorization||'').match(/^Bearer\s+(\S+)$/i);if(!token)throw fail(401,'Sesión requerida');
  let user;try{user=await auth.verifyIdToken(token[1],true);}catch(_){throw fail(401,'Sesión inválida');}
  if(!enabled||!ownerUid)throw fail(503,'Gastos personales todavía no está habilitado');
  if(user.uid!==ownerUid)throw fail(403,'Espacio privado no disponible');M.key(user.uid);
  const identity=await read('sv_chat_roles/'+user.uid);if(identity?.activo!==true)throw fail(403,'Usuario inactivo');
  // Ver como conserva Auth del administrador. La interfaz lo bloquea además;
  // el servidor nunca acepta identidad, UID propietario ni privilegios del body.
  if(req.headers['x-sisventas-view-as'])throw fail(403,'Volvé a tu sesión propia');
  return {uid:user.uid};
 }
 function safeActor(actor){if(!enabled||!ownerUid||actor?.uid!==ownerUid)throw fail(403,'Espacio privado no disponible');}
 const publicState=state=>{const out=structuredClone(state);delete out.operations;return out;};
 async function get(actor){safeActor(actor);return {state:publicState(M.hydrate(await read(base+'/'+actor.uid),actor.uid))};}
 async function save(actor,command){
  safeActor(actor);if(!command||typeof command!=='object'||Array.isArray(command))throw fail(400,'Operación inválida');
  const stamp=now(),digest=crypto.createHash('sha256').update(JSON.stringify(command)).digest('hex'),ref=db.ref(base+'/'+actor.uid);let error,listener;
  try{
   await new Promise((resolve,reject)=>{listener=()=>resolve();ref.on('value',listener,reject);});
   const result=await ref.transaction(current=>{try{error=null;return M.apply(current,command,actor,{now:stamp,digest}).state;}catch(e){error=e;return;}},undefined,false);
   if(error)throw error;if(!result.committed)throw fail(409,'Resultado no confirmado. Conservá el formulario y reintentá la misma operación');
   return {state:publicState(M.hydrate(result.snapshot.val(),actor.uid)),operationId:command.id};
  }finally{if(listener)ref.off('value',listener);}
 }
 async function upload(actor,body){
  safeActor(actor);if(!documents)throw fail(503,'Almacenamiento privado de documentos sin configurar');
  const name=M.text(body?.name,180,true),encoded=body?.data;
  if(typeof encoded!=='string'||encoded.length>21*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded))throw fail(400,'PDF inválido o demasiado grande');
  const bytes=Buffer.from(encoded,'base64');if(bytes.length===0||bytes.length>15*1024*1024||bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.subarray(-2048).includes(Buffer.from('%%EOF')))throw fail(400,'El archivo no es un PDF válido de hasta 15 MB');
  const hash=crypto.createHash('sha256').update(bytes).digest('hex'),path=actor.uid+'/'+hash+'.pdf';
  await documents.put(path,bytes);
  const document={id:hash,ownerUid:actor.uid,actorUid:actor.uid,name,mime:'application/pdf',size:bytes.length,sha256:hash,createdAt:now(),updatedAt:now(),revision:1};
  const ref=db.ref(base+'/'+actor.uid);let listener;
  try{await new Promise((resolve,reject)=>{listener=()=>resolve();ref.on('value',listener,reject);});
   const result=await ref.transaction(raw=>{const s=M.hydrate(raw,actor.uid);if(s.documents.some(d=>d.id===hash))return s;s.documents.push(document);s.history.unshift({id:hash+'-document',ownerUid:actor.uid,actorUid:actor.uid,at:now(),action:'document-staged',entity:hash,origin:'PDF',changes:[{group:'documents',before:[],after:[document]}]});s.revision++;s.updatedAt=now();if(JSON.stringify(s).length>6e6)return;return s;},undefined,false);
   if(!result.committed)throw fail(409,'No se pudo confirmar el original');
   const s=M.hydrate(result.snapshot.val(),actor.uid);return {document:s.documents.find(x=>x.id===hash),state:publicState(s)};
  }finally{if(listener)ref.off('value',listener);}
 }
 async function download(actor,id){safeActor(actor);M.key(id);if(!documents)throw fail(503,'Almacenamiento privado sin configurar');const s=M.hydrate(await read(base+'/'+actor.uid),actor.uid),meta=s.documents.find(x=>x.id===id);if(!meta)throw fail(404,'Original no disponible');const bytes=await documents.get(actor.uid+'/'+meta.sha256+'.pdf');if(crypto.createHash('sha256').update(bytes).digest('hex')!==meta.sha256)throw fail(503,'No se pudo verificar el original');return {meta,bytes};}
 return {authorize,get,save,upload,download};
}
module.exports={createPrivateFinance};
