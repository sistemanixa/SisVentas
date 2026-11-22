'use strict';
// Internal prospective lookup only. No order/list original, policy issuance,
// patch, allocation, write, route or activation is produced here.
const {digest}=require('./labor-guard'),Reference=require('./office-stock-reference'),Explicit=require('./office-stock-explicit-reference'),IO=require('./office-stock-reference-io'),{assertFresh:compareFresh}=require('./office-stock-reference-port');
const issued=new WeakMap(),hex=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),serverKey=value=>typeof value==='string'&&value.length>0&&Buffer.byteLength(value)<=768&&!['constructor','prototype','__proto__'].includes(value)&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(value),operationId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,160}$/.test(value)&&serverKey(value),fail=(statusCode,code,message)=>Object.assign(Error(message),{statusCode,code,svLaborAttempted:false});
const binding=(actor,lease)=>digest({uid:actor.uid,claimsDigest:digest(actor.claims),role:actor.role,permissionRevision:actor.permissionRevision,permissionDigest:actor.permissionDigest,mode:actor.mode,action:actor.financialAction,operation:actor.operation,opId:actor.opId,transportDigest:actor.transportDigest,inputDigest:digest(actor.input),lease:{actorUid:lease.actorUid,opId:lease.opId,fence:lease.fence,digest:lease.digest,expiresAt:lease.expiresAt,mode:lease.mode}});
function create({enabled=false,mappedAdmission,now=Date.now}={}){
 const owner=Object.freeze({});
 function ready(){if(enabled!==true)throw fail(503,'SV_PURCHASE_CREATE_REFERENCE_DISABLED','La resolución para compras nuevas todavía no está habilitada.');if(!Explicit.isMappedAdmission(mappedAdmission))throw fail(503,'SV_PURCHASE_CREATE_REFERENCE_NOT_READY','Falta la admisión firmada de referencias.');}
 function bound(actor,lease){
  if(!actor||!lease||actor.mode!=='user'||actor.financialAction!=='ordenes.editar'||actor.operation!=='purchase-manual-create'||actor.input?.kind!=='register'||actor.input.id!==actor.opId||!serverKey(actor.uid)||actor.claims?.uid!==actor.uid||actor.viewAs||actor.viewing||actor.realUid&&actor.realUid!==actor.uid||actor.claims.svPasswordChangeRequired===true||!serverKey(actor.role)||!operationId(actor.opId)||!hex(actor.transportDigest)||!hex(actor.permissionDigest)||digest(actor.input)!==actor.transportDigest||actor.opId!==lease.opId||actor.uid!==lease.actorUid||lease.digest!==actor.transportDigest||typeof lease.fence!=='string'||!lease.fence||!Number.isSafeInteger(lease.expiresAt)||lease.expiresAt<=now()||lease.mode!=='user')throw fail(403,'SV_PURCHASE_CREATE_REFERENCE_BOUND','La referencia no coincide con la operación vigente de compra.');
  return binding(actor,lease);
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
  const forward=await read('sisventas/stock_vinculos/porProducto/'+productKey),onQuery=async(path,options,value)=>{const key=Reference.digest({path,options});ranges.set(key,{kind:'range',path,options:structuredClone(options),hash:Reference.digest(value)});};
  if(forward&&forward.productKey!==productKey)throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_REVIEW','La asociación corresponde a otro producto.');
  const resolved=forward?await Explicit.resolveMapped({mappedAdmission,record:forward,read}):await Explicit.resolveUnmapped({mappedAdmission,productKey,read,queryPage:ports.referencePhase?.queryPage??ports.queryPage,referencePhase:ports.referencePhase,onQuery});
  if(resolved.product.activo!==true||resolved.product.fbKey!==undefined&&resolved.product.fbKey!==productKey)throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_REVIEW','El producto requiere revisar su estado canónico.');
  if(resolved.inventory===null)throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_REVIEW','La compra nueva requiere un inventario físico existente; no se creó ningún registro.');
  if(bound(actor,lease)!==stamp)throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_BOUND','La operación cambió durante la consulta.');
  const readSet=[...[...points.values].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([path,value])=>({path,hash:Reference.digest(value)})),...[...ranges].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,entry])=>entry)],evidence=Object.freeze({});
  issued.set(evidence,{owner,stamp,productKey,reference:structuredClone(resolved.reference),readSet:structuredClone(readSet)});
  return{product:{...structuredClone(resolved.product),fbKey:productKey},inventory:structuredClone(resolved.inventory),reference:structuredClone(resolved.reference),readSet:structuredClone(readSet),evidence};
 }
 async function assertFresh(evidence,ports){
  ready();const proof=issued.get(evidence);if(proof?.owner!==owner)throw fail(403,'SV_PURCHASE_CREATE_REFERENCE_EVIDENCE','Falta evidencia emitida por este puerto de servidor.');
  const {actor,lease,readFresh,queryFresh,queryPageFresh}=ports||{};if(bound(actor,lease)!==proof.stamp)throw fail(403,'SV_PURCHASE_CREATE_REFERENCE_BOUND','La evidencia pertenece a otra operación o coordinación.');
  if(typeof readFresh!=='function')throw fail(503,'SV_PURCHASE_CREATE_REFERENCE_NOT_READY','Falta el lector fresco de servidor.');const read=IO.boundedRead(readFresh);await access(actor,lease,read);await compareFresh(proof.readSet,read,queryFresh,queryPageFresh);
  if(bound(actor,lease)!==proof.stamp)throw fail(409,'SV_PURCHASE_CREATE_REFERENCE_BOUND','La operación cambió antes de confirmar.');
 }
 return Object.freeze({resolve,assertFresh});
}
module.exports={create};
