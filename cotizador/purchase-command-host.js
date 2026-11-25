'use strict';
// Server-owned composition only; no HTTP input selects factories or authority.
const Manual=require('./purchase-manual-create-command'),Inventory=require('./purchase-inventory-command'),Generation=require('./purchase-list-generation-command'),Actions=require('./purchase-actions'),Contract=require('./purchase-route-contract'),Numbering=require('./purchase-numbering'),Prospective=require('./purchase-create-reference-port'),Historical=require('./office-stock-reference-port'),Explicit=require('./office-stock-explicit-reference'),Initial=require('./initial-inventory-reference'),Absence=require('./inventory-absence-evidence'),Sources=require('./purchase-inventory-linked-sources'),Order=require('./office-stock-order'),Activation=require('./stock-link-activation-contract'),{digest}=require('./labor-guard');
const descriptors=Object.freeze([
 Object.freeze({name:'manualCreate',path:'/compras/ordenes/crear',maxBytes:65536}),
 Object.freeze({name:'orderInventory',path:'/compras/ordenes/inventario',maxBytes:65536}),
 Object.freeze({name:'listGenerate',path:'/compras/listas/generar',maxBytes:16384}),
 Object.freeze({name:'orderDelete',path:'/compras/ordenes/eliminar',maxBytes:2048}),
 ...Object.entries(Contract.specs).map(([action,spec])=>Object.freeze({name:action==='listCancelPreparation'?'listPreparationCancel':action,action,path:spec.path,maxBytes:action==='listPreparation'?3145728:action==='listSave'?524288:16384}))
]);
const byPath=Object.freeze(Object.fromEntries(descriptors.map(spec=>[spec.path,spec])));
const fail=(message='El circuito de Compras todavía no está disponible. Conservá el formulario.',statusCode=503,code='SV_PURCHASE_HOST_NOT_READY')=>Object.assign(Error(message),{statusCode,code,svLaborAttempted:false});
const key=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
function create({authorize,store,guard,cohort,numbering,initialInventoryReference,orderDelete,enabled=false,queryPage=store?.queryPage,now=Date.now}={}){
 if(typeof enabled!=='boolean'||typeof now!=='function')throw fail('Configuración de Compras inválida.');
 const mapped=cohort?.mappedAdmission,mappedReady=Explicit.isMappedAdmission(mapped),initial=Initial.isAuthority(initialInventoryReference)?initialInventoryReference:initialInventoryReference===undefined&&mappedReady&&Absence.isAuthority(cohort?.absenceAuthority)?Initial.create({enabled,mappedAdmission:mapped,absenceAuthority:cohort.absenceAuthority,now}):null;
 const allocation=numbering===undefined?Numbering.create({enabled,mappedAdmission:mapped,now}):numbering;
 const port=purpose=>Prospective.create({enabled,mappedAdmission:mapped,purpose,initialInventoryReference:initial,now});
 const references=Object.freeze({manual:port('manual'),generation:port('list-generation'),edit:port('manual-edit'),reserve:port('list-reserve'),preparation:port('preparation')});
 const resolveReference=Historical.createReferenceResolver({enabled,mappedAdmission:mapped});
 const common={authorize,store,guard,assertAdmission:options=>{if(typeof cohort?.assertAdmission!=='function')throw fail();return cohort.assertAdmission(options);},numbering:allocation,queryPage,enabled,now};
 const handlers=Object.create(null);
 handlers.manualCreate=Manual.create({...common,creationReferencePort:references.manual}).execute;
 handlers.orderInventory=Inventory.create({...common,resolveReference,editReferencePort:references.edit,linkedEnabled:enabled}).execute;
 handlers.listGenerate=Generation.create({...common,listReferencePort:references.generation}).execute;
 for(const spec of descriptors)if(spec.action)handlers[spec.name]=Actions.create({...common,action:spec.action,referencePort:spec.action==='listPreparation'?references.preparation:references.reserve}).execute;
 let installedEver=false;
 function dependencies(){const missing=[];if(!enabled)missing.push('enabled');if(!mappedReady||typeof cohort?.assertAdmission!=='function')missing.push('mapped-admission');if(typeof authorize!=='function'||typeof guard?.run!=='function'||typeof store?.read!=='function'||typeof store?.readAsUser!=='function'||typeof queryPage!=='function')missing.push('native-dependencies');if(!Numbering.isAuthority(allocation,{mappedAdmission:mapped}))missing.push('numbering-authority');if(!Initial.isAuthority(initial))missing.push('initial-inventory');if(guard?.clientAccounts!==true||guard?.clientHistory!==true||guard?.saleFinancialDependencies!==true)missing.push('linked-projections');if(guard?.stockOrderProjections!==true)missing.push('order-projection');if(guard?.operationalSummaries!==true)missing.push('operational-summaries');return missing;}
 async function readiness(){
  if(typeof store?.read!=='function'||typeof cohort?.capabilities!=='function')throw fail();
  const values=new Map(),pending=new Map(),read=async path=>{if(!pending.has(path))pending.set(path,Promise.resolve().then(()=>store.read(path)).then(value=>{values.set(path,structuredClone(value));return value;}));return structuredClone(await pending.get(path));};
  const state=await cohort.capabilities({read});
  if(!state||state.version!==1||typeof state.installed!=='boolean'||typeof state.ready!=='boolean'||typeof state.generation!=='string'||state.ready&&!state.installed||state.installed&&!key(state.generation))throw fail();
  if(installedEver&&!state.installed)throw fail();installedEver ||= state.installed;
  const missing=dependencies();
  if(!state.ready)missing.push('cohort');
  if(state.ready&&enabled&&missing.length===0){
   // Admission and config use one short-lived read phase. No cache spans calls.
   await cohort.assertAdmission({read,phase:'purchase-capability'});
   const operational=await read('sv_operational_read_config');if(operational?.schema!==1||operational.ready!==true)missing.push('operational-config');
   try{await Sources.readiness({read,guard});}catch(error){if(error.code!=='SV_PURCHASE_LINKED_SOURCE')throw error;missing.push('linked-config');}
   const raw=await read(Numbering.PATH);try{const counter=Numbering.state(raw),document=values.get('sv_stock_reference_config/activation')??await read('sv_stock_reference_config/activation'),pins=Activation.pins(Object.fromEntries(['schema','generation','baselineDigest','contractDigest','codePins','indexQueryCoverageVersion'].map(field=>[field,document?.[field]])));if(counter.generation!==state.generation||counter.cohortDigest!==digest(pins))missing.push('numbering-cohort');}catch(error){if(!['SV_PURCHASE_NUMBERING','SV_PURCHASE_NUMBERING_BOOTSTRAP_REQUIRED','SV_STOCK_ACTIVATION'].includes(error.code))throw error;missing.push('numbering-state');}
   const [config,fence]=await Promise.all([read(Order.CONFIG),read(Order.FENCE)]);try{Order.validateFence(fence);if(config?.schema!==1||config.ready!==true||config.writersClosed!==true||config.writerVersion!==1||config.generation!==state.generation||fence.generation!==state.generation||fence.invalidCount!==0)missing.push('order-metadata');}catch(error){if(error.code!=='SV_STOCK_ORDER_UNREADY')throw error;missing.push('order-metadata');}
  }
  const ready=state.installed&&state.ready&&missing.length===0,commands=Object.fromEntries(descriptors.map(spec=>[spec.name,ready&&spec.name!=='orderDelete']));
  if(ready&&typeof orderDelete?.capability==='function'&&typeof orderDelete?.handle==='function')commands.orderDelete=(await orderDelete.capability())===true;
  return{version:1,installed:state.installed,ready,generation:state.generation||'',commands,missing};
 }
 async function capabilities(){const {missing,...result}=await readiness();return result;}
 async function handle(path,req,body){
  if(!Object.hasOwn(byPath,path))throw fail('Ruta de Compras desconocida.',404,'SV_PURCHASE_HOST_ROUTE');
  const spec=byPath[path];
  // Preserve the independently reviewed native delete endpoint while migration
  // is OFF. Its own authorization/review/guard remain authoritative.
  if(spec.name==='orderDelete'){if(typeof orderDelete?.handle!=='function')throw fail();const result=await orderDelete.handle(req,body);if(result?.ok!==true||result.committed!==true)throw fail();return{...result,operationId:body.id};}
  // Children revalidate cohort/config/CAS inside the real lease. Repeating the
  // capability preflight here would double remote reads without adding authority.
  if(dependencies().length)throw fail();
  return handlers[spec.name](req,body);
 }
 return Object.freeze({capabilities,readiness,handle,routes:descriptors});
}
module.exports={create,routes:descriptors,byPath};
