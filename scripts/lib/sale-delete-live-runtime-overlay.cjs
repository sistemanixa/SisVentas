'use strict';
// Pure byte derivation only. No filesystem, deployment, flags or attestation IO.
const crypto=require('node:crypto'),path=require('node:path');
const NAMES=Object.freeze(['index.js','labor-runtime.js','labor-guard.js','labor-rtdb-store.js']);
const MODULES=Object.freeze(['sale-delete-command.js','sale-delete-fence.js','sale-delete-relations.js','sale-delete-activity.js','sale-delete-http-adapter.js','sale-delete-live-financial-evidence.js','sale-delete-source-reader.js','sale-financial-dependencies-model.js','sale-financial-dependencies-delta.js','sale-financial-dependencies-provider.js']);
const SOURCES=Object.freeze([...NAMES,...MODULES]);
const BASE_IMAGE='southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:00e36728c5d9a895ce5e17cc5e4cede770843831fe0203eabe6f32c2088647e0';
const BASE_HASHES=Object.freeze({'index.js':'41a4073a17e12757033cca69a20b114a3ec76152993b88a8a00b9a1d84b752a0','labor-runtime.js':'ba7c549fe7198be68c4252f6487dce0378a0a2d1a5c4891b030cc9c03c39e2d9','labor-guard.js':'cc107f1d9adb90f2ceaa65526fafd1ce4e4ff049ddd329d1111d0310d52b7f1e','labor-rtdb-store.js':'044d0093e6eee60e7c51e80ead63ebfff2e1dda07d7c8f434c11239a33ad1a2d'});
const PRESERVED_DEPENDENCIES=Object.freeze(['payment-membership-matcher.js','payment-membership-index.js','payment-snapshot.js','ot-delete-policy.js','commission-calculations.js']);
const LF=s=>s.replace(/\r\n/g,'\n'),sha=v=>crypto.createHash('sha256').update(v).digest('hex'),plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const fail=m=>{throw Object.assign(Error(m),{code:'SV_SALE_DELETE_LIVE_OVERLAY'});};
function exact(value,names){return plain(value)&&Object.keys(value).length===names.length&&names.every(n=>Object.hasOwn(value,n));}
function bytes(v){if(Buffer.isBuffer(v))return Buffer.from(v);if(typeof v==='string')return Buffer.from(v);fail('Explicit UTF-8 source bytes required');}
const SOURCE_COMMIT='08bba18c66c971fe9beaf03132b613c0d50bfeea';
const SOURCE_LF_HASHES=Object.freeze({"index.js":"a9934b763fb28f903b1212420a1ba32c3ec22173506001cb07559d7bcce37c00","labor-runtime.js":"111c4d55129c9cb9feddb644b73c64a8d2de58738ba1994e39b76729709b789d","labor-guard.js":"a3f4d0d52c575bb86b9620508cf7a9fdb3640370e86e5822c13721fe1aa7854c","labor-rtdb-store.js":"a745c43504d3918662a1688669e687a01b0c20062374d8fb87c7203a3d5f2208","sale-delete-command.js":"bb0b12c29411669d6a4958648c73dda31356e11bfde8fe241668663928b757fd","sale-delete-fence.js":"ae553e57f73551f1c1ef8d23a014afa54a58dd0e840ae2d01620ddf6037c34ff","sale-delete-relations.js":"d064aea1df3f500b4fb46ca77e94988b8da44af30a384a60e368cf0525279772","sale-delete-activity.js":"cb43f05ab4e67aab80f53d1ae0689b86ab6cf7e847de9dfd90d4202cd73e339f","sale-delete-http-adapter.js":"9b656f6071a9c6fd107b14fd080001528bc0212e1abd83f44588cb330499a2ab","sale-delete-live-financial-evidence.js":"2df2f5f738d220289f8b88b9a77ee98550fcd877b727dc6967e54e8521f63a72","sale-financial-dependencies-model.js":"5f53a70973b0b87dbf531d237489f6f55c5c713f639b9a0a97876ab2f1fdb2dd","sale-financial-dependencies-delta.js":"b2b36fcd0d1c7d66f93cb4e0f8992e4c0429ad767f19d43fff127372c0006be8","sale-financial-dependencies-provider.js":"546358b43d5e754a01d80eb8fe2f8cb327ba4db07362d40141b6ef07c355e2be","sale-delete-source-reader.js":"69363f568b74c616a53a3f6e7a20dff7d929f3c7a78a3d7c0cc5d14500c86052"});
function derive({baselines,sources,expectedBaseHashes,expectedSourceHashes,baseImage=BASE_IMAGE}={}){
 if(baseImage!==BASE_IMAGE)fail('Unexpected native20 image');
 for(const [v,n]of [[baselines,NAMES],[expectedBaseHashes,NAMES],[sources,SOURCES],[expectedSourceHashes,SOURCES]])if(!exact(v,n))fail('Exact closed source/hash maps required');
 const base={},source={};for(const n of NAMES){base[n]=bytes(baselines[n]);if(expectedBaseHashes[n]!==BASE_HASHES[n]||sha(base[n])!==BASE_HASHES[n])fail('Native20 baseline changed: '+n);}
 for(const n of SOURCES){source[n]=bytes(sources[n]);if(sha(source[n])!==expectedSourceHashes[n]||sha(LF(source[n].toString()))!==SOURCE_LF_HASHES[n])fail('Frozen source changed: '+n);}
 const allowed=new Set([...SOURCES,...PRESERVED_DEPENDENCIES]);for(const n of MODULES){const text=source[n].toString(),refs=[...text.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)];if(refs.length!==[...text.matchAll(/\brequire\s*\(/g)].length)fail('Nonliteral dependency: '+n);for(const[,ref]of refs){if(['crypto','node:crypto'].includes(ref))continue;const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(n),ref.endsWith('.js')?ref:ref+'.js'));if(!ref.startsWith('./')||!allowed.has(resolved))fail('Dependency outside native20 closure: '+ref);}}
 const files={},hunks={},entries={};let current='';
 function once(text,before,after){if(!before||text.split(before).length!==2)fail('Missing/ambiguous native anchor: '+current);(hunks[current]??=[]).push({before,after});return text.replace(before,after);}
 function put(text,{raw=false}={}){let reverse=text;for(const h of [...hunks[current]].reverse()){if(reverse.split(h.after).length!==2)fail('Ambiguous reverse anchor: '+current);reverse=reverse.replace(h.after,h.before);}if(reverse!==(raw?base[current].toString():LF(base[current].toString())))fail('Unrelated native body changed: '+current);files[current]=Buffer.from(text);entries[current]={kind:'derived-native20-live',baseRawSha256:sha(base[current]),outputRawSha256:sha(files[current]),preservedLFHash:sha(LF(reverse)),patches:hunks[current].map(h=>({beforeSha256:sha(h.before),afterSha256:sha(h.after)}))};}
 function sourceLine(name,prefix){const rows=LF(source[name].toString()).split('\n').filter(s=>s.startsWith(prefix));if(rows.length!==1)fail('Frozen hook missing/ambiguous: '+prefix);return rows[0];}
 current='labor-guard.js';let g=LF(base[current].toString());
 g=once(g,'clientAccounts=false,otDeleteOperational=false','clientAccounts=false,saleDeleteActivity=false,otDeleteOperational=false');
 g=once(g,' const context=new AsyncLocalStorage();',sourceLine(current," if(typeof saleDeleteActivity!=='boolean'")+'\n const context=new AsyncLocalStorage();');
 g=once(g,' const affects=path=>',' const affects=path=>saleDeleteActivity&&/^sisventas\\/(agenda|ordenes|listas_materiales|remitos|equipos|tickets|ordenesTrabajo)(\\/|$)/.test(path)||');
 g=once(g,'const actions={',"const actions={'ventas.eliminar':['venta','ventas','eliminar',['admin']],");
 g=once(g,"if((actor.mode==='user'||actor.mode==='command')&&actor.financialAction){", "if((actor.mode==='user'||actor.mode==='command')&&actor.financialAction&&actor.financialAction!=='ventas.eliminar'){");
 const sourceGuard=LF(source[current].toString()),start=sourceGuard.indexOf("    if((actor.mode==='user'||actor.mode==='command')&&actor.financialAction==='ventas.eliminar'){");
 const end=sourceGuard.indexOf('    live();await store.commit',start);if(start<0||end<start)fail('Frozen late permission check missing');
 g=once(g,'    live();await store.commit',sourceGuard.slice(start,end)+'    live();await store.commit');
 g=once(g,'for(const check of finalChecks){live();await check({readFresh:', 'for(const check of finalChecks){live();await check({assertActive:live,readFresh:');
 g=once(g,'return {run,clientAccounts,clientHistory:false,saleFinancialDependencies:false,affects,','return {run,clientAccounts,clientHistory:false,saleFinancialDependencies:false,get saleDeleteActivity(){return saleDeleteActivity;},affects,');put(g);
 current='labor-runtime.js';let r=LF(base[current].toString());
 r=once(r,'clientAccounts=process.env.CLIENT_ACCOUNTS_ENABLED===\'true\',deleteEnvironment=process.env',"clientAccounts=process.env.CLIENT_ACCOUNTS_ENABLED==='true',saleDeleteActivity=false,saleDeleteEvidenceMode='indexed',deleteEnvironment=process.env");
 r=once(r,'commercialPages,clientAccounts,otDeleteOperational:','commercialPages,clientAccounts,saleDeleteActivity,otDeleteOperational:');
 r=once(r,' const scopedDb=enabled?'," if(!['indexed','live-originals'].includes(saleDeleteEvidenceMode))throw Error('Modo de evidencia de borrado incompatible con el runtime nativo.');\n"+sourceLine(current,' store.saleDeleteFinancialEvidence=')+'\n'+sourceLine(current," Object.defineProperty(store,'saleDeleteActivityFenceReady'")+'\n const scopedDb=enabled?');put(r);
 current='index.js';let i=LF(base[current].toString());
 i=once(i,'enabled:laborScopedEnabled,operationalSummaries:',"enabled:laborScopedEnabled,saleDeleteActivity:process.env.SALE_DELETE_READY==='true'&&process.env.SALE_DELETE_FENCE_READY==='true',saleDeleteEvidenceMode:process.env.SALE_DELETE_EVIDENCE_MODE||'indexed',operationalSummaries:");
 const gateway="const laborWriteGateway=require('./labor-write-gateway').createLaborWriteGateway({auth:businessAuth,db,guard:laborRuntime.guard,store:laborRuntime.store,enabled:laborScopedEnabled});";
 i=once(i,gateway,gateway+'\n'+sourceLine(current,'laborRuntime.store.saleDeleteFenceReady=')+'\n'+sourceLine(current,'const saleDeleteService='));
 const originalIndex=LF(source[current].toString()),routeStart=originalIndex.indexOf("  if(pathname==='/comerciales/ventas/eliminar'){"),routeEnd=originalIndex.indexOf("  if(pathname.startsWith('/comerciales/')){",routeStart);
 if(routeStart<0||routeEnd<routeStart)fail('Frozen delete route missing');const route=originalIndex.slice(routeStart,routeEnd);if(route.length>1200||!route.includes('readBody(req,2048)')||!route.includes('saleDeleteService.handle(req,body)'))fail('Delete route changed');
 i=once(i,"  if(pathname.startsWith('/comerciales/')){",route+"  if(pathname.startsWith('/comerciales/')){");
 i=once(i,'adminExpense:adminExpenseCreate.capability(),otDelete:','adminExpense:adminExpenseCreate.capability(),saleDelete:{version:1,enabled:saleDeleteService.capability()},otDelete:');put(i);
 current='labor-rtdb-store.js';let store=base[current].toString();
 const readerFactory="createSaleDeleteSourceReader:()=>require('./sale-delete-source-reader').create({databaseURL,accessToken,fetchImpl,requestMs}),";
 if(!sourceLine(current,' const api={').startsWith(' const api={'+readerFactory))fail('Frozen readonly reader factory changed');
 store=once(store,' const api={employeeResourcesCommitVersion:1,read,readQuery,',' const api={employeeResourcesCommitVersion:1,'+readerFactory+'read,readQuery,');put(store,{raw:true});
 for(const n of MODULES){files[n]=Buffer.from(source[n]);entries[n]={kind:'curated-new-leaf',sourceRawSha256:sha(source[n]),outputRawSha256:sha(files[n])};}
 return {files,hunks,manifest:{schema:1,kind:'sale-delete-live-native20',baseImage,sourceCommit:SOURCE_COMMIT,activation:false,gitCoreCopies:false,storePreserved:false,storeReadonlyFactoryOnly:true,defaults:{clientHistory:false,saleFinancialDependencies:false,saleDeleteActivity:false,saleDeleteEvidenceMode:'indexed'},retainedNativeDependencies:[...PRESERVED_DEPENDENCIES],files:entries}};
}
module.exports=Object.freeze({derive,NAMES,MODULES,SOURCES,BASE_IMAGE,BASE_HASHES,SOURCE_COMMIT,SOURCE_LF_HASHES,PRESERVED_DEPENDENCIES});
