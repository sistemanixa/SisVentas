'use strict';
// Pure narrow derivation over the reviewed dedicated runtime; no IO or activation.
const crypto=require('node:crypto');
const BASES=Object.freeze(['labor-guard.js','labor-rtdb-store.js','purchase-delete-server.js','purchase-manual-delete-review.js']);
const LEAVES=Object.freeze(['sale-delete-target-index.js','sale-delete-target-index-delta.js','sale-delete-target-projections.js','sale-financial-dependencies-model.js','sale-financial-dependencies-delta.js']);
const SOURCES=Object.freeze([...LEAVES,'purchase-delete-server.js','purchase-manual-delete-review.js']);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),lf=b=>b.toString().replace(/\r\n/g,'\n');
function derive({baselines,sources,expectedBaseHashes,expectedSourceHashes}){
 const maps=[[baselines,BASES],[sources,SOURCES],[expectedBaseHashes,BASES],[expectedSourceHashes,SOURCES]];
 for(const[m,names]of maps)if(!m||Object.keys(m).sort().join('|')!==[...names].sort().join('|'))throw Error('Exact closed file maps required');
 for(const[n,b]of Object.entries(baselines))if(!Buffer.isBuffer(b)||sha(b)!==expectedBaseHashes[n])throw Error('Native baseline changed: '+n);
 for(const[n,b]of Object.entries(sources))if(!Buffer.isBuffer(b)||sha(b)!==expectedSourceHashes[n])throw Error('Reviewed source changed: '+n);
 const files={},hunks={};let name;
 function once(text,before,after){const nl=s=>s.replace(/\n/g,baselines[name].includes(Buffer.from('\r\n'))?'\r\n':'\n');before=nl(before);after=nl(after);if(text.split(before).length!==2)throw Error('Missing or ambiguous native anchor: '+name);(hunks[name]??=[]).push({before,after});return text.replace(before,()=>after);}
 function put(text){let reversed=text;for(const h of [...hunks[name]].reverse()){if(reversed.split(h.after).length!==2)throw Error('Ambiguous reverse: '+name);reversed=reversed.replace(h.after,()=>h.before);}if(!Buffer.from(reversed).equals(baselines[name]))throw Error('Unrelated native bytes changed: '+name);files[name]=Buffer.from(text);}
 name='labor-guard.js';let g=baselines[name].toString();
 g=once(g,'clientAccounts=false,otDeleteOperational=false','clientAccounts=false,saleDeleteRelations=false,otDeleteOperational=false');
 g=once(g,' const context=new AsyncLocalStorage();'," if(typeof saleDeleteRelations!=='boolean'||saleDeleteRelations&&(!clientAccounts||!commercialPages))throw Error('Los vínculos requieren el guardado comercial coordinado.');\n const context=new AsyncLocalStorage();");
 g=once(g,' const affects=path=>'," const affects=path=>saleDeleteRelations&&require('./sale-delete-target-projections').affects(path)||");
 g=once(g,"'sv_client_accounts_config'].includes(branch)","'sv_client_accounts_config','sv_sale_delete_relations'].includes(branch)");
 g=once(g,'    const receiptResult=',"    const relationsMaintenance=saleDeleteRelations?await require('./sale-delete-target-projections').augment({patch,raw,get,exists:path=>store.exists(path)}):{maintained:false};\n    const receiptResult=");
 g=once(g,'clientAccountsWriterVersion:clientAccounts&&commercialPages?1:0});completed=true;','clientAccountsWriterVersion:clientAccounts&&commercialPages?1:0,saleDeleteRelationsWriterVersion:relationsMaintenance.maintained?1:0});completed=true;');
 g=once(g,'return {run,clientAccounts,clientHistory:false,','return {run,clientAccounts,saleDeleteRelations,clientHistory:false,');put(g);
 name='labor-rtdb-store.js';let store=baselines[name].toString();
 store=once(store,'svPaymentIndexVersion:1,svFinancialAction:','svPaymentIndexVersion:1,svSaleDeleteRelationsWriterVersion:actor?.saleDeleteRelationsWriterVersion===1?1:0,svFinancialAction:');put(store);
 name='purchase-delete-server.js';const server=once(baselines[name].toString(),'clientAccounts:true});','clientAccounts:true,saleDeleteRelations:true});');if(lf(server)!==lf(sources[name]))throw Error('Server changes exceed the projector flag');put(server);
 name='purchase-manual-delete-review.js';const review=once(baselines[name].toString(),'!Array.isArray(protectedOrder.items)||target.numero===protectedOrder.numero','!Array.isArray(protectedOrder.items)');if(lf(review)!==lf(sources[name]))throw Error('Review changes exceed technical identity correction');put(review);
 for(const n of LEAVES)files[n]=Buffer.from(sources[n]);
 return{files,hunks,manifest:{kind:'purchase-delete-relations-overlay',activation:false,files:Object.fromEntries(Object.entries(files).map(([n,b])=>[n,{sha256:sha(b),baseSha256:expectedBaseHashes[n]??null,hunks:hunks[n]?.length||0}]))}};
}
module.exports={derive,BASES,LEAVES,SOURCES};
