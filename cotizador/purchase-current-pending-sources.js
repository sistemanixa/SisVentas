'use strict';
const {digest}=require('./labor-guard'),Explicit=require('./office-stock-explicit-reference'),Model=require('./purchase-current-pending-model'),Scan=require('./purchase-current-pending-scan'),Linked=require('./purchase-inventory-linked-sources');
const issued=new WeakMap(),owners=new WeakSet(),copy=v=>structuredClone(v);
const fail=message=>Object.assign(Error(message),{statusCode:409,code:'SV_PURCHASE_CURRENT_PENDING_SOURCE'});
function stamp(actor,lease){return digest({uid:actor?.uid,claims:actor?.claims,role:actor?.role,permissionRevision:actor?.permissionRevision,permissionDigest:actor?.permissionDigest,operation:actor?.operation,input:actor?.input,transportDigest:actor?.transportDigest,lease});}
function bound(actor,lease,now){if(actor?.mode!=='user'||actor.operation!=='purchase-current-pending-reconcile'||actor.financialAction!=='ordenes.editar'||actor.role!=='admin'||actor.uid!==actor.claims?.uid||actor.uid!==lease?.actorUid||actor.opId!==lease.opId||actor.opId!==actor.input?.id||actor.transportDigest!==lease.digest||digest(actor.input)!==lease.digest||lease.expiresAt<=now)throw fail('La fuente no corresponde al lease de conciliación.');return stamp(actor,lease);}
function snapshot(port,evidence,actor,lease){const value=issued.get(evidence);if(!owners.has(port)||value?.owner!==port||value.binding!==stamp(actor,lease))throw fail('Falta la cobertura privada de pendientes actuales.');return copy(value.snapshot);}
function create({enabled=false,mappedAdmission,now=Date.now}={}){
 const port={};owners.add(port);
 async function load({actor,lease,read,queryPage,sourceOrder,guard}={}){
  const binding=bound(actor,lease,now());if(enabled!==true||!Explicit.isMappedAdmission(mappedAdmission)||typeof read!=='function'||typeof queryPage!=='function')throw fail('Falta el lector genuino de cobertura y asociaciones.');
  await mappedAdmission.admit({read});const scanned=await Scan.scan(queryPage),sources=scanned.sources;
  if(digest(sources.orders[actor.input.orderKey])!==digest(sourceOrder))throw fail('La orden cambió durante el cierre de cobertura.');
  const cache=new Map(),pending=new Map(),memo=async path=>{if(!pending.has(path))pending.set(path,Promise.resolve().then(()=>read(path)).then(value=>{cache.set(path,copy(value));return value;}));return copy(await pending.get(path));},referencesBySource={},inventories={};let count=0;
  for(const entry of Model.sourceOrders(sources)){
   referencesBySource[entry.path]={};
   for(const {row,index}of Model.rows(entry.order,entry.legacy)){
    if(++count>4096)throw fail('La cobertura excede el lote verificable en un lease.');
    const identity=row.productoKey||row.productKey||row.codigo||row.cod;// Identity only; never use catalog prices.
    if(typeof identity!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(identity))throw fail('El material no conserva una identidad original acotada.');
    const [forward,inverse]=await Promise.all([memo('sisventas/stock_vinculos/porProducto/'+identity),memo('sisventas/stock_vinculos/porInventario/'+identity)]),pairs=[forward,inverse].filter(value=>value!==null);
    if(!pairs.length||pairs.some(value=>digest(value)!==digest(pairs[0])))throw fail('Falta un par P/J/R original inequívoco.');
    const mapped=await Explicit.resolveMapped({mappedAdmission,record:pairs[0],read:memo}),ref=mapped.reference;
    if(row.productoKey!=null&&row.productoKey!==ref.productKey||row.productKey!=null&&row.productKey!==ref.productKey||row.inventoryKey!=null&&row.inventoryKey!==ref.inventoryKey||row.receiptIdentityKey!=null&&row.receiptIdentityKey!==ref.receiptIdentityKey)throw fail('El renglón contradice su asociación original.');
    referencesBySource[entry.path][String(index)]={productKey:ref.productKey,inventoryKey:ref.inventoryKey,receiptIdentityKey:ref.receiptIdentityKey};inventories[ref.inventoryKey]=await memo('sisventas/inventario_operativo/'+ref.inventoryKey);
   }
  }
  const isLinked=!!(sourceOrder.ventaFbKey||sourceOrder.ventaId||sourceOrder.listaMaterialesId||sourceOrder.listaOrigenId||sourceOrder.compraVentaReferencia);
  const linked=isLinked?await Linked.load({order:sourceOrder,orderKey:actor.input.orderKey,read:memo,guard}):null;
  const value={sources,coverage:{pages:scanned.pages,eof:scanned.eof},referencesBySource,inventories,dependencies:Object.fromEntries(cache),...(linked?{linked:{sale:linked.sale,list:linked.list,sourceList:linked.sourceList,otherOrders:linked.otherOrders}}:{})};
  bound(actor,lease,now());const evidence=Object.freeze({});issued.set(evidence,{owner:port,binding,snapshot:value});return{evidence};
 }
 async function assertFresh(evidence,{actor,lease,readFresh,queryPageFresh,sourceOrder,guard}){const original=snapshot(port,evidence,actor,lease),current=await load({actor,lease,read:readFresh,queryPage:queryPageFresh,sourceOrder,guard});if(digest(snapshot(port,current.evidence,actor,lease))!==digest(original))throw fail('Las órdenes, asociaciones o saldos cambiaron antes del commit.');}
 Object.assign(port,{load,assertFresh});return Object.freeze(port);
}
module.exports={create,snapshot,isAuthority:port=>owners.has(port)};
