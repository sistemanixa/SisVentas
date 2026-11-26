'use strict';
// Pure derivation. No files, network, configuration, deployment or data writes.
const crypto=require('node:crypto'),path=require('node:path');
const NAMES=Object.freeze(['index.js','labor-runtime.js','labor-guard.js','labor-rtdb-store.js']);
const MODULES=Object.freeze(['labor-write-gateway.js','sale-delete-command.js','sale-delete-fence.js','sale-delete-http-adapter.js','sale-delete-target-index.js','sale-delete-target-index-delta.js','sale-delete-target-projections.js','sale-delete-targeted-evidence.js','sale-delete-target-preparation.js','sale-delete-target-preparation-http.js']);
const SOURCES=Object.freeze([...NAMES,...MODULES]);
const SOURCE_COMMIT='d5087b2b01bfa1ad426001d791730bc38f8fb85e';
const BASE_IMAGE='southamerica-east1-docker.pkg.dev/nixa-sisventas/cloud-run-source-deploy/cotizador@sha256:7f69f558cbf7a8f149dd8bd87d84f93a6a992218ee42c8ea08e711797b041624';
const BASE_HASHES=Object.freeze({'index.js':'c15c2392bfd45bbae565a6eb3f23d5487f922f679d92f1b303eb8a19379009d3','labor-runtime.js':'1387a5a0e6b17a7ff1ecb211fa4f9eea3758d8959a51703e60d7c4ace089a6c6','labor-guard.js':'9ff1aca384da4d50560affddfba1c67c66e1ab3050a9b71a8568d4738ff97975','labor-rtdb-store.js':'257d4396bf58d92582458decfa3a9f969483597b195b7d3d1c5167acc5ed4913'});
const SOURCE_LF_HASHES=Object.freeze({'index.js':'ef4285386c5b0f71a75cb6ceda1eed8560dd8948f44d4d47900f18703e8b277e','labor-runtime.js':'956dae5285765e53d7c01674dcd6575f649424d77493634e7e613bac91963d1b','labor-guard.js':'4e6fef246fdea5bcfa76dd3afd0598ca4d3d093582ad1514a39f90a4204a81c6','labor-rtdb-store.js':'da45196ac87a70a004c57c4ad7180c17d84b033a4d833471a124d1548b4150f4','labor-write-gateway.js':'357e2c7378aca7371304fdd3ee6b6b59b220ff78e07fece398ae166712a469d0','sale-delete-command.js':'58233b3eb90b41597fcd47de9ef774c197cfcdf318bb00ba7190ba33c72c285c','sale-delete-fence.js':'5fef86eba524858899a29f50f0f1a509f046bfabb9dd07cf35c42e69fcb77567','sale-delete-http-adapter.js':'042e49c76abc1c26df4d66a0c898d4b512317b6237b6e57c1524f38a6c99c24f','sale-delete-target-index.js':'bfc199e5eb2bc8328d2fd1a6df31121f1c66ed0c31c0ee58ac220ab04cb8e4b6','sale-delete-target-index-delta.js':'448547cabf4bacc11216316024a22f94c887ee31f7fc2b2d60ea30d1cee44b61','sale-delete-target-projections.js':'0820cb25e0070e43a002b151b4291a276ab9dccee0d585591b098c6f59177a1b','sale-delete-targeted-evidence.js':'f2a11c1fb56c7f0e80b851298f4aef919fbaf4142ae1e35a37ea496c891a20ad','sale-delete-target-preparation.js':'6ba1d74902d90215f6749be73c5ba9357d1befbb28eabd260dac33031735723c','sale-delete-target-preparation-http.js':'01906fc76cb36d4ec7fbfa52c60d23a7fa2db43e59f2fd543ed51fed906c0a68'});
const PRESERVED_DEPENDENCIES=Object.freeze(['commission-write-proof.js','expense-removal-policy.js','labor-bonus-batch.js','labor-commission-participant.js','labor-db.js','labor-sac-batch.js','payment-membership-index.js','payment-membership-matcher.js','payment-snapshot.js','sale-commission-assignment.js','sale-cost-correction.js','sale-delete-activity.js','sale-delete-live-financial-evidence.js','sale-delete-relations.js','sale-financial-dependencies-delta.js','sale-financial-dependencies-model.js','sale-financial-dependencies-provider.js','sale-return-to-budget.js']);
const lf=s=>s.replace(/\r\n/g,'\n'),sha=v=>crypto.createHash('sha256').update(v).digest('hex'),plain=v=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const fail=message=>{throw Object.assign(Error(message),{code:'SV_SALE_DELETE_TARGETED_OVERLAY'});};
function exact(value,keys){return plain(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k));}
function bytes(value){if(Buffer.isBuffer(value))return Buffer.from(value);if(typeof value==='string')return Buffer.from(value);fail('Explicit UTF-8 bytes required');}
function derive({baselines,sources,expectedBaseHashes,expectedSourceHashes,baseImage=BASE_IMAGE}={}){
 if(baseImage!==BASE_IMAGE)fail('Unexpected current native image');
 for(const[value,keys]of [[baselines,NAMES],[sources,SOURCES],[expectedBaseHashes,NAMES],[expectedSourceHashes,SOURCES]])if(!exact(value,keys))fail('Exact closed source maps required');
 const base={},source={};for(const n of NAMES){base[n]=bytes(baselines[n]);if(expectedBaseHashes[n]!==BASE_HASHES[n]||sha(base[n])!==BASE_HASHES[n])fail('Native baseline changed: '+n);}
 for(const n of SOURCES){source[n]=bytes(sources[n]);if(sha(source[n])!==expectedSourceHashes[n]||sha(lf(source[n].toString()))!==SOURCE_LF_HASHES[n])fail('Frozen source changed: '+n);}
 const allowed=new Set([...SOURCES,...PRESERVED_DEPENDENCIES]);for(const n of MODULES){const body=source[n].toString(),refs=[...body.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)];if(refs.length!==[...body.matchAll(/\brequire\s*\(/g)].length)fail('Nonliteral module dependency: '+n);for(const[,ref]of refs){if(ref.startsWith('node:'))continue;const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(n),ref.endsWith('.js')?ref:ref+'.js'));if(!ref.startsWith('./')||!allowed.has(resolved))fail('Dependency outside closed native set: '+ref);}}
 const files={},hunks={},entries={};let current='';
 function nl(s){return lf(s).replace(/\n/g,base[current].includes(Buffer.from('\r\n'))?'\r\n':'\n');}
 function once(text,before,after){before=nl(before);after=nl(after);if(!before||text.split(before).length!==2)fail('Missing/ambiguous native anchor: '+current);(hunks[current]??=[]).push({before,after});return text.replace(before,after);}
 function put(text){let reverse=text;for(const h of [...hunks[current]].reverse()){if(reverse.split(h.after).length!==2)fail('Ambiguous reverse anchor: '+current);reverse=reverse.replace(h.after,h.before);}if(!Buffer.from(reverse).equals(base[current]))fail('Unrelated native bytes changed: '+current);files[current]=Buffer.from(text);entries[current]={kind:'derived-current-native',baseRawSha256:sha(base[current]),outputRawSha256:sha(files[current]),reversedRawSha256:sha(Buffer.from(reverse)),patches:hunks[current].map(h=>({beforeSha256:sha(h.before),afterSha256:sha(h.after)}))};}
 function line(name,prefix){const found=lf(source[name].toString()).split('\n').filter(s=>s.startsWith(prefix));if(found.length!==1)fail('Missing/ambiguous frozen line: '+prefix);return found[0];}
 function block(name,start,end){const text=lf(source[name].toString());if(text.split(start).length!==2||text.split(end).length!==2)fail('Frozen block anchor ambiguous');const a=text.indexOf(start),b=text.indexOf(end,a);if(b<a)fail('Frozen block invalid');return text.slice(a,b);}
 current='labor-guard.js';let g=base[current].toString();
 g=once(g,'clientAccounts=false,saleDeleteActivity=false,otDeleteOperational=false','clientAccounts=false,saleDeleteActivity=false,saleDeleteRelations=false,otDeleteOperational=false');
 g=once(g,'action=actions[actor.financialAction];',"action=actor.financialAction==='ventas.eliminar.preparar'?['configuracion','mantenimiento','migrar',['admin']]:actions[actor.financialAction];");
 g=once(g,' const context=new AsyncLocalStorage();',line(current," if(typeof saleDeleteRelations!=='boolean'")+'\n const context=new AsyncLocalStorage();');
 g=once(g,' const affects=path=>'," const affects=path=>saleDeleteRelations&&require('./sale-delete-target-projections').affects(path)||");
 g=once(g,'  const staged=new Map(),reads=new Map()', '  let relationsPrepared=false;\n  const staged=new Map(),reads=new Map()');
 g=once(g,"'sv_client_accounts_config'].includes(branch)","'sv_client_accounts_config','sv_sale_delete_relations'].includes(branch)");
 const install=block(current,"  Object.defineProperty(scope,'installSaleDeleteRelations'",'  try{\n   return await context.run(scope,async()=>{');
 g=once(g,'  try{\n   return await context.run(scope,async()=>{',install+'  try{\n   return await context.run(scope,async()=>{');
 g=once(g,'    const revalidateAdvancePeriod=',line(current,'    if(relationsPrepared&&')+'\n    const revalidateAdvancePeriod=');
 g=once(g,'    const receiptResult=',line(current,'    const relationsMaintenance=')+'\n    const receiptResult=');
 g=once(g,"actor.financialAction==='ventas.eliminar'){","['ventas.eliminar','ventas.eliminar.preparar'].includes(actor.financialAction)){");
 g=once(g,'clientAccountsWriterVersion:clientAccounts&&commercialPages?1:0});completed=true;', 'clientAccountsWriterVersion:clientAccounts&&commercialPages?1:0,saleDeleteRelationsWriterVersion:relationsMaintenance.maintained?1:0});completed=true;');
 g=once(g,'return {run,clientAccounts,clientHistory:false,saleFinancialDependencies:false,get saleDeleteActivity()', 'return {run,clientAccounts,clientHistory:false,saleFinancialDependencies:false,saleDeleteRelations,get saleDeleteActivity()');put(g);
 current='labor-rtdb-store.js';let s=base[current].toString();
 s=once(s,'delete clean.svLaborWriterSchema;return clean;', 'delete clean.svLaborWriterSchema;delete clean.svSaleDeleteRelationsWriterVersion;return clean;');
 s=once(s,'...(actor?.clientAccountsWriterVersion===1?{svLaborWriterSchema:2}:{}),','...(actor?.saleDeleteRelationsWriterVersion===1||actor?.clientAccountsWriterVersion===1?{svLaborWriterSchema:2}:{}),');
 s=once(s,'svPaymentIndexVersion:1,svFinancialAction:', 'svPaymentIndexVersion:1,svSaleDeleteRelationsWriterVersion:actor?.saleDeleteRelationsWriterVersion===1?1:0,svFinancialAction:');put(s);
 current='labor-runtime.js';let r=base[current].toString();
 r=once(r,"saleDeleteActivity=false,saleDeleteEvidenceMode='indexed'", "saleDeleteActivity=false,saleDeleteRelations=false,saleDeleteEvidenceMode='indexed'");
 r=once(r,'commercialPages,clientAccounts,saleDeleteActivity,otDeleteOperational:', 'commercialPages,clientAccounts,saleDeleteActivity,saleDeleteRelations,otDeleteOperational:');
 r=once(r,"if(!['indexed','live-originals'].includes(saleDeleteEvidenceMode))", "if(!['indexed','live-originals','targeted'].includes(saleDeleteEvidenceMode)||saleDeleteEvidenceMode==='targeted'&&!saleDeleteRelations)");
 r=once(r," Object.defineProperty(store,'saleDeleteActivityFenceReady'",line(current," if(saleDeleteEvidenceMode==='targeted')")+"\n Object.defineProperty(store,'saleDeleteActivityFenceReady'");put(r);
 current='index.js';let i=base[current].toString();
 i=once(i,"saleDeleteActivity:process.env.SALE_DELETE_READY==='true'", "saleDeleteRelations:process.env.SALE_DELETE_RELATIONS_ENABLED==='true',saleDeleteActivity:process.env.SALE_DELETE_READY==='true'");
 const service=line(current,'const saleDeleteService=');i=once(i,service,service+'\n'+line(current,'const saleDeletePreparation='));
 const route=block(current,"  if(pathname==='/comerciales/ventas/eliminacion/preparar'){","  if(pathname==='/comerciales/ventas/eliminar'){");
 if(route.length>1400||!route.includes('saleDeletePreparation.handle(req,await readBody(req,2048))'))fail('Preparation route outside reviewed contract');
 i=once(i,"  if(pathname==='/comerciales/ventas/eliminar'){",route+"  if(pathname==='/comerciales/ventas/eliminar'){");put(i);
 for(const n of MODULES){files[n]=Buffer.from(source[n]);entries[n]={kind:'curated-targeted-leaf',sourceRawSha256:sha(source[n]),outputRawSha256:sha(files[n])};}
 return {files,hunks,manifest:{schema:1,kind:'sale-delete-targeted-current-native',baseImage,sourceCommit:SOURCE_COMMIT,activation:false,gitCoreCopies:false,historyInstalled:false,financialIndexInstalled:false,defaults:{saleDeleteRelations:false,saleDeleteEvidenceMode:'indexed',clientHistory:false,saleFinancialDependencies:false},retainedNativeDependencies:[...PRESERVED_DEPENDENCIES],files:entries}};
}
module.exports=Object.freeze({derive,NAMES,MODULES,SOURCES,SOURCE_COMMIT,BASE_IMAGE,BASE_HASHES,SOURCE_LF_HASHES,PRESERVED_DEPENDENCIES});
