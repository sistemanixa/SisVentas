'use strict';
// Server-only plan authority. JSON and an operation name cannot carry this seal.
const {digest}=require('./labor-guard');
const issued=new WeakMap(),capabilities=new WeakSet(),port=Symbol('ot-office-count-source');
const fail=()=>Object.assign(Error('El conteo no coincide con el plan autorizado de OT.'),{statusCode:403,code:'SV_OT_COUNT_SOURCE_AUTHORITY'});
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;};
function binding(actor,lease){return digest({uid:actor.uid,claims:actor.claims,operation:actor.operation,input:actor.input,role:actor.role,permissionRevision:actor.permissionRevision,permissionDigest:actor.permissionDigest,opId:actor.opId,transportDigest:actor.transportDigest,lease});}
function live(actor,lease,now){if(actor?.operation!=='ot-office-count'||actor.mode!=='user'||actor.uid!==actor.claims?.uid||actor.uid!==lease?.actorUid||actor.opId!==lease?.opId||actor.input?.id!==actor.opId||actor.transportDigest!==digest(actor.input)||lease.digest!==actor.transportDigest||lease.mode!=='user'||typeof lease.fence!=='string'||!lease.fence||!Number.isSafeInteger(lease.expiresAt)||lease.expiresAt<=now)throw fail();}
function issue({actor,original,context}){if(!actor||actor.operation!=='ot-office-count'||actor.mode!=='user'||actor.uid!==actor.claims?.uid||actor.opId!==actor.input?.id||digest(original)!==actor.input.expectedOTHash||digest(context)!==digest({role:actor.role,permissionRevision:actor.permissionRevision,permissionDigest:actor.permissionDigest}))throw fail();if(capabilities.has(actor.otCount)){validateOriginal(actor,original,actor.input.otKey);return actor.otCount;}const cap=Object.freeze({uid:actor.uid,opId:actor.opId,otKey:actor.input.otKey,productKey:actor.input.productKey,originalHash:digest(original),role:context.role,permissionRevision:context.permissionRevision,permissionDigest:context.permissionDigest});capabilities.add(cap);return cap;}
function validateOriginal(actor,original,otKey){const cap=actor?.otCount;if(!capabilities.has(cap)||actor.uid!==cap.uid||actor.opId!==cap.opId||otKey!==cap.otKey||digest(original)!==cap.originalHash)throw fail();return true;}
function token(actor,lease){const cap=actor?.otCount,proof=issued.get(actor?.[port]);if(!capabilities.has(cap)||actor.operation!=='ot-office-count'||actor.mode!=='user'||actor.uid!==actor.claims?.uid||cap.uid!==actor.uid||cap.opId!==actor.opId||lease?.actorUid!==cap.uid||lease?.opId!==cap.opId||typeof lease?.fence!=='string'||!lease.fence)return{svOTCountVersion:0};return{svOTCountVersion:1,svOTCountOTKey:cap.otKey,svOTCountProductKey:cap.productKey,svOTCountInventoryKey:proof?.inventoryPath.split('/')[2]??null,svOTCountRole:cap.role,svOTCountPermissionRevision:cap.permissionRevision,svOTCountGeneration:proof?.generation??null,svOTCountFence:lease.fence};}
function seal({actor,lease,patch,sources,generation=null,now=Date.now()}){
 live(actor,lease,now);
 const otPath='sisventas/ordenes_trabajo/'+actor.input.otKey,inventoryPaths=Object.keys(patch||{}).filter(path=>/^sisventas\/inventario_operativo\/[^/]+$/.test(path));if(inventoryPaths.length!==1)throw fail();const inventoryPath=inventoryPaths[0];validateOriginal(actor,sources?.[otPath],actor.input.otKey);
 if(digest(sources?.[otPath])!==actor.input.expectedOTHash||digest(sources?.[inventoryPath])!==actor.input.expectedInventoryHash||!sources?.[otPath]||!sources?.[inventoryPath]||!patch?.[otPath]||!patch?.[inventoryPath])throw fail();
 const saleKey=sources[otPath].ventaFbKey;
 for(const path of Object.keys(patch))if(path!==otPath&&path!==inventoryPath&&!(saleKey&&['estadoInst','audit'].some(field=>path==='sisventas/ventas/'+saleKey+'/'+field)))throw fail();
 const expected=new Set([otPath,inventoryPath,...(Object.keys(patch).some(path=>path.startsWith('sisventas/ventas/'))?['sisventas/ventas/'+saleKey]:[])]);
 if(Object.keys(sources).some(path=>!expected.has(path))||[...expected].some(path=>!Object.hasOwn(sources,path)))throw fail();
 const handle=Object.freeze({});issued.set(handle,{cap:actor.otCount,binding:binding(actor,lease),otPath,inventoryPath,generation,patch:freeze(structuredClone(patch)),sources:freeze(structuredClone(sources))});actor[port]=handle;
}
function isBound(actor){const proof=issued.get(actor?.[port]);return !!proof&&capabilities.has(actor.otCount)&&proof.cap===actor.otCount;}
async function validate({actor,lease,patch,readFresh,operationalSummaries=false,now=Date.now()}){
 live(actor,lease,now);const proof=issued.get(actor?.[port]);if(!isBound(actor)||!proof||proof.binding!==binding(actor,lease)||typeof readFresh!=='function')throw fail();
 const Count=require('./ot-office-count'),context=Count.access(await readFresh('sv_chat_roles/'+actor.uid),await readFresh('sv_permisos/'+actor.role));
 if(digest(context)!==digest({role:actor.role,permissionRevision:actor.permissionRevision,permissionDigest:actor.permissionDigest})||await readFresh('sv_labor_config/otOfficeCountVersion')!==1)throw fail();
 const expected=structuredClone(proof.patch),Operational=require('./operational-read-model'),Records=require('./record-list-model');
 const configs=operationalSummaries?await Promise.all([readFresh('sv_operational_read_config'),readFresh('sv_record_list_config')]):[null,null];
 for(const [path,original]of Object.entries(proof.sources)){
  if(digest(await readFresh(path))!==digest(original))throw fail();
  if(Object.hasOwn(expected,path)&&configs[0]?.schema===1&&configs[0].ready===true&&Operational.recordPath(path)===path)Object.assign(expected,Operational.plan(path,original,expected[path],actor.opId));
 }
 if(configs[1]?.schema===1&&configs[1].ready===true)Object.assign(expected,Records.plan(proof.otPath,proof.sources[proof.otPath],expected[proof.otPath],actor.opId));
 for(const [path,value]of Object.entries(expected))if(!Object.hasOwn(patch,path)||digest(patch[path])!==digest(value))throw fail();
 // Other projectors retain their own domain validation; no extra business source is admitted.
 const technical=['sv_labor_indexes/','sv_commercial_pages/','sv_client_accounts/','sv_client_history/','sv_sale_financial_dependencies/','sv_dashboard_commercial_activity_proposal/','sv_dashboard_budget_proposal/'];
 for(const path of Object.keys(patch))if(!Object.hasOwn(expected,path)&&path!=='sv_labor_guard'&&path!=='sv_labor_receipts/'+actor.opId&&!technical.some(prefix=>path.startsWith(prefix)))throw fail();
 const receipt=patch['sv_labor_receipts/'+actor.opId];if(patch.sv_labor_guard!==null||receipt?.actorUid!==actor.uid||receipt.digest!==lease.digest||receipt.fence!==lease.fence||proof.binding!==binding(actor,lease)||lease.expiresAt<=now)throw fail();
}
module.exports={issue,validateOriginal,token,seal,isBound,validate};
