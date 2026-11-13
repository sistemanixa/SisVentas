'use strict';
const {digest}=require('./labor-guard'),Model=require('./ot-lifecycle-model'),Policy=require('./ot-lifecycle-policy'),Index=require('./record-list-model'),Assigned=require('./ot-personal-scope'),State=require('./ot-material-state'),Money=require('./commercial-models/commercial-money');
const Physical=require('./ot-physical-confirmation-model'),Stock=require('./ot-stock-consumption-model'),Rows=require('./ot-material-rows-model'),{normalizeRtdb}=require('./payment-membership-index'),crypto=require('node:crypto');
const fail=(statusCode,message,code)=>Object.assign(Error(message),{statusCode,code});
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
async function batch(values,work){const out=[];for(let i=0;i<values.length;i+=6)out.push(...await Promise.all(values.slice(i,i+6).map((value,j)=>work(value,i+j))));return out;}
function createOTLifecycle({db,store,guard,enabled=false,commercialPages=false,now=Date.now}){
 const delivery=require('./ot-delivery').createOTDelivery({store,guard,enabled,commercialPages,now});
 const read=async path=>(await db.ref(path).get()).val();
 async function activation(readCurrent=read){let pages=null;const configs=await Promise.all([readCurrent('sv_labor_config'),readCurrent('sv_operational_read_config'),readCurrent('sv_record_list_config')]);if(!enabled||configs[0]?.otLifecycleVersion!==1||configs.some(c=>c?.schema!==1||c?.ready!==true))throw fail(503,'El nuevo circuito de OT todavía no está habilitado.','SV_OT_LIFECYCLE_DISABLED');if(commercialPages){const [config,coverage]=await Promise.all([readCurrent('sv_commercial_pages_config'),readCurrent('sv_commercial_pages/v1/coverage')]);if(config?.schema!==1||config.ready!==true||typeof config.generation!=='string'||!config.generation||coverage?.schema!==1||coverage.ready!==true||coverage.generation!==config.generation||!Number.isSafeInteger(coverage.revision)||coverage.revision<0)throw fail(503,'El listado comercial todavía no está preparado.','SV_COMMERCIAL_PAGES_NOT_READY');pages={config,coverage};}return{configs,pages};}
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
  return {ok:true,ready:true,version:1,atomicStock:true};
 }
 async function executeInternal(identity,body,started){
  const activationState=await activation();
  if(!identity?.uid||identity.claims?.uid!==identity.uid||identity.viewing)throw fail(401,'Sesión requerida.');
  if(!body||typeof body!=='object'||Object.keys(body).some(k=>!['id','otKey','expectedOTHash','kind','changes','action'].includes(k))||!key(body.id)||body.id.length<8||!key(body.otKey)||!/^[a-f0-9]{64}$/.test(body.expectedOTHash)||!['close','custody','return'].includes(body.kind)||typeof body.action!=='string'||body.action.length>240)throw fail(400,'Revisá los datos de la OT.');
  const allowed=body.kind==='close'?['conformidadCliente','nombreConformidad','observacionesCierre']:['materiales','custodiaIniciada','custodiaRendida','custodiaRendidaEn','custodiaRendidaPor'];
  if(!body.changes||typeof body.changes!=='object'||Array.isArray(body.changes)||Object.keys(body.changes).some(k=>!allowed.includes(k)))throw fail(400,'El guardado contiene campos no autorizados.');
  const otPath='sisventas/ordenes_trabajo/'+body.otKey,[profile,initial]=await Promise.all([read('sv_chat_roles/'+identity.uid),store.readAsUser(otPath,identity)]),cfg=await read('sv_permisos/'+profile?.rol);
  if(!initial)throw fail(409,'La OT ya no existe.');
  const context=Policy.authority(profile,cfg,body.kind,Model.closed(initial));if(!key(initial?.ventaFbKey))throw fail(409,'La OT necesita una venta vinculada inequívoca.');
  const salePath='sisventas/ventas/'+initial.ventaFbKey,actor={uid:identity.uid,claims:identity.claims,mode:'user',...context,otClosed:Model.closed(initial),opId:body.id,transportDigest:digest(body),operation:'ot-lifecycle',input:body};
  actor.otLifecycle=Policy.issue({uid:identity.uid,otKey:body.otKey,saleKey:initial.ventaFbKey,operationId:body.id,kind:body.kind,...context});
  started();const result=await guard.run(actor,async scope=>{
   // Read the same configuration once under this lease before planning. Later
   // projectors reuse the guard's snapshot instead of fetching it serially.
   if(digest(await activation(p=>scope.get(p)))!==digest(activationState))throw fail(409,'La habilitación del guardado cambió. Volvé a abrir la OT.');
   const tracked=new Map(),pendingReads=new Map(),queries=[],pendingQueries=new Map();
   const track=async path=>{if(!pendingReads.has(path))pendingReads.set(path,(async()=>{const value=await scope.get(path);tracked.set(path,value);return value;})());return pendingReads.get(path);};
   const query=async(path,field,value)=>{const id=JSON.stringify([path,field,value]);if(!pendingQueries.has(id))pendingQueries.set(id,(async()=>{const rows=await scope.query(path,field,value);queries.push({path,field,value,rows});return rows;})());return pendingQueries.get(id);};
   const [ot,reset]=await Promise.all([scope.getAsUser(otPath),scope.get('sv_access_resets/'+identity.uid)]);if(digest(ot)!==body.expectedOTHash)throw fail(409,'La OT cambió. Volvé a abrirla.');
   if(identity.claims.svPasswordChangeRequired||reset?.required||reset?.version!=null&&reset.version!==identity.claims.svAccessVersion)throw fail(403,'Actualizá tu acceso y volvé a ingresar.');
   if(['tecnico','tecnico_vendedor'].includes(context.role)){
    const binding=await track('sv_empleado_uid/'+identity.uid),account=key(binding?.perfilFbKey)?await track('sv_usuarios/'+binding.perfilFbKey):null;
    if(!account||account.uid!==identity.uid||account.activo===false||!key(account.empleadoFbKey))throw fail(403,'El vínculo del técnico requiere revisión.');
    const employee=await track('sisventas/empleados/'+account.empleadoFbKey),hasKey=['tecnicoFbKey','empleadoFbKey','tecnicoKey'].some(k=>ot[k]!=null&&String(ot[k]).trim());
    const directory=!hasKey&&employee?.nombre?await query('sisventas/empleados','nombre',employee.nombre):{};
    if(!employee||employee.activo===false||!Assigned.assigned(ot,{...employee,fbKey:account.empleadoFbKey},Object.fromEntries(Object.entries(directory).map(([k,v])=>[k,{...v,fbKey:k}]))))throw fail(403,'La OT no está asignada a tu cuenta.');
   }
   const [sale,index,directory]=await Promise.all([scope.get(salePath),scope.get(Index.index+'/ordenes_trabajo'),scope.get('sv_chat_directorio/'+identity.uid)]),others=Index.parseIndex('ordenes_trabajo',index),products={};
   if(!others[body.otKey]||others[body.otKey]._svListRevision!==(ot._svListRevision||0))throw fail(409,'El resumen de la OT requiere actualizarse.');
   const primary=sale?.otId!==body.otKey&&key(sale?.otId)?await track('sisventas/ordenes_trabajo/'+sale.otId):null;
   const rowSource=[...(ot.materiales||[]),...(ot.items||[])];
   await batch(rowSource,async m=>{const ref=m.productoKey||m.cod||m.codigo;if(!ref||products[ref])return;
    if(key(m.productoKey))products[ref]={...(await track('sisventas/productos/'+m.productoKey)||{}),_key:m.productoKey};
    else{const matches=await query('sisventas/productos','codigo',String(m.cod||m.codigo));const rows=Object.entries(matches||{});if(rows.length>1)throw fail(409,'Hay un código de producto ambiguo.');products[ref]=rows.length?{...rows[0][1],_key:rows[0][0]}:{};}
   });
   const inventoryChanges=new Map(),inventoryBefore=new Map();
   const actionAt=new Date(now()).toISOString(),name=directory?.nombre||'Usuario';
   let changes=structuredClone(body.changes);
   if(body.kind==='custody'&&changes.materiales){
    // All stock changes are planned under the same lease as the OT. A complete
    // certified OT index locates custody; full originals supply the quantities.
    const transitions=Model.materialChanges(ot,changes.materiales,'custody'),cache=new Map();
    const resolve=async row=>{const signature=JSON.stringify([row.productoKey||null,row.cod||row.codigo||null]);if(!cache.has(signature))cache.set(signature,await State.resolveProduct(row,{read:track,query}));return cache.get(signature);};
    const changed=(await batch(transitions,async(t,i)=>{
     if(!t.needsStockReceipt)return null;
     const productKey=await State.resolveProduct(t.target,{read:track,query,source:t.needsProductBinding?t.source:null}),product=await track('sisventas/productos/'+productKey);
     if(Model.service(t.target,product))throw fail(409,'La instalación física no admite servicios ni mano de obra.');
     const pending=t.row.stockPendiente===true,before=Number(pending?t.row.stockBaseInstalada:t.row.instalada??0),target=Number(t.target.instalada??0);
     if(pending&&(!Number.isFinite(t.row.stockBaseInstalada)||t.row.stockBaseInstalada<0||t.row.stockBaseInstalada>Number(t.row.instalada)||target!==Number(t.row.instalada)))throw fail(409,'El consumo pendiente requiere una base original verificable.');
     if(before===target)return null;
     return{i,t,productKey,before,target,allocation:require('./ot-delivery-model').allocation(ot,t.target)};
    })).filter(Boolean);
    const originals=new Map([[body.otKey,ot]]);
    if(changed.length){
     // Query each destination as a second coverage check: an omitted member
     // must never be interpreted as an empty reservation.
     for(const sale of new Set(changed.map(c=>c.allocation))){if(!key(sale))throw fail(409,'El destino de instalación requiere revisión.');for(const id of Object.keys(await query('sisventas/ordenes_trabajo','ventaFbKey',sale)||{}))if(!others[id])throw fail(503,'La cobertura de custodia está incompleta.');}
     const codes=new Set(changed.map(c=>c.t.target.cod||c.t.target.codigo)),productKeys=new Set(changed.map(c=>c.productKey)),destinations=new Set(changed.map(c=>c.allocation));
     const related=[];for(const [id,summary]of Object.entries(others)){
      if(id===body.otKey)continue;
      if(!destinations.has(summary.ventaFbKey)&&!(summary.materiales||[]).some(m=>(productKeys.has(m.productoKey)||codes.has(m.cod||m.codigo))&&(destinations.has(require('./ot-delivery-model').allocation(summary,m))||require('./ot-delivery-model').allocation(summary,m)===null)))continue;
      related.push([id,summary]);
     }
     if(related.length>=500)throw fail(503,'Demasiadas custodias para comprobar en una operación.');
     const records=await batch(related,async([id,summary])=>{
      const original=await track('sisventas/ordenes_trabajo/'+id);
      if(!original||digest(normalizeRtdb(Index.summary('ordenes_trabajo',original)))!==digest(normalizeRtdb(summary)))throw fail(503,'El resumen de una custodia requiere revisión.');
      return[id,original];
     });for(const[id,original]of records)originals.set(id,original);
     await batch([...new Set(changed.map(c=>'sisventas/inventario_operativo/'+c.productKey))],track);
    }
    // Staged rows matter when two lines of this OT share one product. Earlier
    // planned consumption releases its hold before the next line is planned.
    const stagedRows=Rows.persisted(Rows.view(ot)),plannedRows=new Set(changed.map(c=>c.i));
    for(const c of changed)stagedRows[c.i]=structuredClone(changes.materiales[c.i]);
    for(const c of changed){
     const path='sisventas/inventario_operativo/'+c.productKey;
     if(!inventoryChanges.has(path)){const original=await track(path);inventoryBefore.set(path,original);inventoryChanges.set(path,structuredClone(original));}
     const row=changes.materiales[c.i],source=c.t.row,already=inventoryChanges.get(path)?.rendicionesOT?.[row.stockRegistro];
     // Compatibility with the former client transaction: adopt only a complete
     // receipt already committed for this OT/destination/target. This path does
     // not invent a receipt, regularize or write the inventory a second time.
     if(already&&already.ot===body.otKey&&already.venta===c.allocation&&already.instalada===c.target&&already.revision===row.stockRevision){
      if(!State.receiptBoundToRow({otKey:body.otKey,rowKey:String(c.i),productKey:c.productKey,allocation:c.allocation,row:source,receipt:row.stockRegistro,entry:already}))throw fail(409,'El recibo histórico no identifica esta fila del material.');
      if(row.stockRegistro!==source.stockRegistro&&source.stockRegistro||row.stockRevision!==(source.stockRevision??0)+1&&!(source.stockPendiente===true&&row.stockRevision===source.stockRevision))throw fail(409,'La revisión del consumo aplicado no coincide con el material.');
      await State.verifyReceipt({ot,otKey:body.otKey,transition:c.t,productKey:c.productKey,read:async path=>inventoryChanges.has(path)?inventoryChanges.get(path):track(path),stockExceptionContext:{actor,lease:scope.lease,query,group:[{transition:c.t,rowKey:String(c.i)}],readOriginal:track}});
      stagedRows[c.i]=structuredClone(row);continue;
     }
     let held=0;
     for(const [id,record]of originals){const rows=id===body.otKey?stagedRows:Rows.persisted(Rows.view(record));
      for(let i=0;i<rows.length;i++){const row=rows[i];if(id===body.otKey&&i===c.i)continue;const code=row.cod||row.codigo;if(row.productoKey!==c.productKey&&(!code||code!==c.t.target.cod&&code!==c.t.target.codigo))continue;
       if(await resolve(row)!==c.productKey)continue;
       const allocation=require('./ot-delivery-model').allocation(record,row);if(!allocation)throw fail(409,'Una custodia vinculada tiene destino ambiguo.');if(allocation!==c.allocation)continue;
       State.bounds(row,{unchanged:true});const delivered=Number(row.entregada??0),installed=Number(row.instalada??0),returned=Number(row.devuelta??0);
       if(![delivered,installed,returned].every(n=>Number.isFinite(n)&&n>=0)||Money.quantitySum([installed,returned])>delivered||delivered>0&&row.custodiaActiva!==true)throw fail(409,'Una custodia vinculada requiere revisión.');
       if(installed>0&&!(id===body.otKey&&plannedRows.has(i)))await State.verifyReceipt({ot:record,otKey:id,transition:{target:row},productKey:c.productKey,read:async path=>inventoryChanges.has(path)?inventoryChanges.get(path):track(path)});
       held=Money.quantitySum([held,delivered,-installed,-returned]);
      }
     }
     const original=inventoryChanges.get(path);
     const receipt=source.stockRegistro||crypto.createHash('sha256').update(JSON.stringify([body.otKey,c.i,c.productKey,row.destinoVenta||'original',row.ventaDestinoFbKey||'',row.agregadoEn||''])).digest('hex'),revision=source.stockRevision??0;
     if(row.stockRegistro&&row.stockRegistro!==receipt||row.stockRevision!=null&&row.stockRevision!==revision&&row.stockRevision!==revision+1)throw fail(409,'La referencia de instalación no coincide con el material.');
     let result;
     if(['admin','administrativo'].includes(context.role)&&c.target>c.before){
      try{result=Physical.confirm({kind:'installation',inventory:original,productKey:c.productKey,otKey:body.otKey,rowKey:String(c.i),allocation:c.allocation,beforeDelivered:c.t.recovery?Number(row.entregada):Number(source.entregada??0),targetDelivered:Number(row.entregada??0),beforeInstalled:c.before,targetInstalled:c.target,returned:Number(source.devuelta??0),receipt,revision,heldByOthers:held,actor:{uid:identity.uid,name,role:context.role,allowed:true},operationId:body.id,at:Date.parse(actionAt)});}catch(error){throw fail(409,error.message,'SV_OT_STOCK_CONFIRMATION');}
     }else{
      // Technicians retain consumption authority, but can never create stock.
      // Reversals retain the original ledger's source-preserving semantics.
      if(c.before>0&&!source.stockRegistro)throw fail(409,'La instalación histórica no tiene un recibo inequívoco.');
      if(!original||Number(original.asignaciones?.[c.allocation]?.reservado??0)<held)throw fail(409,'La reserva de otras custodias requiere revisión.');
      const own=Number(original.asignaciones?.[c.allocation]?.reservado??0),free=Math.max(0,Money.quantitySum([own,-held])),delta=Money.quantitySum([c.target,-c.before]);
      if(delta>Money.quantitySum([free,Number(original.general??0)]))throw fail(409,'La instalación requiere confirmación de Administración por diferencia de stock.');
      const input=structuredClone(original);input.asignaciones??={};input.asignaciones[c.allocation]??={reservado:0,consumido:0,liberado:0};input.asignaciones[c.allocation].reservado=free;
      let planned;try{planned=Stock.plan(input,{before:c.before,target:c.target,revision,receipt,allocation:c.allocation,ot:body.otKey,additional:row.adicionalOT===true});}catch(error){throw fail(409,error.message);}
      planned.asignaciones[c.allocation].reservado=Money.quantitySum([planned.asignaciones[c.allocation].reservado,held]);result={inventory:planned,receipt,revision:revision+1};
     }
     inventoryChanges.set(path,result.inventory);row.stockRegistro=result.receipt;row.stockRevision=result.revision;row.stockPendiente=false;stagedRows[c.i]=structuredClone(row);
    }
    for(const [path,value]of inventoryChanges)if(digest(value)===digest(inventoryBefore.get(path)))inventoryChanges.delete(path);
   }
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
   if(body.kind!=='return'&&changes?.materiales){
    const validations=[];
    const resolved=await batch(Model.materialChanges(ot,changes.materiales,body.kind),async(transition,rowIndex)=>{
     if(!transition.needsStockReceipt&&!transition.needsProductBinding)return null;
     const productKey=await State.resolveProduct(transition.target,{read:track,query,source:transition.needsProductBinding?transition.source:null});return{transition,productKey,rowKey:String(rowIndex)};
    });validations.push(...resolved.filter(Boolean));
    await batch(validations,entry=>State.verifyReceipt({ot,otKey:body.otKey,transition:entry.transition,productKey:entry.productKey,read:async path=>inventoryChanges.has(path)?inventoryChanges.get(path):track(path),stockExceptionContext:body.kind==='custody'?{actor,lease:scope.lease,query,group:validations.filter(v=>v.productKey===entry.productKey),readOriginal:track}:undefined}));
   }
   const plan=Model.plan({before:ot,changes,kind:body.kind,sale,primary,others,products,actor:{uid:identity.uid,name,otKey:body.otKey},at:actionAt,action:body.action});
   scope.beforeCommit(async({readFresh,readFreshAsUser})=>{
    const [freshProfile,freshPermissions]=await Promise.all([readFresh('sv_chat_roles/'+identity.uid),readFresh('sv_permisos/'+context.role)]);Policy.validate(actor,freshProfile,freshPermissions);
    const [freshActivation,freshReset]=await Promise.all([activation(readFresh),readFresh('sv_access_resets/'+identity.uid)]);
    if(digest(freshActivation)!==digest(activationState)||digest(freshReset)!==digest(reset))throw fail(409,'La habilitación de guardado o el acceso cambió. Volvé a ingresar.');
    const [freshOT,freshSale,freshIndex]=await Promise.all([readFreshAsUser(otPath),readFresh(salePath),readFresh(Index.index+'/ordenes_trabajo')]);
    if(digest(freshOT)!==body.expectedOTHash||digest(freshSale)!==digest(sale)||digest(freshIndex)!==digest(index))throw fail(409,'La OT, la venta o sus visitas cambiaron. Volvé a abrirla.');
    // The authenticated fresh inventory read proves both the unchanged value
    // and access. Never replace it with an earlier or service-only snapshot.
    for(const[path,value]of inventoryBefore)if(tracked.has(path)&&digest(tracked.get(path))!==digest(value))throw fail(409,'El inventario original cambió durante la planificación.');
    const checks=[...Array.from(tracked).filter(([path])=>!inventoryBefore.has(path)).map(([path,value])=>async()=>{if(digest(await readFresh(path))!==digest(value))throw fail(409,'Una fuente de la OT cambió. Volvé a abrirla.');}),...Array.from(inventoryBefore,([path,value])=>async()=>{if(digest(await readFreshAsUser(path))!==digest(value))throw fail(409,'El stock de la devolución cambió. Volvé a abrir la OT.');}),...queries.map(q=>async()=>{if(digest(await store.query(q.path,q.field,q.value))!==digest(q.rows))throw fail(409,'El catálogo o la asignación cambió. Volvé a abrirla.');})];
    for(let i=0;i<checks.length;i+=6)await Promise.all(checks.slice(i,i+6).map(check=>check()));
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
