'use strict';
const {digest}=require('./labor-guard');
const issued=new WeakSet(),atomicPlans=new WeakMap(),key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
function issue({uid,otKey,saleKey,operationId,kind,role,permissionRevision,permissionDigest,atomicStock=false}){
 if(!key(uid)||!key(otKey)||!key(saleKey)||!key(operationId)||!['close','custody','return','stockrepair','delivery'].includes(kind))throw Error('Capacidad de OT inválida.');
 const cap=Object.freeze({uid,otKey,saleKey,operationId,kind,role,permissionRevision,permissionDigest,atomicStock:atomicStock===true});issued.add(cap);return cap;
}
function token(actor,lease){
 const c=actor?.otLifecycle;
 if(!issued.has(c)||actor.mode!=='user'||!(actor.operation==='ot-lifecycle'&&c.kind!=='stockrepair'||actor.operation==='ot-office-count'&&c.kind==='stockrepair')||c.uid!==actor.uid||c.uid!==lease.actorUid||c.operationId!==actor.opId||c.operationId!==lease.opId)return {svOTLifecycleVersion:0};
 return {svOTLifecycleVersion:1,svOTLifecycleOTKey:c.otKey,svOTLifecycleSaleKey:c.saleKey,svOTLifecycleKind:c.kind,svOTLifecycleRole:c.role,svOTLifecyclePermissionRevision:c.permissionRevision??null};
}
function authority(profile,cfg,kind,closed=false){
 const role=profile?.rol;if(profile?.activo!==true||!['admin','administrativo','tecnico','tecnico_vendedor','vendedor'].includes(role))throw Object.assign(Error('Usuario sin acceso a la OT.'),{statusCode:403});
 if(!cfg||typeof cfg!=='object'||cfg.indiceVersion!==2||cfg.indiceModulos?.ordentrabajo!==true||Object.values(cfg.bloqueados||{}).includes('ordentrabajo'))throw Object.assign(Error('No tenés permiso para operar la OT.'),{statusCode:403});
 if(kind==='delivery'&&!['admin','administrativo'].includes(role))throw Object.assign(Error('Sólo administración puede entregar materiales.'),{statusCode:403});
 const action=kind==='delivery'||kind==='return'?'entregarMateriales':kind==='custody'?'rendirMateriales':kind==='stockrepair'?'ajustarStockOficina':null;
 const allowed=a=>typeof cfg?.acciones?.ot?.[a]==='boolean'?cfg.acciones.ot[a]:(a==='entregarMateriales'?['admin','administrativo']:['corregirMateriales','ajustarStockOficina'].includes(a)?['admin']:['admin','administrativo','tecnico','tecnico_vendedor']).includes(role);
 if(action&&!allowed(action)||kind==='custody'&&closed&&(role!=='admin'||!allowed('corregirMateriales')))throw Object.assign(Error('La acción de materiales no está autorizada.'),{statusCode:403});
 return {role,permissionRevision:cfg?.indiceRevision??null,permissionDigest:digest(cfg||{})};
}
function validate(actor,profile,cfg){const c=actor.otLifecycle;if(!issued.has(c))throw Error('Falta la capacidad interna de OT.');const current=authority(profile,cfg,c.kind,actor.otClosed);if(digest(current)!==digest({role:c.role,permissionRevision:c.permissionRevision,permissionDigest:c.permissionDigest}))throw Object.assign(Error('Los permisos de OT cambiaron. Volvé a abrirla.'),{statusCode:409});}
// Internal capability only: never derive this from incoming JWT/body claims.
function allowsAtomicStock(actor,lease){return actor?.otLifecycle?.atomicStock===true&&actor.otLifecycle.kind==='custody'&&token(actor,lease).svOTLifecycleVersion===1;}
function bindAtomicStock(actor,lease,inventory){if(!allowsAtomicStock(actor,lease)||!(inventory instanceof Map))throw Error('Falta la capacidad interna de stock.');atomicPlans.set(actor.otLifecycle,new Map(Array.from(inventory,([path,value])=>[path,structuredClone(value)])));}
function verifyAtomicStockPatch(actor,lease,patch){
 if(!allowsAtomicStock(actor,lease))return false;const expected=atomicPlans.get(actor.otLifecycle);if(!expected)throw Error('Falta el plan interno de stock.');
 const actual=Object.keys(patch).filter(path=>path==='sisventas/inventario_operativo'||path.startsWith('sisventas/inventario_operativo/'));
 if(actual.length!==expected.size||actual.some(path=>!expected.has(path)))throw Error('El PATCH no coincide con el plan interno de stock.');
 const plain=value=>{const copy=structuredClone(value);delete copy._svReadRevision;delete copy._svReadOperation;return copy;};
 for(const path of actual)if(digest(plain(patch[path]))!==digest(plain(expected.get(path))))throw Error('El stock del PATCH no coincide con el plan interno.');
 return true;
}
module.exports={issue,token,authority,validate,allowsAtomicStock,bindAtomicStock,verifyAtomicStockPatch};
