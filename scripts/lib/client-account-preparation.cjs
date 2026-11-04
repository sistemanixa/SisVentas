'use strict';
// Offline preparation only. The returned artifact contains private derived data:
// keep it outside Git. This module never opens a connection or applies a patch.
const Accounts=require('../../cotizador/client-account-projections');
const P=require('../../cotizador/client-account-projection');
const Commercial=require('../../cotizador/commercial-pages-projections');
const M=require('../../cotizador/commercial-pages-model');
const Membership=require('../../cotizador/payment-membership-index');
const Ownership=require('../../cotizador/commercial-ownership');
const Evidence=require('../../cotizador/client-account-owner-evidence');
const {digest}=require('../../cotizador/labor-guard');
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const names=['sales','payments','budgets','customers','users','identities','permissions'];
function validate(sources){
 if(!object(sources)||names.some(k=>!Object.hasOwn(sources,k)||!object(sources[k]))||!['clients','index','structures'].every(k=>Object.hasOwn(sources.customers,k)&&object(sources.customers[k])))throw Error('La preparación requiere todas las fuentes explícitas, incluso las vacías.');
}
function fingerprints(sources){validate(sources);return Object.fromEntries(names.map(k=>[k,digest(sources[k])]));}
async function prepare({sources,generation,commercialGeneration,revision=1,accountDestination}={}){
 validate(sources);
 if(accountDestination!==null)throw Error('Esta preparación inicial exige un destino de cuentas ausente y verificado; no reemplaza ámbitos ni evidencia existentes.');
 if(!M.key(generation)||!M.key(commercialGeneration)||revision!==1)throw Error('Una preparación completa requiere una generación nueva con revisión uno.');
 const before=fingerprints(sources),people=Ownership.profiles(sources.users,sources.identities);
 const owner=record=>Ownership.recordOwner(record,'ventas',{people},sources.budgets);
 const eligible=people.filter(p=>Ownership.moduleAllowed(p.role,'cuentacorriente',sources.permissions)),owners=eligible.map(p=>p.uid);
 const aliasTokens=new Map(eligible.map(person=>[person.uid,new Set(person.aliases.map(alias=>Evidence.fromSale({creadaPor:alias}).legacyAliases[0]))])),review=new Map();
 for(const [saleKey,sale]of Object.entries(sources.sales)){
  if(owner(sale))continue;
  // Only the authoritative candidate can make a current scope ambiguous.
  // A converter's name is not ownership when its budget resolves another UID.
  const authoritative=Ownership.ownerSource(sale,'ventas',sources.budgets),hints=Evidence.fromRecord(authoritative.record,authoritative.domain);
  for(const person of eligible)if(hints.uids.includes(person.uid)||hints.legacyAliases.some(alias=>aliasTokens.get(person.uid).has(alias))){
   if(!review.has(person.uid))review.set(person.uid,[]);
   review.get(person.uid).push({saleKey,...(authoritative.domain==='presupuestos'?{budgetKey:Ownership.linkedBudgetKey(sale.presupuestoFbKey)}:{})});
  }
 }
 if(review.size)throw Object.assign(Error('Hay responsables históricos ambiguos. Un administrador debe revisar sus vínculos antes de preparar las cuentas.'),{code:'SV_CLIENT_ACCOUNTS_OWNER_REVIEW',reviewCount:review.size,privateReview:Object.fromEntries(review)});
 const common={sales:sources.sales,payments:sources.payments,owner,revision};
 const accounts=await Accounts.prepare({...common,customers:sources.customers,budgets:sources.budgets,owners,generation});
 const identities=Object.fromEntries(Object.keys(sources.sales).map(key=>[key,accounts.patch[P.ROOT+'/sources/sales/'+key].identity]));
 const sales=Object.fromEntries(Object.entries(sources.sales).map(([key,row])=>[key,identities[key].status==='linked'?{...row,cliente:identities[key].label}:row]));
 const commercial=await Commercial.prepare({...common,sales,clientKey:(row,key)=>identities[key].status==='linked'?identities[key].sourceKey:M.clientIdentity(row),generation:commercialGeneration,nativeCollections:true});
 const membership=Membership.buildIndex(sources.payments,{generation:commercialGeneration,ready:true});
 const coverage=accounts.patch[P.ROOT+'/coverage/all'],evidence=accounts.patch[P.ROOT+'/ownerEvidence'];
 if(coverage?.ownerEvidenceVersion!==1||evidence?.salesRecords!==Object.keys(sources.sales).length||evidence.generation!==generation||evidence.revision!==revision)throw Error('La evidencia de responsables está incompleta.');
 let totalCents=0,paidCents=0,balanceCents=0;
 for(const key of Object.keys(sources.sales)){
  const source=accounts.patch[P.ROOT+'/sources/sales/'+key],row=commercial.patch[M.ROOT+'/records/sales/'+key];
  if(!source||!row||['totalCents','paidCents','balanceCents'].some(k=>source.public[k]!==row[k])||source.ownerUid!==row.ownerUid)throw Error('Las fuentes comerciales y la cuenta no coinciden.');
  for(const field of ['totalCents','paidCents','balanceCents'])if(!Number.isSafeInteger(row[field]))throw Error('Importe fuera de precisión.');
  totalCents+=source.sums.totalCents;paidCents+=source.sums.paidCents;balanceCents+=source.sums.balanceCents;
 }
 const totals=accounts.patch[P.ROOT+'/totals/all'];
 if(![totalCents,paidCents,balanceCents].every(Number.isSafeInteger)||totals.totalCents!==totalCents||totals.paidCents!==paidCents||totals.balanceCents!==balanceCents||balanceCents!==totalCents-paidCents)throw Error('El total no coincide con todas las contribuciones.');
 const commercialTotals=commercial.patch[M.ROOT+'/collectionTotals'];
 if(commercialTotals.debtCents!==balanceCents||commercialTotals.debtorCount!==totals.debtors)throw Error('La deuda o la cantidad de clientes no coincide entre Cobranzas y Cuenta corriente.');
 if(digest(before)!==digest(fingerprints(sources)))throw Error('Las fuentes cambiaron durante la preparación.');
 // Full replacements, never a sparse overlay: old lookup/payment membership
 // entries must disappear when they no longer exist in the new complete input.
 const roots=[P.ROOT,M.ROOT,Membership.INDEX_ROOT],patch=Object.fromEntries(roots.map(root=>[root,{}]));
 for(const [path,value]of Object.entries({...commercial.patch,...membership.patch,...accounts.patch})){
  const root=roots.find(root=>path.startsWith(root+'/'));if(!root)throw Error('La preparación intenta modificar un original.');
  const parts=path.slice(root.length+1).split('/');let node=patch[root];for(const part of parts.slice(0,-1))node=node[part]||(node[part]={});node[parts.at(-1)]=value;
 }
 const plan={schema:1,sourceFingerprints:before,generation,commercialGeneration,revision,patchDigest:digest(patch),patch,
  counts:{sales:accounts.sales,payments:accounts.payments,eligibleOwners:new Set(owners).size},
  totals:{totalCents,paidCents,balanceCents},
  // Separate from data: a caller must finish rules, fences and compatible
  // clients before activation. A successful preparation is never permission.
  activation:{accounts:{schema:1,generation,ready:true,scopeBootstrapVersion:1},commercial:{schema:1,generation:commercialGeneration,ready:true,nativeCollectionsReady:true,nativeCollectionsSchema:1}}};
 return{...plan,artifactDigest:digest(plan)};
}
function verify(plan,sources){
 const {artifactDigest,...body}=plan||{};
 if(plan?.schema!==1||!object(plan.patch)||digest(body)!==artifactDigest||digest(plan.patch)!==plan.patchDigest||digest(fingerprints(sources))!==digest(plan.sourceFingerprints))throw Error('La preparación cambió o quedó obsoleta; hay que volver a prepararla.');
 return true;
}
module.exports={prepare,verify,fingerprints};
