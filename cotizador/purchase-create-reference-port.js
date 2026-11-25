'use strict';
// Internal prospective lookup only. No order/list original, policy issuance,
// patch, allocation, write, route or activation is produced here.
const {digest}=require('./labor-guard'),Reference=require('./office-stock-reference'),Explicit=require('./office-stock-explicit-reference'),IO=require('./office-stock-reference-io'),{assertFresh:compareFresh}=require('./office-stock-reference-port');
const Wire=require('./purchase-wire-envelope');
const authorities=new WeakSet(),issued=new WeakMap(),hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),serverKey=value=>typeof value==='string'&&value.length>0&&Buffer.byteLength(value)<=768&&!['constructor','prototype','__proto__'].includes(value)&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(value),operationId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,160}$/.test(value)&&serverKey(value),fail=(statusCode,code,message)=>Object.assign(Error(message),{statusCode,code,svLaborAttempted:false});
const purposes=Object.freeze({manual:Object.freeze({operation:'purchase-manual-create',kind:'register'}),'list-generation':Object.freeze({operation:'purchase-list-generate',kind:'generate'}),'manual-edit':Object.freeze({operation:'purchase-inventory-edit',kind:'edit'}),'list-reserve':Object.freeze({operation:'purchase-list-reserve',kind:'reserve'}),preparation:Object.freeze({operation:'purchase-preparation-save',kind:'prepare'})});
const binding=(actor,lease,purpose)=>digest({purpose,uid:actor.uid,claimsDigest:digest(actor.claims),role:actor.role,permissionRevision:actor.permissionRevision,permissionDigest:actor.permissionDigest,mode:actor.mode,action:actor.financialAction,operation:actor.operation,opId:actor.opId,transportDigest:actor.transportDigest,inputDigest:digest(actor.input),lease:{actorUid:lease.actorUid,opId:lease.opId,fence:lease.fence,digest:lease.digest,expiresAt:lease.expiresAt,mode:lease.mode}});
function create(options={}){
 if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(field=>!['enabled','mappedAdmission','now','purpose','initialInventoryReference'].includes(field)))throw fail(503,'SV_PURCHASE_CREATE_REFERENCE_PURPOSE','Configuración interna de referencias inválida.');
 const {enabled=false,mappedAdmission,now=Date.now,purpose='manual',initialInventoryReference=null}=options;
 if(typeof now!=='function'||typeof purpose!=='string'||!Object.hasOwn(purposes,purpose))throw fail(503,'SV_PURCHASE_CREATE_REFERENCE_PURPOSE','Propósito interno de referencias inválido.');
 const owner=Object.freeze({}),type=purposes[purpose];
 function ready(){if(enabled!==true)throw fail(503,'SV_PURCHASE_CREATE_REFERENCE_DISABLED','La resolución para compras nuevas todavía no está habilitada.');if(!Explicit.isMappedAdmission(mappedAdmission))throw fail(503,'SV_PURCHASE_CREATE_REFERENCE_NOT_READY','Falta la admisión firmada de referencias.');}
 function bound(actor,lease){
  if(!actor||!lease||actor.mode!=='user'||actor.financialAction!=='ordenes.editar'||actor.operation!==type.operation||actor.input?.kind!==type.kind||actor.input.id!==actor.opId||!serverKey(actor.uid)||actor.claims?.uid!==actor.uid||actor.viewAs||actor.viewing||actor.realUid&&actor.realUid!==actor.uid||actor.claims.svPasswordChangeRequired===true||!serverKey(actor.role)||!operationId(actor.opId)||!hex(actor.transportDigest)||!hex(actor.permissionDigest)||actor.opId!==lease.opId||actor.uid!==lease.actorUid||lease.digest!==actor.transportDigest||typeof lease.fence!=='string'||!lease.fence||!Number.isSafeInteger(lease.expiresAt)||lease.expiresAt<=now()||lease.mode!=='user')throw fail(403,'SV_PURCHASE_CREATE_REFERENCE_BOUND','La referencia no coincide con la operación vigente de compra.');
  try{Wire.assertBound(actor,lease);}catch(_){throw fail(403,'SV_PURCHASE_CREATE_REFERENCE_BOUND','La solicitud original no coincide con la operación interna de compra.');}
  return binding(actor,lease,purpose);
 }
 async function access(actor,lease,read){
  bound(actor,lease);if(typeof read!=='function')throw fail(503,'SV_PURCHASE_CREATE_REFERENCE_NOT_READY','Falta el lector de servidor.');
  const live=await read('sv_labor_guard');if(!live||['actorUid','opId','fence','digest','expiresAt','mode'].some(field=>live[field]!==lease[field])||live.expiresAt<=now())throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_LEASE','La coordinación de la compra ya no está vigente.');
  const paths=['sv_chat_roles/'+actor.uid,'sv_permisos/'+actor.role,'sv_access_resets/'+actor.uid,'sv_labor_receipts/'+actor.opId],[profile,cfg,reset,receipt]=await IO.mapOrdered(paths,path=>read(path)),override=cfg?.acciones?.ordenes?.editar;
  if(profile?.activo!==true||profile.rol!==actor.role||cfg?.indiceVersion!==2||cfg.indiceModulos?.ordenes!==true||Object.values(cfg.bloqueados||{}).includes('ordenes')||(typeof override==='boolean'?!override:!['admin','administrativo'].includes(actor.role))||digest(cfg)!==actor.permissionDigest||(cfg.indiceRevision??null)!==(actor.permissionRevision??null)||reset?.required===true||reset?.version!=null&&reset.version!==actor.claims.svAccessVersion)throw fail(403,'SV_PURCHASE_CREATE_REFERENCE_AUTH','La sesión o los permisos de Compras cambiaron.');
  if(receipt!==null)throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_RECEIPT','El intento ya tiene un recibo; consultá la operación original.');
 }
 async function resolve(selection,ports){
  ready();if(!selection||Object.keys(selection).some(field=>field!=='productKey')||!Reference.key(selection.productKey))throw fail(400,'SV_PURCHASE_CREATE_REFERENCE_INPUT','Producto canónico inválido.');
  const {actor,lease}=ports||{},stamp=bound(actor,lease);if(typeof ports.read!=='function')throw fail(503,'SV_PURCHASE_CREATE_REFERENCE_NOT_READY','Falta el lector de servidor.');const points=IO.memoRead(ports.read),read=points.read,ranges=new Map(),productKey=selection.productKey;
  await access(actor,lease,read);
  let sourceList=null,sourceHash=null;
  if(purpose==='manual-edit'){
   const original=await read('sisventas/ordenes/'+actor.input.orderKey);try{Wire.assertEditSource(actor,productKey,original);}catch(_){throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_SOURCE','La edición requiere la compra original vigente y un producto nuevo de su declaración.');}
  }
  if(purpose==='list-reserve'||purpose==='preparation'){
   const original=await read('sisventas/listas_materiales/'+actor.input.listKey);
   if(!original||typeof original!=='object'||Array.isArray(original)||original._svSummary||original._svListSummary||original._svPagedSummary||digest(original)!==actor.input.expectedHash||!Array.isArray(original.items)||!original.items.some(row=>row&&typeof row==='object'&&!Array.isArray(row)&&(row.productoKey??row.productKey)===productKey&&!(row.productoKey&&row.productKey&&row.productoKey!==row.productKey)))throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_SOURCE','La operación requiere la lista original vigente y su producto canónico.');
   sourceList=structuredClone(original);sourceHash=digest(original);
  }
  const forward=await read('sisventas/stock_vinculos/porProducto/'+productKey),onQuery=async(path,options,value)=>{const key=Reference.digest({path,options});ranges.set(key,{kind:'range',path,options:structuredClone(options),hash:Reference.digest(value)});};
  if(forward&&forward.productKey!==productKey)throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_REVIEW','La asociación corresponde a otro producto.');
  const resolved=forward?await Explicit.resolveMapped({mappedAdmission,record:forward,read}):await Explicit.resolveUnmapped({mappedAdmission,productKey,read,queryPage:ports.referencePhase?.queryPage??ports.queryPage,referencePhase:ports.referencePhase,onQuery});
  if(resolved.product.activo!==true||resolved.product.fbKey!==undefined&&resolved.product.fbKey!==productKey)throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_REVIEW','El producto requiere revisar su estado canónico.');
  if(purpose==='list-reserve'||purpose==='preparation'){const state=require('./office-stock-order').classify(resolved.inventory);if(state.present!==1||state.invalid)throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_REVIEW','La operación requiere inventario físico existente y conocido; no se inicializó ningún registro.');}
  let initialEvidence=null,initialInventory=null;if(resolved.inventory===null){if(!require('./initial-inventory-reference').isAuthority(initialInventoryReference))throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_REVIEW','La compra nueva requiere verificar su inventario inicial; no se creó ningún registro.');const initial=await initialInventoryReference.resolve({productKey},{actor,lease,read,queryPage:ports.queryPage,referencePhase:ports.referencePhase}),plan=initialInventoryReference.inspect(initial.evidence,{actor,lease});if(initial.inventory!==null||digest(plan.product)!==digest({...resolved.product,fbKey:productKey})||digest(plan.reference)!==digest(resolved.reference))throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_REVIEW','La prueba inicial no corresponde al producto.');initialEvidence=initial.evidence;initialInventory=plan.initial.inventory;}
  if(bound(actor,lease)!==stamp)throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_BOUND','La operación cambió durante la consulta.');
  const readSet=[...[...points.values].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,value])=>({path,hash:Reference.digest(value)})),...[...ranges].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,entry])=>entry)],evidence=Object.freeze({});
  issued.set(evidence,{owner,stamp,productKey,initialEvidence,sourceList:structuredClone(sourceList),sourceHash,product:{...structuredClone(resolved.product),fbKey:productKey},reference:structuredClone(resolved.reference),readSet:structuredClone(readSet)});
  return{...(sourceList?{sourceList:structuredClone(sourceList),sourceHash}:{}),product:{...structuredClone(resolved.product),fbKey:productKey},inventory:structuredClone(resolved.inventory),...(initialInventory?{initialInventory:structuredClone(initialInventory)}:{}),reference:structuredClone(resolved.reference),readSet:structuredClone(readSet),evidence};
 }
 async function assertFresh(evidence,ports){
  ready();const proof=issued.get(evidence);if(proof?.owner!==owner)throw fail(403,'SV_PURCHASE_CREATE_REFERENCE_EVIDENCE','Falta evidencia emitida por este puerto de servidor.');
  const {actor,lease,readFresh,queryFresh,queryPageFresh}=ports||{};if(bound(actor,lease)!==proof.stamp)throw fail(403,'SV_PURCHASE_CREATE_REFERENCE_BOUND','La evidencia pertenece a otra operación o coordinación.');
  if(typeof readFresh!=='function')throw fail(503,'SV_PURCHASE_CREATE_REFERENCE_NOT_READY','Falta el lector fresco de servidor.');const read=IO.boundedRead(readFresh);await access(actor,lease,read);await compareFresh(proof.readSet,read,queryFresh,queryPageFresh);
  if(proof.initialEvidence)await initialInventoryReference.assertFresh(proof.initialEvidence,ports);
  if(bound(actor,lease)!==proof.stamp)throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_BOUND','La operación cambió antes de confirmar.');
 }
 function inspect(evidence,{actor,lease}={}){ready();const proof=issued.get(evidence);if(proof?.owner!==owner||bound(actor,lease)!==proof.stamp)throw fail(403,'SV_PURCHASE_CREATE_REFERENCE_EVIDENCE','La evidencia pertenece a otra operación.');return proof.initialEvidence?initialInventoryReference.inspect(proof.initialEvidence,{actor,lease}):{...(proof.sourceList?{sourceList:structuredClone(proof.sourceList),sourceHash:proof.sourceHash}:{}),productKey:proof.productKey,product:structuredClone(proof.product),reference:structuredClone(proof.reference),initial:null};}
 const authority=Object.freeze({resolve,assertFresh,inspect});authorities.add(authority);return authority;
}
module.exports={create,isAuthority:value=>authorities.has(value)};
