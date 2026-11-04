'use strict';
const {digest}=require('./labor-guard'),Model=require('./ot-lifecycle-model'),Policy=require('./ot-lifecycle-policy'),Index=require('./record-list-model'),Assigned=require('./ot-personal-scope'),State=require('./ot-material-state'),Money=require('./commercial-models/commercial-money');
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
function createOTLifecycle({db,store,guard,enabled=false,commercialPages=false,now=Date.now}){
 const delivery=require('./ot-delivery').createOTDelivery({store,guard,enabled,now});
 const read=async path=>(await db.ref(path).get()).val();
 async function activation(){const configs=await Promise.all([read('sv_labor_config'),read('sv_operational_read_config'),read('sv_record_list_config')]);if(!enabled||configs[0]?.otLifecycleVersion!==1||configs.some(c=>c?.schema!==1||c?.ready!==true))throw fail(503,'El nuevo circuito de OT todavía no está habilitado.','SV_OT_LIFECYCLE_DISABLED');if(commercialPages){const [config,coverage]=await Promise.all([read('sv_commercial_pages_config'),read('sv_commercial_pages/v1/coverage')]);if(config?.schema!==1||config.ready!==true||typeof config.generation!=='string'||!config.generation||coverage?.schema!==1||coverage.ready!==true||coverage.generation!==config.generation||!Number.isSafeInteger(coverage.revision)||coverage.revision<0)throw fail(503,'El listado comercial todavía no está preparado.','SV_COMMERCIAL_PAGES_NOT_READY');}}
 async function available(identity,{otKey,kind='custody'}={}){
  if(kind==='delivery')return delivery.available(identity,{otKey});
  await activation();
  if(!identity?.uid||identity.claims?.uid!==identity.uid||!key(otKey)||!['close','custody','return'].includes(kind))throw fail(400,'Solicitud de OT inválida.');
  const profile=await read('sv_chat_roles/'+identity.uid),cfg=await read('sv_permisos/'+profile?.rol),ot=await store.readAsUser('sisventas/ordenes_trabajo/'+otKey,identity);
  if(!ot)throw fail(409,'La OT ya no existe.');const context=Policy.authority(profile,cfg,kind,Model.closed(ot));
  if(['tecnico','tecnico_vendedor'].includes(context.role)){
   const binding=await read('sv_empleado_uid/'+identity.uid),account=key(binding?.perfilFbKey)?await read('sv_usuarios/'+binding.perfilFbKey):null;
   if(!account||account.uid!==identity.uid||account.activo===false||!key(account.empleadoFbKey))throw fail(403,'El vínculo del técnico requiere revisión.');
   const employee=await read('sisventas/empleados/'+account.empleadoFbKey),hasKey=['tecnicoFbKey','empleadoFbKey','tecnicoKey'].some(k=>ot[k]!=null&&String(ot[k]).trim()),directory=!hasKey&&employee?.nombre?await store.query('sisventas/empleados','nombre',employee.nombre):{};
   if(!employee||employee.activo===false||!Assigned.assigned(ot,{...employee,fbKey:account.empleadoFbKey},Object.fromEntries(Object.entries(directory).map(([k,v])=>[k,{...v,fbKey:k}]))))throw fail(403,'La OT no está asignada a tu cuenta.');
  }
  return {ok:true,ready:true,version:1};
 }
 async function executeInternal(identity,body,started){
  await activation();
  if(!identity?.uid||identity.claims?.uid!==identity.uid)throw fail(401,'Sesión requerida.');
  if(!body||typeof body!=='object'||Object.keys(body).some(k=>!['id','otKey','expectedOTHash','kind','changes','action'].includes(k))||!key(body.id)||body.id.length<8||!key(body.otKey)||!/^[a-f0-9]{64}$/.test(body.expectedOTHash)||!['close','custody','return'].includes(body.kind)||typeof body.action!=='string'||body.action.length>240)throw fail(400,'Revisá los datos de la OT.');
  const allowed=body.kind==='close'?['conformidadCliente','nombreConformidad','observacionesCierre']:['materiales','custodiaIniciada','custodiaRendida','custodiaRendidaEn','custodiaRendidaPor'];
  if(!body.changes||typeof body.changes!=='object'||Array.isArray(body.changes)||Object.keys(body.changes).some(k=>!allowed.includes(k)))throw fail(400,'El guardado contiene campos no autorizados.');
  const profile=await read('sv_chat_roles/'+identity.uid),cfg=await read('sv_permisos/'+profile?.rol),otPath='sisventas/ordenes_trabajo/'+body.otKey;
  const initial=await store.readAsUser(otPath,identity);if(!initial)throw fail(409,'La OT ya no existe.');
  const context=Policy.authority(profile,cfg,body.kind,Model.closed(initial));if(!key(initial?.ventaFbKey))throw fail(409,'La OT necesita una venta vinculada inequívoca.');
  const salePath='sisventas/ventas/'+initial.ventaFbKey,actor={uid:identity.uid,claims:identity.claims,mode:'user',...context,otClosed:Model.closed(initial),opId:body.id,transportDigest:digest(body),operation:'ot-lifecycle',input:body};
  actor.otLifecycle=Policy.issue({uid:identity.uid,otKey:body.otKey,saleKey:initial.ventaFbKey,operationId:body.id,kind:body.kind,...context});
  started();const result=await guard.run(actor,async scope=>{
   const tracked=new Map(),queries=[];
   const track=async path=>{const value=await scope.get(path);tracked.set(path,value);return value;};
   const query=async(path,field,value)=>{const rows=await scope.query(path,field,value);queries.push({path,field,value,rows});return rows;};
   const ot=await scope.getAsUser(otPath);if(digest(ot)!==body.expectedOTHash)throw fail(409,'La OT cambió. Volvé a abrirla.');
   const reset=await scope.get('sv_access_resets/'+identity.uid);if(identity.claims.svPasswordChangeRequired||reset?.required||reset?.version!=null&&reset.version!==identity.claims.svAccessVersion)throw fail(403,'Actualizá tu acceso y volvé a ingresar.');
   if(['tecnico','tecnico_vendedor'].includes(context.role)){
    const binding=await track('sv_empleado_uid/'+identity.uid),account=key(binding?.perfilFbKey)?await track('sv_usuarios/'+binding.perfilFbKey):null;
    if(!account||account.uid!==identity.uid||account.activo===false||!key(account.empleadoFbKey))throw fail(403,'El vínculo del técnico requiere revisión.');
    const employee=await track('sisventas/empleados/'+account.empleadoFbKey),hasKey=['tecnicoFbKey','empleadoFbKey','tecnicoKey'].some(k=>ot[k]!=null&&String(ot[k]).trim());
    const directory=!hasKey&&employee?.nombre?await query('sisventas/empleados','nombre',employee.nombre):{};
    if(!employee||employee.activo===false||!Assigned.assigned(ot,{...employee,fbKey:account.empleadoFbKey},Object.fromEntries(Object.entries(directory).map(([k,v])=>[k,{...v,fbKey:k}]))))throw fail(403,'La OT no está asignada a tu cuenta.');
   }
   const sale=await scope.get(salePath),index=await scope.get(Index.index+'/ordenes_trabajo'),others=Index.parseIndex('ordenes_trabajo',index),products={};
   if(!others[body.otKey]||others[body.otKey]._svListRevision!==(ot._svListRevision||0))throw fail(409,'El resumen de la OT requiere actualizarse.');
   const primary=sale?.otId!==body.otKey&&key(sale?.otId)?await track('sisventas/ordenes_trabajo/'+sale.otId):null;
   const rowSource=[...(ot.materiales||[]),...(ot.items||[])];
   for(const m of rowSource){const ref=m.productoKey||m.cod||m.codigo;if(!ref||products[ref])continue;
    if(key(m.productoKey))products[ref]={...(await track('sisventas/productos/'+m.productoKey)||{}),_key:m.productoKey};
    else{const matches=await query('sisventas/productos','codigo',String(m.cod||m.codigo));const rows=Object.entries(matches||{});if(rows.length>1)throw fail(409,'Hay un código de producto ambiguo.');products[ref]=rows.length?{...rows[0][1],_key:rows[0][0]}:{};}
   }
   const inventoryChanges=new Map(),inventoryBefore=new Map();
   const actionAt=new Date(now()).toISOString(),name=(await scope.get('sv_chat_directorio/'+identity.uid))?.nombre||'Usuario';
   let changes=body.changes;
   if(body.kind==='return'){
    const materials=structuredClone(ot.materiales||[]);let count=0;
    for(const m of materials){const qty=Number(m.devueltaPendiente||0);if(!qty)continue;if(!Number.isFinite(qty)||qty<0)throw fail(409,'La cantidad devuelta requiere revisión.');
     const product=products[m.productoKey||m.cod||m.codigo],productKey=product?._key;if(!key(productKey))throw fail(409,'No se identificó el producto devuelto.');
     const path='sisventas/inventario_operativo/'+productKey;
     if(!inventoryChanges.has(path)){const before=await scope.getAsUser(path);if(!before)throw fail(409,'No existe el inventario del producto devuelto.');inventoryBefore.set(path,before);inventoryChanges.set(path,structuredClone(before));}
     const inv=inventoryChanges.get(path),source=m.destinoVenta==='nueva'?m.ventaDestinoFbKey:ot.ventaFbKey||ot.ventaId||ot.id||body.otKey;
     const allocation=String(source||'').replace(/[.#$\[\]\/]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120),owned=inv.asignaciones?.[allocation];
     if(!owned||!Number.isFinite(Number(inv.general||0))||Number(inv.general||0)<0||Number(owned.reservado||0)<qty||Number(inv.reservado||0)<qty)throw fail(409,'La reserva de la devolución requiere revisión.');
     if(m.stockRegistro){const receipt=inv.rendicionesOT?.[m.stockRegistro];if(!receipt||receipt.ot!==body.otKey||receipt.venta!==allocation||Number(receipt.revision)!==Number(m.stockRevision)||Number(receipt.instalada)!==Number(m.instalada||0)||Number(receipt.enReserva||0)<qty||Number(receipt.recibidas||0)!==Number(m.devuelta||0))throw fail(409,'El registro de devolución cambió. Volvé a abrir la OT.');receipt.enReserva=Money.quantitySum([Number(receipt.enReserva),-qty]);receipt.recibidas=Money.quantitySum([Number(receipt.recibidas||0),qty]);}
     inv.reservado=Money.quantitySum([Number(inv.reservado||0),-qty]);owned.reservado=Money.quantitySum([Number(owned.reservado||0),-qty]);inv.general=Money.quantitySum([Number(inv.general||0),qty]);owned.liberado=Money.quantitySum([Number(owned.liberado||0),qty]);owned.ultimaDevolucionEn=Date.parse(actionAt);owned.ventaId=ot.ventaId||owned.ventaId||'';
     m.devuelta=Money.quantitySum([Number(m.devuelta||0),qty]);m.devueltaPendiente=0;m.recibidoEn=Date.parse(actionAt);m.recibidoPor=name;m.estadoCustodia=Number(m.enTecnico||0)>0?'en_tecnico':Money.quantitySum([Number(m.danada||0),Number(m.faltante||0)])>0?'incidencia':Number(m.instalada||0)>0?'rendido':'devuelto';count=Money.quantitySum([count,qty]);
    }
    if(!count)throw fail(409,'No hay devoluciones pendientes en esta OT.');
    changes={materiales:materials};
   }
   if(body.kind!=='return'&&changes?.materiales)for(const transition of Model.materialChanges(ot,changes.materiales,body.kind)){
    if(!transition.needsStockReceipt&&!transition.needsProductBinding)continue;
    const productKey=await State.resolveProduct(transition.target,{read:track,query,source:transition.needsProductBinding?transition.source:null});
    await State.verifyReceipt({ot,otKey:body.otKey,transition,productKey,read:track});
   }
   const plan=Model.plan({before:ot,changes,kind:body.kind,sale,primary,others,products,actor:{uid:identity.uid,name,otKey:body.otKey},at:actionAt,action:body.action});
   scope.beforeCommit(async({readFresh,readFreshAsUser})=>{
    Policy.validate(actor,await readFresh('sv_chat_roles/'+identity.uid),await readFresh('sv_permisos/'+context.role));
    if(digest(await readFreshAsUser(otPath))!==body.expectedOTHash||digest(await readFresh(salePath))!==digest(sale)||digest(await readFresh(Index.index+'/ordenes_trabajo'))!==digest(index))throw fail(409,'La OT, la venta o sus visitas cambiaron. Volvé a abrirla.');
    for(const [path,value]of tracked)if(digest(await readFresh(path))!==digest(value))throw fail(409,'Una fuente de la OT cambió. Volvé a abrirla.');
    for(const [path,value]of inventoryBefore)if(digest(await readFreshAsUser(path))!==digest(value))throw fail(409,'El stock de la devolución cambió. Volvé a abrir la OT.');
    for(const q of queries)if(digest(await store.query(q.path,q.field,q.value))!==digest(q.rows))throw fail(409,'El catálogo o la asignación cambió. Volvé a abrirla.');
   });
   const patch={[otPath]:plan.ot};for(const [path,value]of inventoryChanges)patch[path]=value;for(const [k,v]of Object.entries(plan.saleChanges))patch[salePath+'/'+k]=v;
   await scope.update(patch);return {ok:true,committed:true,operationId:body.id,saleStatus:plan.saleStatus};
  });
  return {...result,ot:await store.readAsUser(otPath,identity)};
 }
 async function execute(identity,body){if(body?.kind==='delivery')return delivery.execute(identity,body);let started=false;try{return await executeInternal(identity,body,()=>{started=true;});}catch(error){if(!started)error.svLaborAttempted=false;throw error;}}
 return {execute,available};
}
module.exports={createOTLifecycle};
