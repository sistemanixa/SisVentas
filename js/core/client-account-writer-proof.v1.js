(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVClientAccountWriterProof=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
// Proposed bridge contract: reuse existing readable, server-owned Pages metadata.
// A failed read, unknown record or previously observed coordinated mode never
// selects legacy. There is deliberately no catch/fallback in this module.
const validKey=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const failure=(message,code='SV_CLIENT_ACCOUNTS_MODE_UNVERIFIED')=>Object.assign(Error(message),{code});
function inspect(pages,{installed=false}={}){
 if(!pages||pages.schema!==1||typeof pages.ready!=='boolean'||!validKey(pages.generation))throw failure('No se pudo verificar el modo de guardado. Actualizá para continuar.');
 if(pages.accountWriter===undefined){if(installed)throw failure('El guardado está temporalmente en actualización. Tus cambios siguen en el formulario.','SV_CLIENT_ACCOUNTS_PAUSED');if(pages.ready!==true)throw failure('El guardado está temporalmente en actualización. Tus cambios siguen en el formulario.','SV_CLIENT_ACCOUNTS_PAUSED');return{coordinated:false,config:null};}
 const a=pages.accountWriter;
 if(!a||a.schema!==1||!validKey(a.generation)||a.writerMode!=='coordinated-v1'||a.scopeBootstrapVersion!==1||Object.keys(a).sort().join(',')!=='generation,schema,scopeBootstrapVersion,writerMode')throw failure('No se pudo verificar la configuración de cuentas.');
 return{coordinated:true,envelope:{...a},pagesReady:pages.ready};
}
async function resolve({read,installed=false,valid=()=>true,onCoordinated=()=>{}}={}){
 if(typeof read!=='function')throw Error('Authorized metadata reader required.');
 const check=()=>{if(!valid())throw Object.assign(Error('La sesión cambió.'),{name:'AbortError'});};check();const pages=await read('sv_commercial_pages_config');check();const proof=inspect(pages,{installed});if(!proof.coordinated)return proof;
 onCoordinated();const config=await read('sv_client_accounts_config');check();
 if(!config||Object.entries(proof.envelope).some(([k,v])=>config[k]!==v)||typeof config.ready!=='boolean')throw failure('Actualizá SisVentas para verificar la configuración de cuentas.');
 if(!proof.pagesReady||!config.ready)throw failure('El guardado está temporalmente en actualización. Tus cambios siguen en el formulario.','SV_CLIENT_ACCOUNTS_PAUSED');
 return{coordinated:true,config,pagesGeneration:pages.generation};
}
return {inspect,resolve};});
