'use strict';
const Explicit=require('./office-stock-explicit-reference'),Port=require('./office-stock-reference-port'),IO=require('./office-stock-reference-io'),Directed=require('./office-stock-directed-coverage'),Order=require('./office-stock-order');
function create({enabled=false,cohort,store,now=Date.now}={}){
 const assertCompatible=async()=>{if(typeof cohort?.capabilities!=='function')throw Error('Falta verificar la instalación de inventario.');const state=await cohort.capabilities();if(state?.version!==1||typeof state.installed!=='boolean'||typeof state.ready!=='boolean')throw Error('La instalación de inventario no está verificada.');if(enabled===true||state.installed)await cohort.assertAdmission({read:store?.read});};
 if(enabled!==true)return Object.freeze({stockResolver:null,assertCompatible});
 if(!Explicit.isMappedAdmission(cohort?.mappedAdmission)||typeof cohort.assertAdmission!=='function'||typeof store?.queryPage!=='function'||typeof store?.read!=='function')throw Error('Falta la composición verificada de referencias de inventario.');
 const coverage=Directed.createDirectedCoverage({queryPage:store.queryPage}),base=Port.createReferenceResolver({enabled:true,loadCoverage:coverage,queryPage:store.queryPage,mappedAdmission:cohort.mappedAdmission});
 const initialInventoryReference=cohort.absenceAuthority?require('./initial-inventory-reference').create({enabled:true,mappedAdmission:cohort.mappedAdmission,absenceAuthority:cohort.absenceAuthority,now}):null;
 const assertBarrier=options=>cohort.assertAdmission(options);
 const resolveReference=async(original,ports)=>{await assertBarrier({read:ports?.read});return base(original,ports);};
 const stockResolver=Port.createStockReferenceResolver({enabled:true,loadCoverage:coverage,queryPage:store.queryPage,mappedAdmission:cohort.mappedAdmission,assertBarrier});
 return Object.freeze({coverage,assertBarrier,assertCompatible,initialInventoryReference,resolveReference,stockResolver,createReferencePhase:IO.createReferencePhase,readOrderingFence:async()=>{await assertBarrier({read:store.read});return store.read(Order.FENCE);}});
}
module.exports={create};
