'use strict';
// Offline only. Input completeness is a caller declaration checked against the
// supplied bytes, never a claim that a remote database was inspected.
const Accounts=require('./client-account-preparation.cjs'),Ownership=require('../../cotizador/commercial-ownership');
const History=require('../../cotizador/client-history-model'),Financial=require('../../cotizador/sale-financial-dependencies-model');
const Directory=require('../../cotizador/client-account-directory'),Pages=require('../../cotizador/commercial-pages-model'),Membership=require('../../cotizador/payment-membership-index');
const {digest}=require('../../cotizador/labor-guard');
const MAX_BYTES=128*1024*1024;
const SOURCES=Object.freeze(['sisventas/ventas','sisventas/pagos','sisventas/presupuestos','sisventas/clientes','sisventas/clientes_unificados','sisventas/clientes_unificados_indice','sisventas/ordenes_trabajo','sisventas/reclamos','sisventas/tickets','sisventas/equipos','sisventas/gastos','sisventas/ctaemp','sisventas/comisiones_generacion','sv_commission_generation','sv_usuarios','sv_chat_roles','sv_permisos']);
const ROOTS=Object.freeze(['sv_commercial_pages/v1',Membership.INDEX_ROOT,'sv_client_accounts/v1',History.ROOT,Financial.ROOT]);
const DESTINATIONS=Object.freeze([...ROOTS,'sv_client_accounts','sv_client_history','sv_sale_financial_dependencies','sv_commercial_pages_config','sv_client_accounts_config','sv_client_history_config','sv_labor_config']);
const ABSENT=Object.freeze(['sv_client_accounts','sv_client_history','sv_sale_financial_dependencies','sv_client_accounts/v1',History.ROOT,Financial.ROOT,'sv_client_accounts_config','sv_client_history_config']);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const fail=()=>Object.assign(Error('El snapshot o la preparación comercial requiere revisión.'),{code:'SV_COMMERCIAL_CUT_PREPARATION'});
const requireTrue=value=>{if(!value)throw fail();};
const same=(a,b)=>digest(a)===digest(b);
function exact(object,names){requireTrue(plain(object)&&Object.keys(object).length===names.length&&names.every(name=>Object.hasOwn(object,name)));}
function json(value,depth=0,ancestors=new Set()){
 requireTrue(depth<=40);
 if(value===null||typeof value==='string'||typeof value==='boolean')return;
 if(typeof value==='number'){requireTrue(Number.isFinite(value));return;}
 requireTrue((plain(value)||Array.isArray(value))&&!ancestors.has(value));ancestors.add(value);
 for(const [key,child]of Object.entries(value)){requireTrue(!['__proto__','constructor','prototype'].includes(key));json(child,depth+1,ancestors);}ancestors.delete(value);
}
function bounded(value){const bytes=Buffer.byteLength(JSON.stringify(value));requireTrue(bytes<=MAX_BYTES);return bytes;}
function count(path,value){if(value===null)return 0;if(path==='sisventas/ctaemp')return Object.values(value).reduce((n,account)=>{requireTrue(plain(account));return n+Object.keys(account).length;},0);return Object.keys(value).length;}
function fingerprint(path,value){return {sha256:digest(value),count:count(path,value)};}
function validate(input){
 json(input);bounded(input);exact(input,['schema','sources','destinations','snapshotManifest','generations']);requireTrue(input.schema===1);
 exact(input.sources,SOURCES);exact(input.destinations,DESTINATIONS);exact(input.generations,['commercial','accounts','history','financial']);
 for(const generation of Object.values(input.generations))requireTrue(Pages.key(generation));
 const manifest=input.snapshotManifest;exact(manifest,['schema','complete','observedAt','sources','destinations']);requireTrue(manifest.schema===1&&manifest.complete===true&&typeof manifest.observedAt==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(manifest.observedAt)&&Number.isFinite(Date.parse(manifest.observedAt)));
 requireTrue(new Date(manifest.observedAt).toISOString().replace('.000Z','Z')===manifest.observedAt.replace('.000Z','Z'));
 exact(manifest.sources,SOURCES);exact(manifest.destinations,DESTINATIONS);
 for(const path of SOURCES){const value=input.sources[path],entry=manifest.sources[path];requireTrue(plain(value));for(const [key,record]of Object.entries(value)){
  // normalizarPermisosRolesGuardados preserves this numeric root metadata.
  // It is not a role, and remains part of the original hash and entry count.
  if(path==='sv_permisos'&&key==='_version'){requireTrue(Number.isSafeInteger(record)&&record>=0);continue;}
  requireTrue(Pages.key(key)&&plain(record)&&!(path==='sv_permisos'&&key.startsWith('_')));
 }exact(entry,['complete','sha256','count']);requireTrue(entry.complete===true&&same(fingerprint(path,value),{sha256:entry.sha256,count:entry.count}));}
 for(const path of DESTINATIONS){const value=input.destinations[path],entry=manifest.destinations[path];requireTrue(value===null||plain(value));exact(entry,['observed','sha256','count']);requireTrue(entry.observed===true&&same(fingerprint(path,value),{sha256:entry.sha256,count:entry.count}));}
 const pageCoverage=input.destinations[Pages.ROOT]?.coverage,pageConfig=input.destinations.sv_commercial_pages_config,membershipCoverage=input.destinations[Membership.INDEX_ROOT]?.coverage;
 const observed=[];
 for(const metadata of [pageCoverage,pageConfig,membershipCoverage])if(metadata!=null){requireTrue(plain(metadata));if(Object.hasOwn(metadata,'generation')){requireTrue(Pages.key(metadata.generation));observed.push(metadata.generation);}else requireTrue(metadata.ready!==true);}
 if(pageCoverage?.generation&&pageConfig?.generation)requireTrue(pageCoverage.generation===pageConfig.generation);
 requireTrue(!observed.includes(input.generations.commercial));
 for(const path of ABSENT)requireTrue(input.destinations[path]===null);
 return {sources:Object.fromEntries(SOURCES.map(p=>[p,fingerprint(p,input.sources[p])])),destinations:Object.fromEntries(DESTINATIONS.map(p=>[p,fingerprint(p,input.destinations[p])])),observedCommercialGenerations:[...new Set(observed)].sort()};
}
function materialize(root,patch){
 const out={};for(const [path,value]of Object.entries(patch)){requireTrue(path.startsWith(root+'/'));const keys=path.slice(root.length+1).split('/');requireTrue(keys.every(Pages.key));let node=out;for(const key of keys.slice(0,-1)){if(!Object.hasOwn(node,key))node[key]={};requireTrue(plain(node[key]));node=node[key];}if(value===null)delete node[keys.at(-1)];else node[keys.at(-1)]=structuredClone(value);}
 return Financial.normalizeRtdb(out);
}
function at(value,path){return path.split('/').reduce((node,key)=>node&&Object.hasOwn(node,key)?node[key]:null,value)??null;}
async function prepare(input){
 const fingerprints=validate(input),s=input.sources,g=input.generations;
 const customers={clients:s['sisventas/clientes'],structures:s['sisventas/clientes_unificados'],index:s['sisventas/clientes_unificados_indice']};
 const sources={sales:s['sisventas/ventas'],payments:s['sisventas/pagos'],budgets:s['sisventas/presupuestos'],customers,users:s.sv_usuarios,identities:s.sv_chat_roles,permissions:s.sv_permisos};
 // This module rejects ambiguous eligible owner scopes before generating data.
 const accounts=await Accounts.prepare({sources,generation:g.accounts,commercialGeneration:g.commercial,accountDestination:null});Accounts.verify(accounts,sources);
 const people=Ownership.profiles(sources.users,sources.identities),owner=(record,domain)=>Ownership.recordOwner(record,domain,{people},sources.budgets)||'';
 const records=Object.fromEntries(History.domains.map(domain=>[domain,s['sisventas/'+domain]]));
 const history=await History.prepare({records,customers,owner,generation:g.history,revision:1});
 const financial=await Financial.prepare({ventas:sources.sales,gastos:s['sisventas/gastos'],ctaemp:s['sisventas/ctaemp'],comisiones_generacion:s['sisventas/comisiones_generacion'],sv_commission_generation:s.sv_commission_generation},{generation:g.financial});
 const patch={...structuredClone(accounts.patch),[History.ROOT]:materialize(History.ROOT,history.patch),[Financial.ROOT]:materialize(Financial.ROOT,financial.patch)};
 for(const root of ROOTS)patch[root]=Financial.normalizeRtdb(patch[root]);exact(patch,ROOTS);
 const accountRoot=patch['sv_client_accounts/v1'],pageRoot=patch[Pages.ROOT],historyRoot=patch[History.ROOT];
 const directory=materialize(Directory.ROOT,Directory.prepare(customers));requireTrue(same(accountRoot.directory??null,directory));
 const historySources=Object.values(historyRoot.sources||{}).flatMap(domain=>Object.values(domain));
 const issues={unresolvedFinancial:financial.coverage.unresolved,unresolvedSaleOwners:0,unlinkedIdentities:historySources.filter(source=>!['linked','ambiguous'].includes(source.row.identity.status)).length,ambiguousIdentities:historySources.filter(source=>source.row.identity.status==='ambiguous').length,unknownHistoryAmounts:historySources.filter(source=>source.row.amountKnown===false).length};
 let totalCents=0,paidCents=0,balanceCents=0;
 for(const [id]of Object.entries(sources.sales)){
  const a=accountRoot.sources.sales[id],p=pageRoot.records.sales[id],h=historyRoot.sources.ventas[id];
  requireTrue(a&&p&&h&&a.ownerUid===p.ownerUid&&a.ownerUid===h.ownerUid&&same(a.identity,h.row.identity)&&a.public.addressKey===h.row.addressKey&&a.public.addressStatus===h.row.addressStatus);
  for(const field of ['totalCents','paidCents','balanceCents'])requireTrue(a.public[field]===p[field]&&a.public[field]===h.row[field]);
  requireTrue(same(a.sums,h.row.metrics&&Object.fromEntries(Object.keys(a.sums).map(field=>[field,h.row.metrics[field]]))));
  totalCents+=h.row.metrics.totalCents;paidCents+=h.row.metrics.paidCents;balanceCents+=h.row.metrics.balanceCents;
  if(!a.ownerUid)issues.unresolvedSaleOwners++;
 }
 for(const [id]of Object.entries(sources.payments)){
  const a=accountRoot.sources.payments[id],h=historyRoot.sources.pagos[id],p=pageRoot.records.payments[id];
  requireTrue(a&&h&&p&&a.ownerUid===h.ownerUid&&a.ownerUid===p.ownerUid&&same(a.identity,h.row.identity)&&a.public.amountCents===h.row.amountCents&&a.public.amountCents===p.amountCents&&h.row.receivedCents===(a.public.cancelled?0:a.public.amountCents));
 }
 requireTrue(same(accounts.totals,{totalCents,paidCents,balanceCents}));
 for(const domain of History.domains)requireTrue(historyRoot.coverage.all[domain].originalRecords===Object.keys(records[domain]).length);
 for(const [domain,value]of Object.entries({gastos:s['sisventas/gastos'],ctaemp:s['sisventas/ctaemp'],comisiones_generacion:s['sisventas/comisiones_generacion'],sv_commission_generation:s.sv_commission_generation}))requireTrue(financial.coverage.counts[domain]===count(domain==='ctaemp'?'sisventas/ctaemp':domain,value));
 const read=async path=>{for(const root of ROOTS)if(path===root||path.startsWith(root+'/'))return path===root?patch[root]:at(patch[root],path.slice(root.length+1));for(const source of SOURCES)if(path.startsWith(source+'/'))return at(s[source],path.slice(source.length+1));throw fail();};
 if(!issues.unresolvedFinancial){const provider=require('../../cotizador/sale-financial-dependencies-provider').create();for(const id of Object.keys(sources.sales))await provider({saleKey:id,read});}
 requireTrue(same(fingerprints,validate(input)));
 const activation={sv_commercial_pages_config:{...accounts.activation.commercial,searchReady:true,searchSchema:1},sv_client_accounts_config:accounts.activation.accounts,sv_client_history_config:{schema:1,generation:g.history,ready:true,writerSchema:1},'sv_labor_config/writerSchema':2};
 const manifest={schema:1,kind:'commercial-cut-preparation',remoteVerified:false,activationAuthorized:false,cutEligible:false,observedAt:input.snapshotManifest.observedAt,inputManifestSha256:digest(input.snapshotManifest),generations:structuredClone(g),observedCommercialGenerations:fingerprints.observedCommercialGenerations,sourceFingerprints:fingerprints.sources,destinationPreconditions:fingerprints.destinations,derived:Object.fromEntries(ROOTS.map(root=>[root,fingerprint(root,patch[root])])),activationSha256:digest(activation),counts:{sales:Object.keys(sources.sales).length,payments:Object.keys(sources.payments).length,history:history.records},totals:accounts.totals,issues,originalWrites:0};
 const body={schema:1,kind:'commercial-cut-preparation',remoteVerified:false,activationAuthorized:false,cutEligible:false,manifest,manifestSha256:digest(manifest),patch,activation};
 const artifact={...body,artifactDigest:digest(body)};bounded(artifact);return artifact;
}
async function verify(artifact,input){requireTrue(plain(artifact));const {artifactDigest,...body}=artifact;requireTrue(artifact.remoteVerified===false&&artifact.activationAuthorized===false&&digest(body)===artifactDigest&&digest(artifact.manifest)===artifact.manifestSha256);const rebuilt=await prepare(input);requireTrue(rebuilt.artifactDigest===artifactDigest);return true;}
module.exports={prepare,verify,validate,fingerprint,SOURCES,ROOTS,DESTINATIONS,MAX_BYTES};
