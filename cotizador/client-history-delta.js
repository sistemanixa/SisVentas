'use strict';
// Verified contributions only. This is not an HTTP handler and cannot write
// originals. The coordinated writer must validate and supply both images.
const Model=require('./client-history-model'),Commercial=require('./commercial-pages-model');
const ROOT=Model.ROOT,copy=value=>value==null?null:structuredClone(value);
const fail=message=>Object.assign(Error(message),{code:'SV_CLIENT_HISTORY_INCOMPLETE'});
const canonical=value=>value==null?'null':Array.isArray(value)?'['+value.map(canonical).join(',')+']':typeof value==='object'?'{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}':JSON.stringify(value);
function ends(keys){return keys.filter((_,index)=>index%50===49||index===keys.length-1);}
function requirements(source){const value=source?.requirements,embedded=value?.embedded??(value?.embeddedCount===0?[]:null),payments=value?.payments??(value?.paymentsCount===0?[]:null);if(!value||value.schema!==1||!Array.isArray(embedded)||!Array.isArray(payments)||value.embeddedCount!==embedded.length||value.paymentsCount!==payments.length||embedded.some(row=>!Model.domains.includes(row?.domain)||!Commercial.key(row?.key))||payments.some(key=>!Commercial.key(key)))throw fail('Falta la declaración de vínculos de la venta.');return{embedded,payments};}
function dependencies(source){const value=source?.dependencies??(source?.dependenciesCount===0?[]:null);if(!Array.isArray(value)||source.dependenciesCount!==value.length||value.some(path=>{if(typeof path!=='string')return true;if(path.startsWith(ROOT+'/sources/')){const parts=path.slice((ROOT+'/sources/').length).split('/');return parts.length!==2||!Model.domains.includes(parts[0])||!Commercial.key(parts[1]);}if(path.startsWith(Commercial.ROOT+'/saleRefs/')){const parts=path.slice((Commercial.ROOT+'/saleRefs/').length).split('/');return parts.length!==2||!['technical','businessExact','businessDigits'].includes(parts[0])||!/^[a-f0-9]{64}$/.test(parts[1]);}if(!path.startsWith('sv_client_accounts/v1/'))return true;const parts=path.slice('sv_client_accounts/v1/'.length).split('/');return parts.length!==3||!Commercial.key(parts[2])||!(parts[0]==='directory'&&['aliases','clients','index','structures'].includes(parts[1])||parts[0]==='sources'&&['sales','payments'].includes(parts[1]));}))throw fail('Faltan las dependencias de identidad del historial.');return value;}
function validate(source,domain,key,generation){
 if(!source)return;
 const row=source.row;dependencies(source);
 if(!row||row.schema!==1||row.domain!==domain||row.key!==key||row.generation!==generation||!Number.isSafeInteger(row.revision)||row.revision<1||!/^\d{8}_[a-f0-9]{64}$/.test(row.sort)||row.sort!==Model.order(row)||typeof source.ownerUid!=='string'||source.ownerUid&&!Commercial.key(source.ownerUid)||!row.identity||row.accountId!==Commercial.hash(row.identity.accountKey))throw fail('La contribución del historial no está verificada.');
 const summary=Model.empty();Model.sum(summary,row);
 if(typeof row.amountKnown!=='boolean'||!['totalCents','paidCents','balanceCents'].every(field=>Number.isSafeInteger(row[field])))throw fail('Importe de historial inválido.');
 if(domain==='ventas')requirements(source);
}
function keys(value){if(value==null)return new Set();if(typeof value!=='object'||Array.isArray(value)||Object.entries(value).some(([key,present])=>!/^\d{8}_[a-f0-9]{64}$/.test(key)||present!==true))throw fail('La membresía del historial está incompleta.');return new Set(Object.keys(value));}
function verifySummary(summary,members,pageEnds){
 if(!summary||!Model.totalFields.every(field=>Number.isSafeInteger(summary[field]))||summary.rows<0||summary.rows!==members.size||canonical(ends([...members].sort()))!==canonical(pageEnds||[]))throw fail('Los totales no coinciden con la membresía del historial.');
}
function linkChanges(before,after){if(!before)return{all:false,payments:false};const identity=source=>source&&[source.row.identity,source.row.addressKey,source.row.addressStatus,source.ownerUid],all=canonical(identity(before))!==canonical(identity(after))||canonical(requirements(before).embedded)!==canonical(after?requirements(after).embedded:[]);return{all,payments:before.row.paidCents!==after?.row.paidCents||before.row.paymentSource!==after?.row.paymentSource};}
async function delta(changes,{read,generation,revision}={}){
 if(typeof read!=='function'||!Commercial.key(generation)||!Number.isSafeInteger(revision)||revision<2||!Array.isArray(changes))throw fail('Falta la generación coordinada del historial.');
 const state=await read(ROOT+'/state');
 if(state?.schema!==1||state.ready!==true||state.dependencyManifest!==1||state.generation!==generation||state.revision!==revision-1||!Number.isSafeInteger(state.records)||state.records<0)throw fail('La generación del historial cambió.');
 function validateCoverage(value){if(value?.schema!==1||value.ready!==true||value.generation!==generation||!Number.isSafeInteger(value.revision)||value.revision<1||value.revision>state.revision||!['records','originalRecords','unlinkedRecords'].every(field=>Number.isSafeInteger(value[field])&&value[field]>=0)||value.records<value.originalRecords||value.records<value.unlinkedRecords)throw fail('Falta una fuente completa del historial.');return copy(value);}
 const coverages={};let originalCount=0;
 for(const domain of Model.domains){const value=validateCoverage(await read(ROOT+'/coverage/all/'+domain));coverages[domain]=value;originalCount+=value.records;}
 if(originalCount!==state.records)throw fail('La cobertura global del historial no coincide.');
 const seen=new Map(),patch={},buckets=new Map(),affectedDomains=new Set(),scopeCoverage=new Map([['all',coverages]]);
 async function coverageFor(scope){
  if(scopeCoverage.has(scope))return scopeCoverage.get(scope);
  const existing=await read(ROOT+'/scopes/'+scope),values={};if(existing!==null&&existing!==true)throw fail('El ámbito del historial no está verificado.');
  for(const domain of Model.domains){const value=await read(ROOT+'/coverage/'+scope+'/'+domain);if(existing===true)values[domain]=validateCoverage(value);else{if(value)throw fail('El ámbito nuevo tiene datos sin verificar.');values[domain]={schema:1,generation,revision:state.revision,ready:true,records:0,originalRecords:0,unlinkedRecords:0};}}
  scopeCoverage.set(scope,values);patch[ROOT+'/scopes/'+scope]=true;return values;
 }
 for(const change of changes){
  if(!Model.domains.includes(change.domain)||!Commercial.key(change.key)||seen.has(change.domain+'/'+change.key))throw fail('Cambio repetido o inválido del historial.');
  validate(change.before,change.domain,change.key,generation);validate(change.after,change.domain,change.key,generation);
  if(change.before?.row.revision>state.revision)throw fail('La imagen previa del historial cambió.');
  if(canonical(await read(ROOT+'/sources/'+change.domain+'/'+change.key))!==canonical(change.before))throw fail('La fuente del historial cambió durante el guardado.');
  seen.set(change.domain+'/'+change.key,change);
 }
 // Changing a sale's identity requires updating every linked historical source
 // in the same commit. Never leave an old domicile or owner silently attached.
 for(const change of changes)if(change.domain==='ventas'){
  for(const child of change.after?.requirements.embedded||[])if(!seen.get(child.domain+'/'+child.key)?.after)throw fail('Falta registrar el historial embebido en el mismo guardado.');
  for(const key of change.after?.requirements.payments||[])if(!seen.get('pagos/'+key)?.after&&!(await read(ROOT+'/sources/pagos/'+key)))throw fail('Falta el cobro declarado por la venta.');
  if(!change.before)continue;
  const changed=linkChanges(change.before,change.after);
  if(changed.all||changed.payments){
   const related=await read(ROOT+'/relatedSales/'+change.key)||{};
   for(const [domain,records]of Object.entries(related))if(changed.all||changed.payments&&domain==='pagos')for(const [key,present]of Object.entries(records||{}))if(present!==true||!seen.has(domain+'/'+key))throw fail('Falta actualizar un vínculo del historial en el mismo guardado.');
  }
 }
 async function bucket(scope,row){
  const name=scope+'/'+row.accountId+'/'+row.domain;if(buckets.has(name))return buckets.get(name);
  const previous=await read(ROOT+'/accounts/'+name),members=keys(await read(ROOT+'/memberKeys/'+name));
  if(!previous&&members.size)throw fail('Falta el resumen de un historial existente.');
  if(previous&&(previous.schema!==1||previous.generation!==generation||previous.scope!==scope||previous.accountId!==row.accountId||previous.domain!==row.domain||previous.revision>state.revision))throw fail('El resumen del historial cambió.');
  const meta=previous?copy(previous):{schema:1,generation,revision,scope,accountId:row.accountId,domain:row.domain,identity:copy(row.identity),totals:Model.empty(),pageEnds:[],addresses:{}};
  verifySummary(meta.totals,members,meta.pageEnds);meta.addresses||={};
  const value={name,meta,members,addresses:new Map()};buckets.set(name,value);return value;
 }
 async function address(bucket,row){
  const id=Model.addressId(row);if(bucket.addresses.has(id))return bucket.addresses.get(id);
  const members=keys(await read(ROOT+'/addressKeys/'+bucket.name+'/'+id));
  let meta=bucket.meta.addresses[id];if(!meta&&members.size)throw fail('Falta el resumen del domicilio.');
  meta=meta?copy(meta):{recordKey:row.addressKey||null,totals:Model.empty(),pageEnds:[]};
  if((meta.recordKey||'')!==(row.addressKey||''))throw fail('El domicilio del historial cambió.');
  verifySummary(meta.totals,members,meta.pageEnds);const value={id,meta,members};bucket.addresses.set(id,value);return value;
 }
 for(const change of changes){
  patch[ROOT+'/sources/'+change.domain+'/'+change.key]=change.after?{...copy(change.after),row:{...copy(change.after.row),revision}}:null;
  for(const [source,sign]of [[change.before,-1],[change.after,1]])if(source){
   const row={...source.row,revision:sign>0?revision:source.row.revision};
   for(const dependency of dependencies(source))patch[ROOT+'/dependents/'+Commercial.hash(dependency)+'/'+change.domain+'/'+change.key]=sign>0?true:null;
   if(row.saleKey)patch[ROOT+'/relatedSales/'+row.saleKey+'/'+change.domain+'/'+change.key]=sign>0?true:null;
   for(const scope of Model.scopes(change.domain,source.ownerUid)){
    const covered=(await coverageFor(scope))[change.domain];covered.records+=sign;covered.originalRecords+=row.embedded?0:sign;covered.unlinkedRecords+=row.identity.status!=='linked'?sign:0;affectedDomains.add(scope+'/'+change.domain);
    const group=await bucket(scope,row),location=await address(group,row);
    for(const set of [group.members,location.members]){if(sign<0&&!set.has(row.sort)||sign>0&&set.has(row.sort))throw fail('La membresía del historial cambió.');if(sign>0)set.add(row.sort);else set.delete(row.sort);}
    Model.sum(group.meta.totals,row,sign);Model.sum(location.meta.totals,row,sign);
    if(sign>0)group.meta.identity=copy(row.identity);
    patch[ROOT+'/pages/'+group.name+'/'+row.sort]=sign>0?row:null;
    patch[ROOT+'/addresses/'+group.name+'/'+location.id+'/'+row.sort]=sign>0?row:null;
    patch[ROOT+'/memberKeys/'+group.name+'/'+row.sort]=sign>0?true:null;
    patch[ROOT+'/addressKeys/'+group.name+'/'+location.id+'/'+row.sort]=sign>0?true:null;
   }
  }
 }
 for(const group of buckets.values()){
  group.meta.revision=revision;group.meta.pageEnds=ends([...group.members].sort());verifySummary(group.meta.totals,group.members,group.meta.pageEnds);
  for(const location of group.addresses.values()){location.meta.pageEnds=ends([...location.members].sort());verifySummary(location.meta.totals,location.members,location.meta.pageEnds);group.meta.addresses[location.id]=location.meta;}
  const combined=Model.empty();
  for(const location of Object.values(group.meta.addresses))for(const field of Model.totalFields)combined[field]+=location.totals[field];
  if(Model.totalFields.some(field=>!Number.isSafeInteger(combined[field])||combined[field]!==group.meta.totals[field]))throw fail('El total de domicilios no coincide con el historial.');
  patch[ROOT+'/accounts/'+group.name]=group.meta;
 }
 // A new customer in a scope also needs explicit empty tab metadata. Missing
 // metadata remains an error in the reader; it is never interpreted as zero.
 const customers=new Set([...buckets.values()].map(group=>group.name.split('/').slice(0,2).join('/')));
 for(const customer of customers)for(const domain of Model.domains){
  const name=customer+'/'+domain;if(buckets.has(name)||await read(ROOT+'/accounts/'+name))continue;
  if(keys(await read(ROOT+'/memberKeys/'+name)).size)throw fail('Falta un historial existente al preparar sus solapas.');
  const sample=[...buckets.values()].find(group=>group.name.startsWith(customer+'/')).meta;
  const [scope,accountId]=customer.split('/');
  patch[ROOT+'/accounts/'+name]={schema:1,generation,revision:(await coverageFor(scope))[domain].revision,scope,accountId,domain,identity:copy(sample.identity),totals:Model.empty(),pageEnds:[],addresses:{}};
 }
 for(const [scope,values]of scopeCoverage)for(const [domain,value]of Object.entries(values))if(affectedDomains.has(scope+'/'+domain)||!await read(ROOT+'/coverage/'+scope+'/'+domain)){
  if(value.records<0||value.originalRecords<0||value.unlinkedRecords<0||value.records<value.originalRecords||value.records<value.unlinkedRecords)throw fail('La cobertura del historial quedó incompleta.');value.revision=revision;patch[ROOT+'/coverage/'+scope+'/'+domain]=value;
 }
 patch[ROOT+'/state']={...state,revision,records:Object.values(coverages).reduce((sum,value)=>sum+value.records,0)};
 return patch;
}
module.exports={delta,linkChanges};
