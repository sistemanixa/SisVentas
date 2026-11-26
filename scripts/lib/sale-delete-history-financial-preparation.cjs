'use strict';
// Offline proposal only. Existing Accounts/Pages/payment indexes are observed,
// never replaced. Completeness declarations do not certify a remote cut.
const H=require('../../cotizador/client-history-model');
const F=require('../../cotizador/sale-financial-dependencies-model');
const P=require('../../cotizador/client-account-projection');
const Own=require('../../cotizador/commercial-ownership');
const {digest}=require('../../cotizador/labor-guard');
const Preparation=require('./commercial-cut-preparation.cjs');
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=()=>{throw Object.assign(Error('La preparación de Historial y dependencias requiere revisión.'),{code:'SV_SALE_DELETE_PREPARATION'});};
function materialize(root,patch){const out={};for(const[path,value]of Object.entries(patch)){if(!path.startsWith(root+'/'))fail();let node=out;const keys=path.slice(root.length+1).split('/');for(const key of keys.slice(0,-1))node=node[key]??={};if(value!==null)node[keys.at(-1)]=structuredClone(value);}return F.normalizeRtdb(out);}
function validate(input){
 if(!object(input)||input.schema!==1||!object(input.sources)||!object(input.observed)||!object(input.generations)||!object(input.manifest))fail();
 if(Buffer.byteLength(JSON.stringify(input))>Preparation.MAX_BYTES)fail();
 if(Object.keys(input.sources).sort().join('|')!==[...Preparation.SOURCES].sort().join('|'))fail();
 for(const path of Preparation.SOURCES){const value=input.sources[path],proof=input.manifest[path];if(!object(value)||proof?.complete!==true||proof.sha256!==digest(value))fail();}
 const o=input.observed;
 if(o.history!==null||o.historyConfig!==null||o.financial!==null)fail();
 if(o.accountsConfig?.schema!==1||o.accountsConfig.ready!==true||o.accountsCoverage?.schema!==1||o.accountsCoverage.ready!==true||o.accountsConfig.generation!==o.accountsCoverage.generation||!object(o.accountSources))fail();
 if(o.pagesConfig?.ready!==true||o.pagesCoverage?.ready!==true||o.pagesConfig.generation!==o.pagesCoverage.generation)fail();
 for(const generation of [input.generations.history,input.generations.financial])if(typeof generation!=='string'||!/^[A-Za-z0-9_-]{8,160}$/.test(generation))fail();
 return o;
}
async function prepare(input){
 const observed=validate(input),s=input.sources;
 const people=Own.profiles(s.sv_usuarios,s.sv_chat_roles),budgets=s['sisventas/presupuestos'];
 const records=Object.fromEntries(H.domains.map(domain=>[domain,s['sisventas/'+domain]]));
 const customers={clients:s['sisventas/clientes'],structures:s['sisventas/clientes_unificados'],index:s['sisventas/clientes_unificados_indice']};
 const owner=(record,domain)=>Own.recordOwner(record,domain,{people},budgets)||'';
 const history=await H.prepare({records,customers,owner,generation:input.generations.history,revision:1});
 const root=materialize(H.ROOT,history.patch);
 for(const[domain,kind]of [['ventas','sales'],['pagos','payments']]){
  const sources=observed.accountSources[kind]||{};
  if(Object.keys(sources).sort().join('|')!==Object.keys(records[domain]).sort().join('|'))fail();
  for(const key of Object.keys(records[domain])){
   const account=P.validateRow(sources[key],kind),row=root.sources?.[domain]?.[key]?.row;
   if(!row||digest(account.identity)!==digest(row.identity)||account.ownerUid!==root.sources[domain][key].ownerUid)fail();
   if(domain==='ventas')for(const name of ['totalCents','paidCents','balanceCents'])if(account.public[name]!==row[name])fail();
   if(domain==='pagos'&&(account.public.amountCents!==row.amountCents||account.public.cancelled!==row.cancelled||row.receivedCents!==(row.cancelled?0:row.amountCents)))fail();
  }
 }
 const financial=await F.prepare(Object.fromEntries(['ventas',...F.domains].map(domain=>[domain,s[domain==='sv_commission_generation'?domain:'sisventas/'+domain]])),{generation:input.generations.financial});
 const patch={[H.ROOT]:root,[F.ROOT]:materialize(F.ROOT,financial.patch)};
 return {schema:1,kind:'sale-delete-history-financial-preparation',remoteVerified:false,activationAuthorized:false,originalWrites:0,patch,sourceHashes:Object.fromEntries(Preparation.SOURCES.map(path=>[path,digest(s[path])])),observedHash:digest(observed),issues:{unresolvedFinancial:financial.coverage.unresolved},artifactDigest:digest(patch)};
}
module.exports={prepare,validate,materialize};
