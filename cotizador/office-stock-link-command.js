'use strict';
const Reference=require('./office-stock-reference'),Policy=require('./office-stock-link-policy'),Stock=require('./office-stock');
const fail=(statusCode,code,message)=>Object.assign(Error(message),{statusCode,code,svLaborAttempted:false});
const alias=value=>String(value??'').replace(/[.#$\[\]\/]/g,'_').replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,120);
function aliases(productKey,product){return [...new Set([productKey,product.id,product.codigo,product.cod].filter(value=>value!==undefined&&value!==null&&String(value)!=='').map(alias).filter(Reference.key))];}
async function loadSnapshot({read,loadCoverage,productKey,inventoryKey,access}){
 if(!Reference.key(productKey)||!Reference.key(inventoryKey))throw fail(400,'SV_STOCK_LINK_INPUT','Referencias inválidas.');
 const product=await read('sisventas/productos/'+productKey);if(!product||typeof product!=='object')throw fail(409,'SV_STOCK_LINK_PRODUCT','El producto ya no existe.');
 if(typeof loadCoverage!=='function')throw fail(503,'SV_STOCK_LINK_COVERAGE','Falta verificar la cobertura de referencias.');
 const evidence={},proof=await loadCoverage({productKey,inventoryKey,product:structuredClone(product),aliases:aliases(productKey,product),read:async path=>{if(typeof path!=='string'||!/^sv_stock_reference_(?:index|config)(?:\/|$)/.test(path)||path.includes('..'))throw fail(400,'SV_STOCK_LINK_COVERAGE','Lectura de cobertura fuera de contrato.');const value=await read(path);evidence[path]=structuredClone(value);return value;}});
 if(!proof||proof.schema!==1||!Reference.key(proof.generation)||!Array.isArray(proof.inventoryKeys)||proof.inventoryKeys.length>64||proof.inventoryKeys.some(key=>!Reference.key(key))||!Object.keys(evidence).length)throw fail(503,'SV_STOCK_LINK_COVERAGE','La cobertura autoritativa no está preparada.');
 const byProduct={},byInventory={},forward=await read('sisventas/stock_vinculos/porProducto/'+productKey);if(forward)byProduct[productKey]=forward;
 const keys=[...new Set([...aliases(productKey,product),inventoryKey,...proof.inventoryKeys,...(forward?[forward.inventoryKey]:[])])];if(keys.length>80||keys.some(key=>!Reference.key(key)))throw fail(409,'SV_STOCK_LINK_AMBIGUOUS','Demasiadas referencias o asociación inválida.');
 const inventory={};for(const key of keys){inventory[key]=await read('sisventas/inventario_operativo/'+key);const reverse=await read('sisventas/stock_vinculos/porInventario/'+key);if(reverse){byInventory[key]=reverse;if(!Reference.key(reverse.productKey))throw fail(409,'SV_STOCK_LINK_MAPPING','Asociación inversa inválida.');if(!Object.hasOwn(byProduct,reverse.productKey))byProduct[reverse.productKey]=await read('sisventas/stock_vinculos/porProducto/'+reverse.productKey);}}
 const snapshot={productKey,product,inventory,links:{byProduct,byInventory},ownersByInventory:proof.ownersByInventory,aliasOwners:proof.aliasOwners,receiptIdentityKey:proof.receiptIdentityKey,coverage:proof.coverage,access,coverageEvidence:{generation:proof.generation,reads:evidence}};
 Reference.resolve(snapshot,inventoryKey);return snapshot;
}
function create({authorize,store,guard,loadCoverage,assertBarrier,enabled=false,now=Date.now}){
 function ready(){if(enabled!==true)throw fail(503,'SV_STOCK_LINK_DISABLED','La corrección de vínculos todavía no está habilitada.');if(typeof assertBarrier!=='function'||typeof loadCoverage!=='function')throw fail(503,'SV_STOCK_LINK_NOT_READY','Falta verificar barrera y cobertura de referencias.');}
 async function access(identity,read){if(!identity?.uid||identity.claims?.uid!==identity.uid||identity.viewAs||identity.claims.svPasswordChangeRequired===true)throw fail(403,'SV_STOCK_LINK_AUTH','Sesión no autorizada.');const profile=await read('sv_chat_roles/'+identity.uid),context=Stock.context(profile,await read('sv_permisos/'+profile?.rol));return{uid:identity.uid,claims:structuredClone(identity.claims),...context,active:true,allowed:true,productAccess:true,stockAdjust:true};}
 const stamp=actor=>({uid:actor.uid,role:actor.role,permissionRevision:actor.permissionRevision,permissionDigest:actor.permissionDigest});
 async function authorizeRequest(req){ready();if(req.headers?.['x-sv-view-as']||req.headers?.['x-sisventas-view-as'])throw fail(403,'SV_STOCK_LINK_AUTH','Volvé a tu cuenta para corregir vínculos.');if(typeof authorize!=='function')throw fail(503,'SV_STOCK_LINK_AUTH','Falta el verificador de sesión.');return authorize(req);}
 async function preview(identity,body){ready();if(!body||Object.keys(body).some(key=>!['productKey','inventoryKey'].includes(key)))throw fail(400,'SV_STOCK_LINK_INPUT','Consulta inválida.');const actor=await access(identity,store.read),read=path=>store.read(path);await assertBarrier({read,phase:'preview',identity});const snapshot=await loadSnapshot({read,loadCoverage,...body,access:stamp(actor)});if(Reference.digest(stamp(await access(identity,read)))!==Reference.digest(stamp(actor)))throw fail(409,'SV_STOCK_LINK_CONFLICT','Los permisos cambiaron.');const reference=Reference.resolve(snapshot,body.inventoryKey);return{...reference,expectedHash:Reference.referenceHash(snapshot),canRepair:reference.status==='active'};}
 async function execute(identity,body){
  ready();if(!body||Object.keys(body).some(key=>!['id','productKey','inventoryKey','reason','expectedHash'].includes(key))||!Reference.key(body.id)||body.id.length<8||!Reference.key(body.productKey)||!Reference.key(body.inventoryKey)||!/^[a-f0-9]{64}$/.test(body.expectedHash||'')||typeof body.reason!=='string'||!body.reason.trim()||body.reason.trim().length>240)throw fail(400,'SV_STOCK_LINK_INPUT','Corrección inválida.');
  const actor=await access(identity,path=>store.read(path)),runner={...actor,mode:'user',operation:'office-stock-link',financialAction:'stock.ajustar',opId:body.id,input:structuredClone(body),transportDigest:Reference.digest(body)};
  return guard.run(runner,async scope=>{
   const read=path=>scope.get(path);await assertBarrier({read,phase:'execute',identity,lease:scope.lease});const live=await access(identity,read);if(Reference.digest(stamp(live))!==Reference.digest(stamp(actor)))throw fail(409,'SV_STOCK_LINK_CONFLICT','Los permisos cambiaron.');
   const snapshot=await loadSnapshot({read,loadCoverage,productKey:body.productKey,inventoryKey:body.inventoryKey,access:stamp(actor)}),receiptPath='sisventas/stock_vinculos/operaciones/'+body.id;if(await read(receiptPath)!==null)throw fail(409,'SV_STOCK_LINK_RECEIPT','El recibo requiere conciliación con la operación original.');
   const plan=Policy.issue(runner,scope.lease,{snapshot,command:body,now:now()});
   scope.beforeCommit(async({readFresh})=>{const current=await access(identity,readFresh);if(Reference.digest(stamp(current))!==Reference.digest(stamp(actor)))throw fail(409,'SV_STOCK_LINK_CONFLICT','Los permisos cambiaron antes de confirmar.');await assertBarrier({read:readFresh,phase:'commit',identity,lease:scope.lease});const latest=await loadSnapshot({read:readFresh,loadCoverage,productKey:body.productKey,inventoryKey:body.inventoryKey,access:stamp(current)});if(Reference.referenceHash(latest)!==body.expectedHash||await readFresh(receiptPath)!==null)throw fail(409,'SV_STOCK_LINK_CONFLICT','El producto, inventario o asociación cambió antes de confirmar.');});
   await scope.update(plan.patch);return plan.result;
  });
 }
 return{authorize:authorizeRequest,preview,execute};
}
module.exports={create,loadSnapshot};
