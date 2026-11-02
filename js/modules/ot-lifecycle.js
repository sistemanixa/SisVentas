(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports={create:api};else root.SVOTLifecycle=api(root);})(typeof window==='object'?window:null,function(){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v));
const fields={close:['conformidadCliente','nombreConformidad','observacionesCierre'],custody:['materiales','custodiaIniciada','custodiaRendida','custodiaRendidaEn','custodiaRendidaPor'],return:['materiales']};
return function create(root){
 const busy=new Set();
 async function prepare(context,{kind='custody'}={}){
  const uid=root.currentUserUid,user=root.fbAuth?.currentUser,role=root.currentRole,epoch=root._svOperacionesSesionEpoch||0;
  const check=()=>{if(!uid||user?.uid!==uid||root.currentUserUid!==uid||root.fbAuth?.currentUser!==user||root.currentRole!==role||root._impersonacionOriginal||(root._svOperacionesSesionEpoch||0)!==epoch)throw Error('La sesión cambió. Volvé a abrir la OT.');};check();
  const base=(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,'');
  if(!base||!context?.fbKey)throw Error('No está listo el registro de la OT.');
  const headers=await root.SVServiceAuth.headers();check();
  const response=await root.fetch(base+'/ot/ciclo/disponible?otKey='+encodeURIComponent(context.fbKey)+'&kind='+encodeURIComponent(kind),{method:'GET',headers,cache:'no-store',signal:AbortSignal.timeout(20000)});
  const data=await response.json();check();
  if(!response.ok||data.ok!==true||data.ready!==true||data.version!==1)throw Error(data.mensaje||'El circuito de OT está pendiente de habilitar. No se movió stock.');
  return true;
 }
 async function save(context,draft,{kind='custody',action=''}={}){
  if(!context?.fbKey||!fields[kind])throw Error('Falta identificar la operación de la OT.');
  if(busy.has(context.fbKey))throw Error('La OT ya se está guardando.');
  const uid=root.currentUserUid,user=root.fbAuth?.currentUser,role=root.currentRole,epoch=root._svOperacionesSesionEpoch||0;
  const check=()=>{if(!uid||user?.uid!==uid||root.currentUserUid!==uid||root.fbAuth?.currentUser!==user||root.currentRole!==role||root._impersonacionOriginal||(root._svOperacionesSesionEpoch||0)!==epoch)throw Error('La sesión cambió. Volvé a abrir la OT.');};
  check();busy.add(context.fbKey);
  try{
   if(!root.SVLaborWrites?.hash||!root.SVLaborWriteRecovery?.execute||!root.SVServiceAuth?.headers)throw Error('No está listo el guardado del cierre. Recargá la aplicación.');
   root.SVLaborWriteRecovery.assertAvailable();
   const path='sisventas/ordenes_trabajo/'+context.fbKey;
   const original=(await root.fbGet(root.fbRef(root.fbDB,path))).val();check();
   if(!original||(original._svListRevision||0)!==(context._svListRevision||0))throw Error('La OT cambió. Volvé a abrirla antes de guardar.');
   const changes={};for(const key of fields[kind])if(Object.hasOwn(draft,key))changes[key]=clone(draft[key]);
   const command={id:root.crypto.randomUUID(),otKey:context.fbKey,expectedOTHash:await root.SVLaborWrites.hash(original),kind,changes,action:String(action).slice(0,240)};check();
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
