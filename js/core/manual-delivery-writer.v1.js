(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVManualDeliveryWriter=api;})(typeof window==='object'?window:null,function(){
 'use strict';
 const fail=(code,message)=>Object.assign(Error(message),{code});
 function canonical(value){
  if(value===null)return 'null';
  if(typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&Object.getPrototypeOf(value)===Object.prototype)return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  throw fail('SV_REMITO_PAYLOAD','Revisá los datos del remito.');
 }
 function create(root){
  const attempts=new WeakMap();
  function recoverySlot(){
   const uid=root.currentUserUid;
   if(!uid||root.fbAuth?.currentUser?.uid!==uid)throw fail('SV_REMITO_CONTEXT','Verificá la sesión antes de consultar el intento pendiente.');
   const reference=root.fbRef(root.fbDB,'sisventas/remitos'),address=String(reference?.toString?.()||'');
   const database=root.fbDB?.app?.options?.databaseURL||root.fbDB?.app?.options?.projectId||address;
   return 'sv.manualDelivery.pending.v2:'+encodeURIComponent(database)+':'+encodeURIComponent(uid);
  }
  const recovery=()=>{const text=root.sessionStorage?.getItem(recoverySlot());return text?JSON.parse(text):null;};
  async function recover(form){
   const actor=capture(),raw=actor.storage?.getItem(actor.slot);
   const metadata=raw?JSON.parse(raw):null;
   if(!metadata)return null;
   const saved=metadata;
   if(saved.uid!==actor.uid||typeof saved.key!=='string'||!saved.key||/[.#$\[\]\/]/.test(saved.key))throw fail('SV_REMITO_RECOVERY_IDENTITY','El intento pendiente pertenece a otra identidad o requiere revisión.');
   if(typeof root.fbGet!=='function')throw fail('SV_REMITO_RECOVERY_AUTHORITY','No se puede verificar el remito pendiente. No crees otro documento.');
   const snapshot=await root.fbGet(root.fbRef(root.fbDB,'sisventas/remitos/'+saved.key));actor.check();
   const record=snapshot.val();
   if(!record||record._svManualDeliveryUid!==actor.uid)throw fail('SV_REMITO_RECOVERY_UNRESOLVED','El documento pendiente no pudo confirmarse. Conservá la referencia y verificá su estado; no se reenviaron datos.');
   const payload={...record};delete payload.ts;delete payload.usuario;delete payload._svManualDeliveryUid;
   attempts.set(form,{uid:actor.uid,body:canonical(payload),key:saved.key,state:'confirmed',record,check:actor.check,slot:actor.slot,storage:actor.storage});
   actor.storage?.removeItem(actor.slot);
   return {key:saved.key,state:'confirmed',recovered:true};
  }
  function capture(){
   const user=root.fbAuth?.currentUser,uid=root.currentUserUid,role=root.currentRole,epoch=root._svOperacionesSesionEpoch,revision=root.PERMISOS_ROLES?.[role]?.indiceRevision;
   const context=root.svCapturarContextoOperacion?.(),database=root.fbDB,slot=recoverySlot(),storage=root.sessionStorage;
   const check=()=>{if(!user||!uid||user.uid!==uid||root.fbDB!==database||recoverySlot()!==slot||root.sessionStorage!==storage||root.fbAuth?.currentUser!==user||root.currentUserUid!==uid||root.currentRole!==role||root._svOperacionesSesionEpoch!==epoch||root.PERMISOS_ROLES?.[role]?.indiceRevision!==revision||root._impersonacionOriginal||context&&!context()||typeof root.permisoModulo!=='function'||!root.permisoModulo('remitos'))throw fail('SV_REMITO_CONTEXT','La sesión o el permiso cambió. Revisá el estado del remito.');};
   check();return {uid,check,slot,storage,database};
  }
  function save(form,payload){
   try{
    if(!form||typeof form!=='object')throw fail('SV_REMITO_FORM','Volvé a abrir el formulario.');
    const actor=capture(),body=canonical(payload);let attempt=attempts.get(form);
    if(attempt&&(attempt.uid!==actor.uid||attempt.body!==body))throw fail('SV_REMITO_CHANGED','El intento tiene otros datos o identidad. Verificá su estado antes de crear otro remito.');
    if(!attempt){
     if(recovery())throw fail('SV_REMITO_RECOVERY_REQUIRED','Hay un remito pendiente de verificar. Recuperá ese intento antes de crear otro.');
     if(!root.fbDB||typeof root.fbRunTransaction!=='function')throw fail('SV_REMITO_AUTHORITY','No está disponible la creación puntual del remito.');
     const key=root.fbPush(root.fbRef(root.fbDB,'sisventas/remitos')).key;
     if(!key||/[.#$\[\]\/]/.test(key))throw fail('SV_REMITO_KEY','No se pudo reservar el remito.');
     attempt={uid:actor.uid,body,key,slot:actor.slot,storage:actor.storage,state:'reserved',record:{...JSON.parse(body),ts:Date.now(),usuario:root.currentUser||'',_svManualDeliveryUid:actor.uid}};
     attempts.set(form,attempt);
     try{const metadata=JSON.stringify({key,uid:actor.uid});attempt.recoverable=false;if(actor.storage){actor.storage.setItem(actor.slot,metadata);if(actor.storage.getItem(actor.slot)!==metadata)throw Error('Storage no confirmó la referencia');attempt.recoverable=true;}}catch(error){attempts.delete(form);throw fail('SV_REMITO_RECOVERY_STORAGE','No se pudo conservar la referencia del remito. No se envió el documento.');}
    }
    attempt.check?.();
    if(attempt.pending)return attempt.pending;
    if(attempt.state==='confirmed')return Promise.resolve({key:attempt.key,state:attempt.state});
    const previouslyUncertain=attempt.state==='uncertain';
    attempt.check=actor.check;attempt.state='pending';
    const expected=canonical(attempt.record);
    attempt.pending=Promise.resolve().then(()=>{
     actor.check();return root.fbRunTransaction(root.fbRef(root.fbDB,'sisventas/remitos/'+attempt.key),current=>{actor.check();return current===null?JSON.parse(expected):undefined;},{applyLocally:false});
    }).then(result=>{
     actor.check();
     if(canonical(result.snapshot.val())!==expected)throw fail('SV_REMITO_CONFLICT','La clave del remito contiene otro documento.');
     attempt.state='confirmed';attempt.storage?.removeItem(attempt.slot);return {key:attempt.key,state:attempt.state,recoverable:attempt.recoverable===true};
    }).catch(error=>{
     const denied=['permission_denied','database/permission-denied','permission-denied'].includes(String(error.code||'').toLowerCase());
     if(denied&&!previouslyUncertain){actor.check();attempt.storage?.removeItem(attempt.slot);attempts.delete(form);throw Object.assign(fail('SV_REMITO_REJECTED','El remito no se guardó porque la operación fue rechazada. Revisá el permiso o reintentá cuando termine la otra operación.'),{cause:error,state:'rejected'});}
     attempt.state='uncertain';throw Object.assign(fail('SV_REMITO_UNCERTAIN','No se confirmó el remito. Conservá este formulario y reintentá para verificar el mismo documento.'),{cause:error,key:attempt.key,state:attempt.state});
    }).finally(()=>{attempt.pending=null;});
    return attempt.pending;
   }catch(error){return Promise.reject(error);}
  }
  return Object.freeze({save,recover,pending:()=>{const saved=recovery();return saved?{key:saved.key,uid:saved.uid}:null;},status:form=>{const attempt=attempts.get(form);return attempt?{key:attempt.key,state:attempt.state,recoverable:attempt.recoverable===true}:null;}});
 }
 return Object.freeze({create});
});
