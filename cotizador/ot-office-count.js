'use strict';
const crypto=require('node:crypto'),{digest}=require('./labor-guard'),Model=require('./ot-office-count-model'),Lifecycle=require('./ot-lifecycle-model'),LifecyclePolicy=require('./ot-lifecycle-policy'),RecordLists=require('./record-list-model');
const fail=(code,message)=>Object.assign(Error(message),{statusCode:code});
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
const clean=v=>String(v||'').trim(),safe=v=>String(v).replace(/[.#$\[\]\/]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120),copy=v=>structuredClone(v);
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
function access(profile,cfg){
 const role=profile?.rol;if(profile?.activo!==true||!['admin','administrativo','vendedor','tecnico_vendedor','tecnico'].includes(role))throw fail(403,'Usuario sin acceso');
 if(cfg&&(cfg.indiceVersion!==2||cfg.indiceModulos?.ordentrabajo!==true||Object.values(cfg.bloqueados||{}).includes('ordentrabajo'))||(typeof cfg?.acciones?.ot?.ajustarStockOficina==='boolean'?!cfg.acciones.ot.ajustarStockOficina:role!=='admin'))throw fail(403,'No tenés permiso para ajustar stock de oficina desde OT.');
 return {role,permissionRevision:cfg?.indiceRevision??null,permissionDigest:digest(cfg||{})};
}
function describe(ot,product,otKey,productKey){
 if(!ot||!Array.isArray(ot.materiales)||!product)throw fail(409,'No se encontró el producto o la OT.');
 const rows=[];for(const [index,m]of ot.materiales.entries()){
  const matches=m.productoKey?m.productoKey===productKey:String(m.cod||m.codigo||'')===String(product.codigo||product.cod||'');if(!matches||m.stockPendiente!==true)continue;
  const before=Number(m.stockBaseInstalada),target=Number(m.instalada),available=Number(m.entregada)-Number(m.devuelta||0)-Number(m.devueltaPendiente||0)-Number(m.danada||0)-Number(m.faltante||0);if(m.adicionalOT!==true||m.stockBaseInstalada==null||!Number.isFinite(before)||before<0||!Number.isFinite(target)||target<=before||!Number.isFinite(available)||target>available)throw fail(409,'El material requiere revisar su instalación antes de contar.');
  const receipt=m.stockRegistro||hash([otKey,index,productKey,m.destinoVenta||'original',m.ventaDestinoFbKey||'',m.agregadoEn||'']);
  const allocation=safe(m.destinoVenta==='nueva'?m.ventaDestinoFbKey:ot.ventaFbKey||ot.ventaId||ot.id||otKey);
  if(!/^[a-f0-9]{64}$/.test(receipt)||!allocation)throw fail(409,'No se pudo identificar el consumo de este ítem.');
  const legacyTotal=ot.materiales.filter(other=>String(other.cod||other.codigo)===String(m.cod||m.codigo)&&String(other.destinoVenta||'original')===String(m.destinoVenta||'original')&&String(other.ventaDestinoFbKey||'')===String(m.ventaDestinoFbKey||'')).reduce((sum,other)=>sum+Number(other===m?before:other.instalada||0),0);
  rows.push({index,ot:otKey,allocation,additional:true,receipt,before,target,revision:Number(m.stockRevision||0),legacyTotal});
 }if(!rows.length)throw fail(409,'No hay consumo pendiente de este producto en la OT.');return rows;
}
function apply({ot,inventory,product,body,uid,name,ts}){
 const movements=describe(ot,product,body.otKey,body.productKey),command={id:body.id,uid,user:name,reason:body.reason,ts,count:body.count,unitCount:/^(unidad|unidades|u|un|uni|ud|uds)$/i.test(product.unidad||'Unidad'),expected:inventory,movements:movements.map(({index,...m})=>m)};
 const nextInventory=Model.plan(inventory,command),nextOT=copy(ot);
 for(const m of movements){const row=nextOT.materiales[m.index];row.stockRegistro=m.receipt;row.stockRevision=m.revision+1;row.stockPendiente=false;delete row.stockBaseInstalada;}
 const classified=m=>['instalada','devuelta','devueltaPendiente','enTecnico','danada','faltante'].reduce((n,k)=>n+(Number(m[k])||0),0);
 // Do not certify a row whose delivery or installation is still unknown.
 const complete=nextOT.materiales.every(m=>m.esManoDeObra===true||m.stockPendiente!==true&&m.custodiaActiva===true&&Number(m.entregada)>0&&Math.abs(classified(m)-Number(m.entregada))<1e-6);
 if(complete){nextOT.custodiaIniciada=true;nextOT.custodiaRendida=true;}
 const audit={fecha:new Date(ts).toISOString(),ts,usuario:name,usuarioUid:uid,tipo:'conteo_oficina_ot',operacionId:body.id,productoKey:body.productKey,cantidadFisica:Number(body.count),cantidadUsada:movements.reduce((n,m)=>n+m.target-m.before,0),accion:'Stock de oficina conciliado con materiales instalados',motivo:body.reason};
 if(Array.isArray(nextOT.audit))nextOT.audit.push(audit);else nextOT.audit={...(nextOT.audit||{}),[body.id]:audit};
 return {inventory:nextInventory,ot:nextOT};
}
function createOTOfficeCount({db,store,guard,now=Date.now,enabled=false}){
 const read=async path=>(await db.ref(path).get()).val();
 async function execute(identity,body){
  if(!enabled)throw fail(503,'El ajuste desde OT todavía no está habilitado.');
  if(await read('sv_labor_config/otOfficeCountVersion')!==1)throw fail(503,'El ajuste desde OT está pendiente de activar sus protecciones.');
  if(!identity?.uid||identity.claims?.uid!==identity.uid)throw fail(401,'Sesión requerida');
  if(!body||Object.keys(body).some(k=>!['id','otKey','productKey','count','reason','expectedOTHash','expectedInventoryHash'].includes(k))||!key(body.id)||body.id.length<8||!key(body.otKey)||!key(body.productKey)||!Number.isFinite(body.count)||body.count<0||body.count>1e9||!clean(body.reason)||body.reason.length>240||!['expectedOTHash','expectedInventoryHash'].every(k=>/^[a-f0-9]{64}$/.test(body[k]||'')))throw fail(400,'Revisá el conteo y el motivo del ajuste.');
  const profile=await read('sv_chat_roles/'+identity.uid),cfg=await read('sv_permisos/'+profile?.rol),context=access(profile,cfg),otPath='sisventas/ordenes_trabajo/'+body.otKey,inventoryPath='sisventas/inventario_operativo/'+body.productKey;
  const actor={uid:identity.uid,claims:identity.claims,mode:'user',...context,financialAction:'ot.ajustarStockOficina',opId:body.id,transportDigest:digest(body),operation:'ot-office-count',input:body};
  const result=await guard.run(actor,async scope=>{
   const [ot,inventory]=await Promise.all([scope.getAsUser(otPath),scope.getAsUser(inventoryPath)]);
   if(digest(ot)!==body.expectedOTHash||digest(inventory)!==body.expectedInventoryHash)throw fail(409,'La OT o el stock cambió. Volvé a revisar antes de guardar.');
   const product=await scope.get('sisventas/productos/'+body.productKey),name=(await scope.get('sv_chat_directorio/'+identity.uid))?.nombre||'Usuario',ts=now();
   const plan=apply({ot,inventory,product,body,uid:identity.uid,name,ts});
   let lifecycle=null,sale=null,otIndex=null,salePath=null;const productProofs=[],productQueries=[];
   if(Lifecycle.closed(ot)&&key(ot.ventaFbKey)){
    if(await scope.get('sv_labor_config/otLifecycleVersion')!==1)throw Object.assign(fail(503,'La sincronización de esta OT cerrada está pendiente de activar.'),{code:'SV_OT_LIFECYCLE_DISABLED'});
    const cfg=await scope.get('sv_permisos/'+context.role),lifecycleContext=LifecyclePolicy.authority(await scope.get('sv_chat_roles/'+identity.uid),cfg,'stockrepair',true);
    actor.otClosed=true;actor.otLifecycle=LifecyclePolicy.issue({uid:identity.uid,otKey:body.otKey,saleKey:ot.ventaFbKey,operationId:body.id,kind:'stockrepair',...lifecycleContext});
    salePath='sisventas/ventas/'+ot.ventaFbKey;sale=await scope.get(salePath);otIndex=await scope.get(RecordLists.index+'/ordenes_trabajo');const others=RecordLists.parseIndex('ordenes_trabajo',otIndex);const primary=sale?.otId!==body.otKey&&key(sale?.otId)?await scope.get('sisventas/ordenes_trabajo/'+sale.otId):null;if(primary)productProofs.push({path:'sisventas/ordenes_trabajo/'+sale.otId,value:primary});
    if(!others[body.otKey]||others[body.otKey]._svListRevision!==(ot._svListRevision||0))throw fail(409,'El resumen de la OT requiere actualizarse.');
    const products={[product.codigo||product.cod]:product,[body.productKey]:product};
    for(const m of plan.ot.materiales||[]){const ref=m.productoKey||m.cod||m.codigo;if(!ref||products[ref])continue;if(key(m.productoKey)){const path='sisventas/productos/'+m.productoKey,value=await scope.get(path);products[ref]=value||{};productProofs.push({path,value});}else{const value=String(m.cod||m.codigo),records=await scope.query('sisventas/productos','codigo',value),rows=Object.values(records);products[ref]=rows.length===1?rows[0]:{};productQueries.push({value,records});}}
    const changes=Object.fromEntries(Object.entries({materiales:plan.ot.materiales,custodiaIniciada:plan.ot.custodiaIniciada,custodiaRendida:plan.ot.custodiaRendida}).filter(([,v])=>v!==undefined));
    lifecycle=Lifecycle.plan({before:ot,changes,kind:'custody',sale,primary,others,products,actor:{uid:identity.uid,name,otKey:body.otKey},at:new Date(ts).toISOString(),action:'Estado de instalación actualizado tras completar stock de la OT',allowPending:true});
    plan.ot.estado=lifecycle.ot.estado;plan.ot.cierreConObservaciones=lifecycle.ot.cierreConObservaciones;
    if(ot.estado!==plan.ot.estado||ot.cierreConObservaciones!==plan.ot.cierreConObservaciones||Object.keys(lifecycle.saleChanges).length){const event=lifecycle.ot.audit.at(-1);if(Array.isArray(plan.ot.audit))plan.ot.audit.push(event);else plan.ot.audit[body.id+'-state']=event;}
   }
   const latest=access(await scope.get('sv_chat_roles/'+identity.uid),await scope.get('sv_permisos/'+context.role));if(digest(latest)!==digest(context))throw fail(409,'Los permisos cambiaron. Volvé a abrir la OT.');
   scope.beforeCommit(async({readFresh,readFreshAsUser})=>{
    if(digest(access(await readFresh('sv_chat_roles/'+identity.uid),await readFresh('sv_permisos/'+context.role)))!==digest(context))throw fail(409,'Los permisos cambiaron. Volvé a abrir la OT.');
    if(digest(await readFreshAsUser(otPath))!==body.expectedOTHash||digest(await readFreshAsUser(inventoryPath))!==body.expectedInventoryHash||digest(await readFresh('sisventas/productos/'+body.productKey))!==digest(product))throw fail(409,'La OT, el producto o el stock cambió. Volvé a revisar antes de guardar.');
    if(lifecycle){LifecyclePolicy.validate(actor,await readFresh('sv_chat_roles/'+identity.uid),await readFresh('sv_permisos/'+context.role));if(digest(await readFresh(salePath))!==digest(sale)||digest(await readFresh(RecordLists.index+'/ordenes_trabajo'))!==digest(otIndex))throw fail(409,'La venta o sus visitas cambiaron. Volvé a abrir la OT.');}
    for(const p of productProofs)if(digest(await readFresh(p.path))!==digest(p.value))throw fail(409,'El producto cambió. Volvé a abrir la OT.');
    for(const p of productQueries)if(digest(await store.query('sisventas/productos','codigo',p.value))!==digest(p.records))throw fail(409,'El catálogo cambió. Volvé a abrir la OT.');
   });
   const patch={[inventoryPath]:plan.inventory,[otPath]:plan.ot};if(lifecycle)for(const [k,v]of Object.entries(lifecycle.saleChanges))patch[salePath+'/'+k]=v;
   await scope.update(patch);
   return {ok:true,committed:true,operationId:body.id,otKey:body.otKey,productKey:body.productKey};
  });
  // The receipt contains confirmation only. Read current, authorized records on replay.
  const [ot,inventory]=await Promise.all([store.readAsUser(otPath,identity),store.readAsUser(inventoryPath,identity)]);
  return {...result,ot,inventory};
 }
 return {execute};
}
module.exports={createOTOfficeCount,access,describe,apply};
