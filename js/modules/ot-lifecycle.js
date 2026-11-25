(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports={create:api};else root.SVOTLifecycle=api(root);})(typeof window==='object'?window:null,function(){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
const fields={close:['conformidadCliente','nombreConformidad','observacionesCierre'],custody:['materiales','custodiaIniciada','custodiaRendida','custodiaRendidaEn','custodiaRendidaPor'],return:['materiales'],delivery:['entregas']};
return function create(root){
 const busy=new Set(),preparations=new WeakMap();
 async function prepare(context,{kind='custody'}={}){
  const uid=root.currentUserUid,user=root.fbAuth?.currentUser,role=root.currentRole,epoch=root._svOperacionesSesionEpoch||0;
  const check=()=>{if(!uid||user?.uid!==uid||root.currentUserUid!==uid||root.fbAuth?.currentUser!==user||root.currentRole!==role||root._impersonacionOriginal||(root._svOperacionesSesionEpoch||0)!==epoch)throw Error('La sesión cambió. Volvé a abrir la OT.');};check();
  const base=(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,'');
  if(!base||!context?.fbKey)throw Error('No está listo el registro de la OT.');
  const headers=await root.SVServiceAuth.headers();check();
  const response=await root.fetch(base+'/ot/ciclo/disponible?otKey='+encodeURIComponent(context.fbKey)+'&kind='+encodeURIComponent(kind),{method:'GET',headers,cache:'no-store',signal:AbortSignal.timeout(20000)});
  const data=await response.json();check();
  if(!response.ok||data.ok!==true||data.ready!==true||data.version!==1)throw Error(data.mensaje||'El circuito de OT está pendiente de habilitar. No se movió stock.');
  const capability=Object.freeze({ready:true,version:data.version,atomicStock:data.atomicStock===true}),revision=context._svListRevision??0,hasSource=['expectedOTHash','otKey','otRevision'].some(key=>Object.hasOwn(data,key));
  if(hasSource&&(!/^[a-f0-9]{64}$/.test(data.expectedOTHash||'')||data.otKey!==context.fbKey||!Number.isSafeInteger(data.otRevision)||data.otRevision<0||data.otRevision!==revision))throw Error('La OT cambió. Volvé a abrirla antes de guardar.');
  preparations.set(capability,{uid,user,role,epoch,otKey:context.fbKey,revision,kind,hash:hasSource?data.expectedOTHash:null,used:false});return capability;
 }
 async function save(context,draft,{kind='custody',action='',prepared}={}){
  if(!context?.fbKey||!fields[kind])throw Error('Falta identificar la operación de la OT.');
  if(busy.has(context.fbKey))throw Error('La OT ya se está guardando.');
  const uid=root.currentUserUid,user=root.fbAuth?.currentUser,role=root.currentRole,epoch=root._svOperacionesSesionEpoch||0;
  const check=()=>{if(!uid||user?.uid!==uid||root.currentUserUid!==uid||root.fbAuth?.currentUser!==user||root.currentRole!==role||root._impersonacionOriginal||(root._svOperacionesSesionEpoch||0)!==epoch)throw Error('La sesión cambió. Volvé a abrir la OT.');};
  check();busy.add(context.fbKey);
  try{
   if(!root.SVLaborWrites?.hash||!root.SVLaborWriteRecovery?.execute||!root.SVServiceAuth?.headers)throw Error('No está listo el guardado del cierre. Recargá la aplicación.');
   root.SVLaborWriteRecovery.assertAvailable();
   const path='sisventas/ordenes_trabajo/'+context.fbKey;
   let expectedOTHash,preparation;
   if(prepared!==undefined){preparation=preparations.get(prepared);if(!preparation||preparation.used||preparation.uid!==uid||preparation.user!==user||preparation.role!==role||preparation.epoch!==epoch||preparation.otKey!==context.fbKey||preparation.revision!==(context._svListRevision??0)||preparation.kind!==kind)throw Error('La preparación de la OT cambió. Volvé a verificar antes de guardar.');preparation.used=true;expectedOTHash=preparation.hash;}
   if(!expectedOTHash){const original=(await root.fbGet(root.fbRef(root.fbDB,path))).val();check();if(!original||(original._svListRevision||0)!==(context._svListRevision||0))throw Error('La OT cambió. Volvé a abrirla antes de guardar.');expectedOTHash=await root.SVLaborWrites.hash(original);check();}
   const changes={};for(const key of fields[kind])if(Object.hasOwn(draft,key))changes[key]=clone(draft[key]);
   const command={id:root.crypto.randomUUID(),otKey:context.fbKey,expectedOTHash,kind,changes,action:String(action).slice(0,240)};check();
   const digest=await root.SVLaborWrites.hash(command);check();
   const send=async()=>{
    const base=(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,'');
    if(!base)throw Object.assign(Error('No está disponible el guardado del cierre.'),{svLaborAttempted:false});
    const headers=await root.SVServiceAuth.headers({'Content-Type':'application/json'});check();
    const response=await root.fetch(base+'/ot/ciclo',{method:'POST',headers,body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(90000)});
    const data=await response.json();check();
    if(!response.ok||data.ok!==true||data.committed!==true||data.operationId!==command.id)throw Object.assign(Error(data.mensaje||data.message||'No se pudo confirmar el cierre. Consultá la operación antes de reintentar.'),{statusCode:response.status,code:data.code,...(data.svLaborAttempted===false?{svLaborAttempted:false}:{})});
    return data;
   };
   root._otGuardandoLocalHasta=Date.now()+15000;
   const result=await root.SVLaborWriteRecovery.execute({uid,id:command.id,digest},send,check);check();
   if(result.saleStatus)try{root.document?.dispatchEvent?.(new root.CustomEvent('sisventas:commercial-write-confirmed'));}catch(_){}
   // La confirmación puede venir del recibo de una respuesta perdida. Releer,
   // sin repetir cierre, recepción ni consumo, conserva la revisión de servidor.
   let current=result.ot;
   if(!current)try{current=(await root.fbGet(root.fbRef(root.fbDB,path))).val();check();}catch(error){check();throw Object.assign(Error('Guardado confirmado. Volvé a abrir la OT para ver los datos actualizados.'),{confirmed:true});}
   if(!current)throw Object.assign(Error('El guardado se confirmó, pero la OT ya no está disponible.'),{confirmed:true});
   const ot=Object.assign({},current,{fbKey:context.fbKey});
   const saleStatus=result.saleStatus;if(saleStatus){const cached=root.obtenerVentasSisVentas?.().find(v=>v.fbKey===saleStatus.saleKey);if(cached)cached.estadoInst=saleStatus.estadoInst;}
   return {confirmed:true,ot,saleStatus};
  }finally{busy.delete(context.fbKey);root._otGuardandoLocalHasta=Date.now()+500;}
 }
 return Object.freeze({save,prepare});
};
});
