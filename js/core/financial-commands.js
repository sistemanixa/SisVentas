(function(root,factory){
 'use strict';const create=factory();
 if(typeof module==='object'&&module.exports)module.exports={create};
 if(root&&!root.SVFinancialCommands)root.SVFinancialCommands=create(root);
})(typeof window==='object'?window:null,function(){
 'use strict';
 const fail=(code,message,statusCode)=>Object.assign(Error(message),{code,...(statusCode?{statusCode,httpStatus:statusCode}:{})});
 const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
 function canonical(value){if(value==null)return'null';if(Array.isArray(value))return'['+value.map(canonical).join(',')+']';if(typeof value==='object')return'{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
 return function create(root){
  let capabilities=null,remembered=new WeakMap();const pending=new Map();
  function capture(){
   const uid=root.currentUserUid,user=root.fbAuth?.currentUser,role=root.currentRole,revision=root.PERMISOS_ROLES?.[role]?.indiceRevision,epoch=root._svOperacionesSesionEpoch||0,view=root._impersonacionOriginal,valid=root.svCapturarContextoOperacion?.();
   function check(){
    if(view||root._impersonacionOriginal)throw fail('SV_LABOR_PREVIEW','Volvé a tu cuenta para guardar.',403);
    if(!uid||!user||user.uid!==uid||root.currentUserUid!==uid||root.fbAuth?.currentUser!==user||root.currentRole!==role||root.PERMISOS_ROLES?.[role]?.indiceRevision!==revision||(root._svOperacionesSesionEpoch||0)!==epoch||valid&&!valid())throw fail('SV_LABOR_SESSION','La sesión cambió. Revisá el estado antes de reintentar.',403);
   }
   check();return {uid,user,role,revision,epoch,check};
  }
  function same(a,b){return a.uid===b.uid&&a.user===b.user&&a.role===b.role&&a.revision===b.revision&&a.epoch===b.epoch;}
  async function network(task,check){
   if(root.SVForegroundSession?.waitVisible)await root.SVForegroundSession.waitVisible();check();
   if(root.navigator?.onLine===false)throw fail('SV_FINANCIAL_OFFLINE','Sin conexión. Reintentá cuando vuelva Internet.',503);
   let release;try{release=root.SVForegroundSession?.holdDatabase?.();return await task();}finally{try{release?.();}catch(_){/* No cambia un acuse confirmado. */}}
  }
  async function request(path,body,session,{capability=false}={}){
   let attempted=false;
   try{
    session.check();const base=String(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,'');
    if(!base||typeof root.fetch!=='function'||typeof root.SVServiceAuth?.headers!=='function')throw fail('SV_FINANCIAL_SERVICE','No se pudo conectar con el guardado seguro.',503);
    const serialized=JSON.stringify(body);if(new TextEncoder().encode(serialized).byteLength>16*1024*1024)throw fail('SV_LABOR_SIZE','El guardado supera el tamaño permitido.',400);
    const headers=await root.SVServiceAuth.headers({'Content-Type':'application/json'});session.check();
    const {response,data}=await network(async()=>{
     attempted=!capability;
     const response=await root.fetch(base+path,{method:'POST',headers,body:serialized,cache:'no-store',...(typeof AbortSignal!=='undefined'&&AbortSignal.timeout?{signal:AbortSignal.timeout(capability?20000:90000)}:{})});
     if(capability&&[404,405].includes(response.status)){await response.body?.cancel?.();return {response,data:null};}
     return {response,data:await response.json().catch(()=>null)};
    },session.check);session.check();
    if(capability&&[404,405].includes(response.status))return {payments:{enabled:false,version:1},adminExpense:{enabled:false,version:1}};
    if(!response.ok||!data||data.ok!==true||!capability&&data.committed!==true)throw fail(data?.code||'SV_LABOR_COMMIT_UNCONFIRMED',data?.mensaje||data?.message||'No se pudo confirmar la operación. Revisá su estado antes de reintentar.',response.status||503);
    return data;
   }catch(error){if(error&&typeof error==='object')error.svLaborAttempted=attempted;throw error;}
  }
  async function flags(session){
   if(capabilities&&same(capabilities.session,session))return capabilities.promise;
   const state={session,promise:null};
   state.promise=request('/laboral/capacidades',{},session,{capability:true}).then(data=>{
    for(const key of ['payments','adminExpense'])if(!data[key]||typeof data[key].enabled!=='boolean'||data[key].version!==1)throw fail('SV_FINANCIAL_CAPABILITIES','No se pudo comprobar la versión del guardado seguro.',503);
    session.check();return {payments:{enabled:data.payments.enabled,version:1},adminExpense:{enabled:data.adminExpense.enabled,version:1}};
   }).catch(error=>{if(capabilities===state)capabilities=null;if(error&&typeof error==='object')error.svLaborAttempted=false;throw error;});
   capabilities=state;return state.promise;
  }
  function uuid(){
   if(typeof root.crypto?.randomUUID==='function')return root.crypto.randomUUID();
   if(typeof root.crypto?.getRandomValues!=='function')throw fail('SV_LABOR_CRYPTO','No se pudo identificar el guardado.',400);
   const bytes=root.crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
   const h=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);
  }
  async function hash(value){
   if(!root.crypto?.subtle)throw fail('SV_LABOR_CRYPTO','No se pudo verificar el guardado.',400);
   const bytes=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));
   return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function command(feature,key,payload,reference,path,project){
   const session=capture(),signature=canonical(payload);
   const previous=reference&&typeof reference==='object'?rememberedAttempt(reference):null;
   let attempt=previous||pending.get(key);
   if(attempt){
    attempt.session.check();
    if(!same(attempt.session,session)||attempt.signature!==signature)throw fail('SV_PAYMENT_ATTEMPT_CHANGED','Hay un intento anterior de guardado. Confirmalo antes de cambiar sus datos.',409);
    if(attempt.promise)return attempt.promise;
   }
   const available=await flags(session);session.check();
   if(!available[feature].enabled)return null;
   // Otro clic pudo completar la consulta de capacidades mientras esperábamos.
   attempt=attempt||(reference&&typeof reference==='object'?rememberedAttempt(reference):null)||pending.get(key);
   if(attempt){attempt.session.check();if(!same(attempt.session,session)||attempt.signature!==signature)throw fail('SV_PAYMENT_ATTEMPT_CHANGED','Hay un intento anterior de guardado. Confirmalo antes de cambiar sus datos.',409);if(attempt.promise)return attempt.promise;}
   const recovery=root.SVLaborWriteRecovery;
   if(typeof recovery?.execute!=='function'||typeof recovery?.assertAvailable!=='function')throw fail('SV_LABOR_RECOVERY','Recargá la aplicación para guardar con confirmación segura.',400);
   if(!attempt){
    recovery.assertAvailable();const body={id:uuid(),...clone(payload)};
    attempt={session,signature,body,path,promise:null};
    pending.set(key,attempt);if(reference&&typeof reference==='object')rememberedStore(reference,attempt);
   }
   const active=attempt;
   // Un mismo objeto/clave comparte también la preparación de hash; no puede
   // producir un segundo envío por un doble clic durante ese await.
   active.promise=(async()=>{
    const digest=await hash(active.body);active.session.check();
    const send=()=>request(active.path,active.body,active.session).then(data=>{project(data);return data;});
    let data=await recovery.execute({uid:active.session.uid,id:active.body.id,digest},send,active.session.check);
    // Recovery conserva sólo uid/id/digest. Una confirmación manual retoma
    // exactamente el mismo comando para hidratar sus registros autorizados.
    while(data?.recovered===true){active.session.check();data=await recovery.execute({uid:active.session.uid,id:active.body.id,digest},send,active.session.check);}
    active.session.check();return project(data);
   })();
   try{return await active.promise;}catch(error){
    // Una consulta explícita puede confirmar que nunca hubo commit. En ese
    // caso un reintento nuevo necesita otro ID, no el tombstone ya rechazado.
    // Recovery mantiene pendiente lo incierto. Sus rechazos terminales son
    // definitivos, salvo el retiro de contexto u otra operación ya pendiente.
    if(!['SV_LABOR_SESSION','SV_LABOR_PREVIEW','SV_LABOR_PENDING_OPERATION','SV_PAYMENT_ATTEMPT_CHANGED'].includes(error?.code)){
     if(error&&typeof error==='object')error.svFinancialRejected=true;
     if(reference&&typeof reference==='object'&&remembered.get(reference)===active)remembered.delete(reference);
    }
    throw error;
   }finally{active.promise=null;if(pending.get(key)===active)pending.delete(key);}
  }
  function rememberedAttempt(reference){return remembered.get(reference);}
  function rememberedStore(reference,attempt){remembered.set(reference,attempt);}
  function rows(data){if(!Array.isArray(data?.resultados)||!data.resultados.length||data.resultados.some(x=>!x?.pago||!x?.venta))throw Object.assign(fail('SV_LABOR_COMMIT_UNCONFIRMED','No se recibieron los registros confirmados del cobro.',503),{svLaborAttempted:true});return data.resultados;}
  function register(opciones){return command('payments','register:'+String(opciones?.grupoPago||''),{kind:'registrar',opciones},opciones,'/cobranzas/operacion',rows);}
  function annul(pagoKey,ventaKey,options={}){return command('payments','annul:'+String(pagoKey),{kind:'anular',pagoKey,ventaKey,motivo:String(options.motivo||''),fecha:String(options.fecha||'')},options,'/cobranzas/operacion',rows);}
  function createExpense(datos,foto,projection='expense-only'){
   const payload={projection,datos,...(foto!=null?{foto}:{})};
   return command('adminExpense','expense:'+canonical(datos),payload,datos,'/laboral/gastos/crear-administrativo',data=>{if(typeof data?.key!=='string'||!data.key)throw Object.assign(fail('SV_LABOR_COMMIT_UNCONFIRMED','No se recibió la clave confirmada del gasto.',503),{svLaborAttempted:true});return {key:data.key};});
  }
  root.document?.addEventListener?.('sisventas:session-ended',()=>{capabilities=null;pending.clear();remembered=new WeakMap();});
  return {register,annul,createExpense};
 };
});
