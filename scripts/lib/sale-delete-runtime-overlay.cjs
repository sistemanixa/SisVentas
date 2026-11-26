'use strict';
// Pure extension over the reviewed native20 H/Financial derivation. Never copy
// the Git cores wholesale: they contain other, unpublished feature families.
const crypto=require('node:crypto');
const path=require('node:path');
const HF=require('./sale-delete-history-financial-runtime-overlay.cjs');
const MODULES=Object.freeze(['sale-delete-command.js','sale-delete-fence.js','sale-delete-relations.js','sale-delete-activity.js','sale-delete-http-adapter.js']);
const SOURCES=Object.freeze([...HF.SOURCES,...MODULES]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const LF=b=>b.toString().replace(/\r\n/g,'\n');
const fail=message=>{throw Object.assign(Error(message),{code:'SV_SALE_DELETE_RUNTIME_OVERLAY'});};
function derive(input){
 if(!input?.sources||!input.expectedSourceHashes||Object.keys(input.sources).sort().join('|')!==[...SOURCES].sort().join('|')||Object.keys(input.expectedSourceHashes).sort().join('|')!==[...SOURCES].sort().join('|'))fail('Exact reviewed sources required.');
 for(const n of SOURCES)if(!Buffer.isBuffer(input.sources[n])||hash(input.sources[n])!==input.expectedSourceHashes[n])fail('Source hash changed: '+n);
 const allowed=new Set([...SOURCES,...HF.PRESERVED_DEPENDENCIES,'payment-snapshot.js','ot-delete-policy.js']);
 for(const n of MODULES){const source=input.sources[n].toString(),imports=[...source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)];if(imports.length!==[...source.matchAll(/\brequire\s*\(/g)].length)fail('Dynamic dependency: '+n);for(const[,ref]of imports){if(!ref.startsWith('./')||!allowed.has(path.posix.normalize(ref.slice(2)+(ref.endsWith('.js')?'':'.js'))))fail('Dependency outside reviewed closure: '+ref);}}
 const select=(v,names)=>Object.fromEntries(names.map(n=>[n,v[n]]));
 const initial=HF.derive({...input,sources:select(input.sources,HF.SOURCES),expectedSourceHashes:select(input.expectedSourceHashes,HF.SOURCES)});
 const files={...initial.files},hunks={};let name='';
 function once(text,before,after){if(!before||text.split(before).length!==2)fail('Native anchor missing or ambiguous: '+name);(hunks[name]??=[]).push({before,after});return text.replace(before,after);}
 function put(text){let reverse=text;for(const h of [...hunks[name]].reverse()){if(reverse.split(h.after).length!==2)fail('Reverse anchor changed: '+name);reverse=reverse.replace(h.after,h.before);}if(reverse!==LF(initial.files[name]))fail('Unrelated native body changed: '+name);files[name]=Buffer.from(text);}
 name='labor-guard.js';let text=LF(files[name]);
 text=once(text,'saleFinancialDependencies=false,otDeleteOperational=false','saleFinancialDependencies=false,saleDeleteActivity=false,otDeleteOperational=false');
 const validation=" if(typeof saleDeleteActivity!=='boolean'||saleDeleteActivity&&(!clientAccounts||!commercialPages||!clientHistory||!saleFinancialDependencies))throw Error('El cierre de actividad requiere proyecciones coordinadas completas.');";
 if(!LF(input.sources[name]).includes(validation))fail('Reviewed activity validation missing.');
 text=once(text,' const context=new AsyncLocalStorage();',validation+'\n const context=new AsyncLocalStorage();');
 text=once(text,' const affects=path=>',' const affects=path=>saleDeleteActivity&&/^sisventas\\/(agenda|ordenes|listas_materiales|remitos|equipos|tickets|ordenesTrabajo)(\\/|$)/.test(path)||');
 text=once(text,'clientes_unificados_indice|presupuestos)(\\/|$)/.test(path)||affected(path)','clientes_unificados_indice|presupuestos|reclamos|equipos|tickets)(\\/|$)/.test(path)||affected(path)');
 text=once(text,'const actions={',"const actions={'ventas.eliminar':['venta','ventas','eliminar',['admin']],");
 text=once(text,'return {run,clientAccounts,clientHistory,saleFinancialDependencies,affects,','return {run,clientAccounts,clientHistory,saleFinancialDependencies,get saleDeleteActivity(){return saleDeleteActivity;},affects,');put(text);
 name='labor-runtime.js';text=LF(files[name]);
 text=once(text,'clientHistory=false,saleFinancialDependencies=false,deleteEnvironment=','clientHistory=false,saleFinancialDependencies=false,saleDeleteActivity=false,deleteEnvironment=');
 text=once(text,'commercialPages,clientAccounts,clientHistory,saleFinancialDependencies,otDeleteOperational:','commercialPages,clientAccounts,clientHistory,saleFinancialDependencies,saleDeleteActivity,otDeleteOperational:');
 const provider=" store.saleDeleteFinancialEvidence=require('./sale-financial-dependencies-provider').create();";
 text=once(text,provider,provider+"\n Object.defineProperty(store,'saleDeleteActivityFenceReady',{enumerable:true,get:()=>guard.saleDeleteActivity===true});");put(text);
 name='index.js';text=LF(files[name]);
 text=once(text,'enabled:laborScopedEnabled,operationalSummaries:',"enabled:laborScopedEnabled,clientHistory:process.env.CLIENT_HISTORY_ENABLED==='true',saleFinancialDependencies:process.env.SALE_FINANCIAL_DEPENDENCIES_ENABLED==='true',saleDeleteActivity:process.env.SALE_DELETE_READY==='true'&&process.env.SALE_DELETE_FENCE_READY==='true',operationalSummaries:");
 const gateway="const laborWriteGateway=require('./labor-write-gateway').createLaborWriteGateway({auth:businessAuth,db,guard:laborRuntime.guard,store:laborRuntime.store,enabled:laborScopedEnabled});";
 const service="laborRuntime.store.saleDeleteFenceReady=process.env.SALE_DELETE_FENCE_READY==='true';\nconst saleDeleteService=require('./sale-delete-http-adapter').createSaleDeleteHttpAdapter({authorize:laborWriteGateway.authorize,guard:laborRuntime.guard,store:laborRuntime.store,enabled:laborScopedEnabled&&process.env.SALE_DELETE_READY==='true'});";
 text=once(text,gateway,gateway+'\n'+service);
 const source=LF(input.sources[name]),start=source.indexOf("  if(pathname==='/comerciales/ventas/eliminar'){"),end=source.indexOf("  if(pathname.startsWith('/comerciales/')){",start);
 if(start<0||end<start||source.indexOf("  if(pathname==='/comerciales/ventas/eliminar'){",start+1)!==-1)fail('Reviewed delete route missing.');
 const route=source.slice(start,end);if(route.length>1200||!route.includes('readBody(req,2048)')||!route.includes('saleDeleteService.handle(req,body)'))fail('Delete route shape changed.');
 text=once(text,"  if(pathname.startsWith('/comerciales/')){",route+"  if(pathname.startsWith('/comerciales/')){");
 text=once(text,'adminExpense:adminExpenseCreate.capability(),otDelete:', 'adminExpense:adminExpenseCreate.capability(),saleDelete:{version:1,enabled:saleDeleteService.capability()},otDelete:');put(text);
 for(const n of MODULES)files[n]=Buffer.from(input.sources[n]);
 return {files,hunks,historyFinancial:initial.manifest,manifest:{schema:1,baseImage:HF.BASE_IMAGE,kind:'sale-delete-native20-extension',activation:false,newModules:[...HF.MODULES,...MODULES],changedNative:['index.js','labor-guard.js','labor-runtime.js','labor-rtdb-store.js'],nativePreservationByReverse:true,files:Object.fromEntries(Object.entries(files).map(([n,b])=>[n,hash(b)])),patches:Object.fromEntries(Object.entries(hunks).map(([n,hs])=>[n,hs.map(h=>({beforeSha256:hash(h.before),afterSha256:hash(h.after)}))]))}};
}
module.exports={derive,MODULES,SOURCES};
