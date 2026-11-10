'use strict';
const {digest}=require('./labor-guard'),Policy=require('./ot-lifecycle-policy'),Index=require('./record-list-model'),Model=require('./ot-delivery-model'),{normalizeRtdb}=require('./payment-membership-index');
const fail=(statusCode,message,code='SV_OT_DELIVERY_NOT_READY')=>Object.assign(Error(message),{statusCode,code});
function createOTDelivery({store,guard,enabled=false,commercialPages=false,now=Date.now}){
 async function protocol(read){
  const [labor,operational,records]=await Promise.all(['sv_labor_config','sv_operational_read_config','sv_record_list_config'].map(read)),proof=await store.verifyOTDeliveryFence?.();
  // Delivery uses the deployed operational writer and its certified OT index.
  // It does not require enabling unrelated financial/history writers.
  if(!enabled||labor?.otLifecycleVersion!==1||[labor,operational,records].some(c=>c?.schema!==1||c.ready!==true)||typeof operational.generation!=='string'||!operational.generation||proof?.verified!==true||proof.schema!==1||proof.canonicalOT!==true||proof.inventory!==true||!/^[a-f0-9]{64}$/.test(proof.rulesDigest||''))throw fail(503,'La entrega requiere el protocolo conjunto de OT y stock verificado.');
  let pages=null;
  if(commercialPages){const [config,coverage]=await Promise.all(['sv_commercial_pages_config','sv_commercial_pages/v1/coverage'].map(read));if(config?.schema!==1||config.ready!==true||typeof config.generation!=='string'||!config.generation||coverage?.schema!==1||coverage.ready!==true||coverage.generation!==config.generation||!Number.isSafeInteger(coverage.revision)||coverage.revision<0)throw fail(503,'El listado comercial todavía no está preparado.');pages={config,coverage};}
  return{labor,operational,records,proof,pages};
 }
 async function authority(identity,read){if(!identity?.uid||identity.claims?.uid!==identity.uid||identity.viewing)throw fail(403,'Sesión requerida.');const profile=await read('sv_chat_roles/'+identity.uid),cfg=await read('sv_permisos/'+profile?.rol),reset=await read('sv_access_resets/'+identity.uid);const context=Policy.authority(profile,cfg,'delivery');if(identity.claims.svPasswordChangeRequired||reset?.required||reset?.version!=null&&reset.version!==identity.claims.svAccessVersion)throw fail(403,'Actualizá tu acceso.');return{...context,profile};}
 async function available(identity,{otKey}={}){await protocol(p=>store.read(p));await authority(identity,p=>store.read(p));if(!Model.key(otKey)||!await store.readAsUser('sisventas/ordenes_trabajo/'+otKey,identity))throw fail(409,'La OT no existe.');return{ok:true,ready:true,version:1,atomicStock:true};}
 async function executeInternal(identity,body,started){
  if(!body||Object.keys(body).some(k=>!['id','kind','otKey','expectedOTHash','changes','action'].includes(k))||body.kind!=='delivery'||!Model.key(body.id)||body.id.length<8||!Model.key(body.otKey)||!/^[a-f0-9]{64}$/.test(body.expectedOTHash)||!body.changes||Object.keys(body.changes).some(k=>k!=='entregas')||!Array.isArray(body.changes.entregas)||typeof body.action!=='string'||body.action.length>240)throw fail(400,'Solicitud de entrega inválida.','SV_OT_DELIVERY_INPUT');
  const read=p=>store.read(p);await protocol(read);const auth=await authority(identity,read),path='sisventas/ordenes_trabajo/'+body.otKey,initial=await store.readAsUser(path,identity);if(!initial||!Model.key(initial.ventaFbKey))throw fail(409,'La OT requiere una venta canónica.');
  const actor={uid:identity.uid,claims:identity.claims,mode:'user',...auth,opId:body.id,transportDigest:digest(body),operation:'ot-lifecycle',input:body,otClosed:Index.closed?.(initial)||false};actor.otLifecycle=Policy.issue({uid:actor.uid,otKey:body.otKey,saleKey:initial.ventaFbKey,operationId:body.id,kind:'delivery',...auth});
  started();const result=await guard.run(actor,async scope=>{
   const activation=await protocol(p=>scope.get(p)),current=await scope.getAsUser(path);if(digest(current)!==body.expectedOTHash)throw fail(409,'La OT cambió.','SV_OT_DELIVERY_CONFLICT');
   const tracked=new Map(),pendingReads=new Map(),queries=[],pendingQueries=new Map(),resolvedCodes=new Map();
   async function track(p){if(!pendingReads.has(p))pendingReads.set(p,(async()=>{const v=await scope.get(p);tracked.set(p,v);return v;})());return pendingReads.get(p);}
   async function query(path,field,value){const id=JSON.stringify([path,field,value]);if(!pendingQueries.has(id))pendingQueries.set(id,(async()=>{const rows=await scope.query(path,field,value);queries.push({path,field,value,rows});return rows;})());return pendingQueries.get(id);}
   async function productKey(row){if(Model.key(row?.productoKey))return row.productoKey;const code=row?.cod||row?.codigo;if(typeof code!=='string'||!code.trim())throw fail(409,'El código del material requiere revisión.');if(resolvedCodes.has(code))return resolvedCodes.get(code);const matches={};for(const field of ['codigo','cod'])for(const [key,value]of Object.entries(await query('sisventas/productos',field,code)||{}))matches[key]=value;const keys=Object.keys(matches);if(keys.length!==1||!Model.key(keys[0]))throw fail(409,'El código de producto falta o es ambiguo.','SV_OT_DELIVERY_PRODUCT');resolvedCodes.set(code,keys[0]);return keys[0];}
   if(!body.changes.entregas.length||body.changes.entregas.length>100)throw fail(400,'Selección de entrega inválida.','SV_OT_DELIVERY_INPUT');
   const seen=new Set(),items=body.changes.entregas.map(e=>{if(!e||Object.keys(e).some(k=>!['index','cantidad'].includes(k))||!Number.isInteger(e.index)||e.index<0||seen.has(e.index)||typeof e.cantidad!=='number'||!Number.isFinite(e.cantidad)||e.cantidad<=0)throw fail(400,'Entrega inválida.','SV_OT_DELIVERY_INPUT');seen.add(e.index);return{index:e.index,qty:e.cantidad};}),resolved=structuredClone(current);
   for(const item of items){if(!Number.isInteger(item.index)||item.index<0||!resolved.materiales?.[item.index])throw fail(400,'Ítem de entrega inválido.','SV_OT_DELIVERY_INPUT');resolved.materiales[item.index].productoKey=await productKey(resolved.materiales[item.index]);}
   const selected=items.map(item=>{const row=resolved.materiales[item.index],allocation=Model.allocation(resolved,row);if(!allocation)throw fail(409,'El destino de entrega requiere revisión.');return{product:row.productoKey,allocation};}),products=[...new Set(selected.map(s=>s.product))],destinations=[...new Set(selected.map(s=>s.allocation))],codes=new Set(),catalog={};
   for(let i=0;i<products.length;i+=6)await Promise.all(products.slice(i,i+6).map(async id=>{const product=await track('sisventas/productos/'+id);if(!product)throw fail(409,'El producto ya no existe.','SV_OT_DELIVERY_PRODUCT');catalog[id]=product;}));
   for(const item of items){const row=resolved.materiales[item.index],product=catalog[row.productoKey];for(const code of [row.cod,row.codigo,product.codigo,product.cod])if(typeof code==='string'&&code)codes.add(code);}
   const matchesProduct=m=>products.includes(m.productoKey)||!Model.key(m.productoKey)&&codes.has(m.cod||m.codigo);
   const indexPath=Index.index+'/ordenes_trabajo',index=await scope.get(indexPath),summaries=Index.parseIndex('ordenes_trabajo',index),originals={};
   // Certified complete summary index locates secondary destinations too. Query
   // primary sales independently so omitted index members cannot become zero.
   for(const sale of destinations){const rows=await query('sisventas/ordenes_trabajo','ventaFbKey',sale);for(const id of Object.keys(rows||{}))if(!summaries[id])throw fail(503,'La cobertura de OT está incompleta.');}
   for(const [id,summary]of Object.entries(summaries)){
    const relevant=destinations.includes(summary.ventaFbKey)||(summary.materiales||[]).some(m=>matchesProduct(m)&&(destinations.includes(Model.allocation(summary,m))||Model.allocation(summary,m)===null));if(!relevant)continue;
    if(Object.keys(originals).length>=500)throw fail(503,'Demasiadas custodias para validar de forma acotada.');const original=await track('sisventas/ordenes_trabajo/'+id);if(!original||digest(normalizeRtdb(Index.summary('ordenes_trabajo',original)))!==digest(normalizeRtdb(summary)))throw fail(503,'El resumen de una custodia requiere revisión.');originals[id]=structuredClone(original);for(const row of originals[id].materiales||[])if(matchesProduct(row)&&!Model.key(row.productoKey))row.productoKey=await productKey(row);
   }
   // Legacy inventory without a revision starts at zero in the atomic guard
   // projection. An explicitly invalid revision is never treated as absent.
   if(!originals[body.otKey])throw fail(503,'La OT no está en la cobertura completa.');const inventory={};for(let i=0;i<products.length;i+=6)await Promise.all(products.slice(i,i+6).map(async p=>{inventory[p]=await track('sisventas/inventario_operativo/'+p);if(inventory[p]!=null&&Object.hasOwn(inventory[p],'_svReadRevision')&&(!Number.isSafeInteger(inventory[p]._svReadRevision)||inventory[p]._svReadRevision<0))throw fail(409,'El stock cambió.','SV_OT_DELIVERY_CONFLICT');}));
   const plan=Model.plan({ot:resolved,otKey:body.otKey,items,others:originals,inventory,catalog,actor:{uid:actor.uid,role:auth.role,name:(await scope.get('sv_chat_directorio/'+actor.uid))?.nombre||'Administración'},operationId:body.id,at:now(),atomicStock:true});
   scope.beforeCommit(async({readFresh,readFreshAsUser})=>{const fresh=await authority(identity,readFresh);if(digest(fresh)!==digest(auth))throw fail(403,'Los permisos cambiaron.');const latest=await protocol(readFresh);if(digest(latest)!==digest(activation)||digest(await readFresh(indexPath))!==digest(index)||digest(await readFreshAsUser(path))!==digest(current))throw fail(409,'La fuente de entrega cambió.','SV_OT_DELIVERY_CONFLICT');const checks=[...Array.from(tracked,([p,v])=>async()=>{if(digest(await readFresh(p))!==digest(v))throw fail(409,'La custodia o el stock cambió.','SV_OT_DELIVERY_CONFLICT');}),...queries.map(q=>async()=>{if(digest(await store.query(q.path,q.field,q.value))!==digest(q.rows))throw fail(409,'Cambió el conjunto de OT o productos.','SV_OT_DELIVERY_CONFLICT');})];for(let i=0;i<checks.length;i+=6)await Promise.all(checks.slice(i,i+6).map(check=>check()));});
   const patch={[path]:plan.ot};for(const product of products)patch['sisventas/inventario_operativo/'+product]=plan.inventory[product];
   await scope.update(patch);return{ok:true,committed:true,operationId:body.id,receiptId:body.id,otKey:body.otKey};
  });
  await authority(identity,read);return result;
 }
 async function execute(identity,body){let started=false;try{return await executeInternal(identity,body,()=>{started=true;});}catch(error){if(!started)error.svLaborAttempted=false;throw error;}}
 return{execute,available};
}
module.exports={createOTDelivery};
