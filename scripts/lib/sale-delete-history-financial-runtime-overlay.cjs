'use strict';
// Pure byte derivation only. No filesystem, deployment, flags or attestation IO.
const crypto=require('node:crypto'),path=require('node:path');
const NAMES=Object.freeze(['index.js','labor-runtime.js','labor-guard.js','labor-rtdb-store.js']);
const MODULES=Object.freeze(['client-history-model.js','client-history-delta.js','client-history-projections.js','sale-financial-dependencies-model.js','sale-financial-dependencies-delta.js','sale-financial-dependencies-projections.js','sale-financial-dependencies-protocol.js','sale-financial-dependencies-provider.js']);
const SOURCES=Object.freeze([...NAMES,...MODULES]);
const BASE_IMAGE='southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:00e36728c5d9a895ce5e17cc5e4cede770843831fe0203eabe6f32c2088647e0';
const BASE_HASHES=Object.freeze({'index.js':'41a4073a17e12757033cca69a20b114a3ec76152993b88a8a00b9a1d84b752a0','labor-runtime.js':'ba7c549fe7198be68c4252f6487dce0378a0a2d1a5c4891b030cc9c03c39e2d9','labor-guard.js':'cc107f1d9adb90f2ceaa65526fafd1ce4e4ff049ddd329d1111d0310d52b7f1e','labor-rtdb-store.js':'044d0093e6eee60e7c51e80ead63ebfff2e1dda07d7c8f434c11239a33ad1a2d'});
const PRESERVED_DEPENDENCIES=Object.freeze(['client-account-directory.js','client-account-embedded.js','client-account-ledger.js','client-account-owner-evidence.js','client-account-projection.js','client-account-projections.js','commercial-creator-latest.js','commercial-models/budget-read-model.js','commercial-models/client-account-mode.v1.js','commercial-models/client-identity-model.js','commercial-models/collection-search-model.js','commercial-models/commercial-money.js','commercial-models/identity-index.js','commercial-models/sales-read-model.js','commercial-models/sales-search-model.js','commercial-ownership.js','commercial-pages-model.js','commission-calculations.js','domain-read-policy.js','native-payment-summary.js','payment-membership-index.js','payment-membership-matcher.js']);
const LF=s=>s.replace(/\r\n/g,'\n'),sha=v=>crypto.createHash('sha256').update(v).digest('hex'),plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const fail=m=>{throw Object.assign(Error(m),{code:'SV_SALE_DELETE_HFIN_OVERLAY'});};
function exact(value,names){return plain(value)&&Object.keys(value).length===names.length&&names.every(n=>Object.hasOwn(value,n));}
function bytes(v){if(Buffer.isBuffer(v))return Buffer.from(v);if(typeof v==='string')return Buffer.from(v);fail('Explicit UTF-8 source bytes required');}
function derive({baselines,sources,expectedBaseHashes,expectedSourceHashes,baseImage=BASE_IMAGE}={}){
 if(baseImage!==BASE_IMAGE)fail('Unexpected native20 image');
 for(const [v,names]of [[baselines,NAMES],[expectedBaseHashes,NAMES],[sources,SOURCES],[expectedSourceHashes,SOURCES]])if(!exact(v,names))fail('Exact closed source/hash maps required');
 const base={},source={};for(const n of NAMES){base[n]=bytes(baselines[n]);if(expectedBaseHashes[n]!==BASE_HASHES[n]||sha(base[n])!==BASE_HASHES[n])fail('Native20 baseline changed: '+n);}
 for(const n of SOURCES){source[n]=bytes(sources[n]);if(!/^[a-f0-9]{64}$/.test(expectedSourceHashes[n]||'')||sha(source[n])!==expectedSourceHashes[n])fail('Reviewed source changed: '+n);}
 const allowed=new Set([...SOURCES,...PRESERVED_DEPENDENCIES]);for(const n of MODULES){const text=source[n].toString(),matches=[...text.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)];if(matches.length!==[...text.matchAll(/\brequire\s*\(/g)].length)fail('Nonliteral dependency in '+n);for(const [,ref]of matches){if(['crypto','node:crypto'].includes(ref))continue;if(!ref.startsWith('./'))fail('Unreviewed dependency in '+n);const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(n),ref.endsWith('.js')?ref:ref+'.js'));if(!allowed.has(resolved))fail('Dependency outside native20 closure: '+resolved);}}
 const files={},entries={},hunks={};let current='';
 function once(text,before,after){if(!before||text.split(before).length!==2)fail('Missing/ambiguous native anchor in '+current);(hunks[current]??=[]).push({before,after});return text.replace(before,after);}
 function line(name,prefix){const rows=LF(source[name].toString()).split('\n').filter(s=>s.startsWith(prefix));if(rows.length!==1)fail('Ambiguous reviewed Git hook: '+prefix);return rows[0];}
 function put(name,text){let reversed=text;for(const {before,after}of [...hunks[name]].reverse()){if(reversed.split(after).length!==2)fail('Ambiguous reverse anchor in '+name);reversed=reversed.replace(after,before);}if(reversed!==LF(base[name].toString()))fail('Unrelated native body changed in '+name);files[name]=Buffer.from(text);entries[name]={kind:'derived-native20-hfin',baseRawSha256:sha(base[name]),preservedNormalizedBaseSha256:sha(Buffer.from(reversed)),outputRawSha256:sha(files[name]),patches:hunks[name].map(h=>({beforeSha256:sha(h.before),afterSha256:sha(h.after)}))};}
 current='labor-guard.js';let g=LF(base[current].toString());
 g=once(g,'clientAccounts=false,otDeleteOperational=false','clientAccounts=false,clientHistory=false,saleFinancialDependencies=false,otDeleteOperational=false');
 g=once(g,' const affects=path=>',' const affects=path=>clientHistory&&/^sisventas\\/(ventas|pagos|presupuestos|ordenes_trabajo|reclamos|tickets|equipos)(\\/|$)/.test(path)||');
 g=once(g,'await store.acquire(lease,{clientAccountsWriterVersion:clientAccounts&&commercialPages?1:0})','await store.acquire(lease,{clientAccountsWriterVersion:clientAccounts&&commercialPages?1:0,clientHistoryWriterVersion:clientHistory?1:0,saleFinancialWriterVersion:saleFinancialDependencies?1:0})');
 g=once(g,'  const staged=new Map(),reads=new Map()','  let financialInstalled=false,financialCoverage=null;\n  const staged=new Map(),reads=new Map()');
 g=once(g,'const entries=Object.entries(patch);if(entries.length>20000)',"const entries=Object.entries(patch);if(financialInstalled)for(const [path]of entries)require('./sale-financial-dependencies-projections').originalPath(path);if(entries.length>20000)");
 g=once(g,"'sv_client_accounts','sv_client_accounts_config']","'sv_client_accounts','sv_client_accounts_config','sv_client_history','sv_client_history_config','sv_sale_financial_dependencies']");
 g=once(g,"    const result=await work(scope);live();phase='committing';",line(current,'    if(actor.requiresClientHistory===true)')+'\n'+line(current,'    if(saleFinancialDependencies){const Financial=')+"\n    const result=await work(scope);live();phase='committing';");
 const accounts="    if(clientAccounts){await require('./client-account-projections').augment({patch,raw,get});await require('./client-account-scope-plan').augment({actor,patch,raw});}";
 g=once(g,accounts,accounts+'\n'+line(current,'    if(clientHistory){if(!clientAccounts')+'\n'+line(current,'    const financialMaintenance='));
 g=once(g,'await store.commit(patch,lease,{...actor,clientAccountsWriterVersion:clientAccounts&&commercialPages?1:0})','await store.commit(patch,lease,{...actor,clientAccountsWriterVersion:clientAccounts&&commercialPages?1:0,clientHistoryWriterVersion:clientHistory?1:0,saleFinancialWriterVersion:financialMaintenance.maintained?1:0})');
 g=once(g,'return {run,clientAccounts,clientHistory:false,saleFinancialDependencies:false,affects,','return {run,clientAccounts,clientHistory,saleFinancialDependencies,affects,');put(current,g);
 current='labor-rtdb-store.js';let store=LF(base[current].toString());
 store=once(store,"const {parts}=require('./labor-guard');","const {parts}=require('./labor-guard');\nconst FinancialProtocol=require('./sale-financial-dependencies-protocol');");
 store=once(store,'actor?.clientAccountsWriterVersion===1?{svLaborWriterSchema:2}','actor?.saleFinancialWriterVersion===1||actor?.clientAccountsWriterVersion===1||actor?.clientHistoryWriterVersion===1?{svLaborWriterSchema:2}');
 store=once(store,'svSaleFinancialWriterVersion:0,','...FinancialProtocol.reservedClaims(actor?.saleFinancialWriterVersion),');
 store=once(store,'svClientHistoryWriterVersion:0,','svClientHistoryWriterVersion:actor?.clientHistoryWriterVersion===1?1:0,');
 store=once(store,'{clientAccountsWriterVersion:writer.clientAccountsWriterVersion===1?1:0}','{clientAccountsWriterVersion:writer.clientAccountsWriterVersion===1?1:0,clientHistoryWriterVersion:writer.clientHistoryWriterVersion===1?1:0,saleFinancialWriterVersion:writer.saleFinancialWriterVersion===1?1:0}');put(current,store);
 current='labor-runtime.js';let runtime=LF(base[current].toString());
 runtime=once(runtime,"clientAccounts=process.env.CLIENT_ACCOUNTS_ENABLED==='true',deleteEnvironment=process.env","clientAccounts=process.env.CLIENT_ACCOUNTS_ENABLED==='true',clientHistory=false,saleFinancialDependencies=false,deleteEnvironment=process.env");
 const accountsGate=" if(clientAccounts&&!enabled)throw Error('Las cuentas requieren el guardado coordinado habilitado.');";
 runtime=once(runtime,accountsGate,accountsGate+"\n if((clientHistory||saleFinancialDependencies)&&!enabled)throw Error('Historial y dependencias requieren el guardado coordinado habilitado.');");
 runtime=once(runtime,'clientAccounts:clientAccounts===true,clientHistory:false','clientAccounts:clientAccounts===true,clientHistory:clientHistory===true');
 runtime=once(runtime,'commercialPages,clientAccounts,otDeleteOperational:','commercialPages,clientAccounts,clientHistory,saleFinancialDependencies,otDeleteOperational:');
 runtime=once(runtime,' const scopedDb=enabled?'," store.saleDeleteFinancialEvidence=require('./sale-financial-dependencies-provider').create();\n const scopedDb=enabled?");
 runtime=once(runtime,"clientHistory:false,writerMode:","clientHistory:enabled===true&&commercialPages===true&&clientAccounts===true&&clientHistory===true,writerMode:");put(current,runtime);
 files['index.js']=Buffer.from(base['index.js']);hunks['index.js']=[];entries['index.js']={kind:'preserved-native20',baseRawSha256:sha(base['index.js']),outputRawSha256:sha(files['index.js']),patches:[]};
 for(const n of MODULES){files[n]=Buffer.from(source[n]);entries[n]={kind:'curated-new-leaf',sourceRawSha256:sha(source[n]),outputRawSha256:sha(files[n])};}
 return{files,hunks,manifest:{schema:1,kind:'sale-delete-history-financial-native20',baseImage,files:entries,defaults:{clientHistory:false,saleFinancialDependencies:false},sourceCommit:null,derived:true,indexPreserved:true,gitCoreCopies:false,retainedNativeDependencies:[...PRESERVED_DEPENDENCIES],activation:false}};
}
module.exports=Object.freeze({NAMES,MODULES,SOURCES,BASE_IMAGE,BASE_HASHES,PRESERVED_DEPENDENCIES,derive});
