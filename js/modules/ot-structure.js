(function(root,factory){const create=factory();if(typeof module==='object'&&module.exports)module.exports={create};else root.SVOTStructure=create(root);})(typeof window==='object'?window:null,function(){
'use strict';
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['__proto__','prototype','constructor'].includes(value),kinds=['assignment','client','sale','additionalSales','claim'];
return function create(root){
 const busy=new Set();
 async function run(kind,changes,ot){
  const uid=root.currentUserUid,user=root.fbAuth?.currentUser,role=root.currentRole,epoch=root._svOperacionesSesionEpoch||0,slot=ot?.fbKey||'new';
  function check(){if(!uid||user?.uid!==uid||user!==root.fbAuth?.currentUser||uid!==root.currentUserUid||role!==root.currentRole||epoch!==(root._svOperacionesSesionEpoch||0)||root._impersonacionOriginal)throw Error('La sesión cambió. Volvé a abrir la OT.');}
  check();if(busy.has(slot))throw Error('La OT ya se está guardando.');if(kind!=='create'&&!key(ot?.fbKey))throw Error('Falta la OT original.');
  const base=(root.SISVENTAS_FUNCTIONS?.cotizadorProveedor||'').replace(/\/$/,'');if(!base||!root.SVServiceAuth?.headers||!root.SVLaborWrites?.hash||!root.SVLaborWriteRecovery?.execute)throw Error('El guardado seguro de OT no está disponible.');
  busy.add(slot);try{
   root.SVLaborWriteRecovery.assertAvailable();const response=await root.fetch(base+'/ot/metadata/disponible?kind='+kind+(ot?'&otKey='+encodeURIComponent(ot.fbKey):''),{method:'GET',headers:await root.SVServiceAuth.headers(),cache:'no-store',signal:AbortSignal.timeout(20000)}),ready=await response.json();check();
   if(!response.ok||ready.ok!==true||ready.version!==1)throw Error(ready.mensaje||'No se pudo verificar el circuito de OT.');if(ready.installed===false)return{installed:false};if(ready.installed!==true||ready.ready!==true||ready.kind!==kind)throw Error('La habilitación de OT cambió.');
   if(ot&&(ready.otKey!==ot.fbKey||ready.otRevision!==(ot._svListRevision??0)||!/^[a-f0-9]{64}$/.test(ready.expectedOTHash||'')))throw Error('La OT cambió. Volvé a abrirla.');
   const command={id:root.crypto.randomUUID(),kind,changes,...(ot?{otKey:ot.fbKey,expectedOTHash:ready.expectedOTHash}:{})},digest=await root.SVLaborWrites.hash(command);check();
   const result=await root.SVLaborWriteRecovery.execute({uid,id:command.id,digest},async()=>{const response=await root.fetch(base+'/ot/metadata',{method:'POST',headers:await root.SVServiceAuth.headers({'Content-Type':'application/json'}),body:JSON.stringify(command),cache:'no-store',signal:AbortSignal.timeout(90000)}),data=await response.json();check();if(!response.ok||data.ok!==true||data.committed!==true||data.operationId!==command.id||!key(data.otKey)||ot&&data.otKey!==ot.fbKey)throw Object.assign(Error(data.mensaje||'No se confirmó la OT. Verificá la operación antes de reintentar.'),{svLaborAttempted:data.svLaborAttempted,statusCode:response.status});return data;},check);check();
   if(!key(result.otKey))throw Object.assign(Error('OT confirmada. Consultá la operación para recuperar su identidad.'),{confirmed:true});let current=result.ot;if(!current){current=(await root.fbGet(root.fbRef(root.fbDB,'sisventas/ordenes_trabajo/'+result.otKey))).val();check();}if(!current)throw Object.assign(Error('OT confirmada. Volvé al listado.'),{confirmed:true});return{installed:true,confirmed:true,operationId:command.id,otKey:result.otKey,linksCommitted:result.linksCommitted===true,...(key(result.claimKey)&&result.claim?{claimKey:result.claimKey,claim:result.claim}:{}),ot:{...current,fbKey:result.otKey}};
  }finally{busy.delete(slot);}
 }
 function createOT(draft){
  if(!draft||typeof draft!=='object'||Array.isArray(draft)||draft.estado&&draft.estado!=='pendiente'||draft.progreso!=null&&draft.progreso!==0)throw Error('La creación requiere una OT nueva sin movimientos.');
  const changes={},fields=['fecha','hora','horaFin','duracion','dir','direccion','direccionPersonalizada','descripcion','obs','prioridad','tipoVisita'];for(const field of fields)if(Object.hasOwn(draft,field))changes[field]=draft[field];
  const clientKey=draft.clienteFbKey||draft.clienteKey;if(!key(clientKey))throw Error('Seleccioná la ficha canónica del cliente.');changes.clienteFbKey=clientKey;
  if(draft.tecnicoFbKey)changes.tecnicoFbKey=draft.tecnicoFbKey;else if(draft.tecnico&&draft.tecnico!=='Sin asignar')throw Error('Seleccioná un técnico con identidad canónica.');
  if(draft.ventaFbKey)changes.ventaFbKey=draft.ventaFbKey;else if(draft.ventaId||draft.venta)throw Error('La venta necesita una clave canónica original.');
  if(draft.reclamoFbKey||draft.reclamoKey)changes.reclamoFbKey=draft.reclamoFbKey||draft.reclamoKey;
  changes.materiales=[];if(!changes.ventaFbKey){if(!Array.isArray(draft.materiales))throw Error('Los materiales requieren revisión.');changes.materiales=draft.materiales.map(row=>{if(!row||row.instalada!==0||['entregada','devuelta','devueltaPendiente','enTecnico','danada','faltante'].some(field=>row[field]!=null&&row[field]!==0)||Object.keys(row).some(field=>/^(stock|recibido|entregado|origenMaterialHistorico|_recuperado)/.test(field))||row.custodiaActiva===true)throw Error('La nueva OT no puede heredar entrega ni consumo.');const prices={};for(const field of ['punit','precio','costoUnitarioCompra','costoProveedor','costo'])if(Object.hasOwn(row,field)){if(typeof row[field]!=='number'||!Number.isFinite(row[field])||row[field]<0)throw Error('El precio de referencia no es válido.');prices[field]=row[field];}return{...prices,...(row.productoKey?{productoKey:row.productoKey}:{}),cod:row.cod||row.codigo||'',vendida:row.vendida??row.qty??row.cantidad,instalada:0};});}
  return run('create',changes);
 }
 function relate(ot,kind,changes){if(!kinds.includes(kind)||!changes||typeof changes!=='object'||Array.isArray(changes))throw Error('Relación OT no válida.');return run(kind,structuredClone(changes),ot);}
 return Object.freeze({create:createOT,relate});
};
});
