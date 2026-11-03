'use strict';
// Offline model only. Its output must not be enabled until every writer and
// permission-specific reader maintains the same generation atomically.
const Accounts=require('./client-account-projections');
const Account=require('./client-account-projection');
const Commercial=require('./commercial-pages-model');
const Identity=require('./commercial-models/client-identity-model');
const Matcher=require('./payment-membership-matcher');
const Money=require('./commercial-models/commercial-money');
const ROOT='sv_client_history/v1';
const domains=Object.freeze(['ventas','pagos','presupuestos','ordenes_trabajo','reclamos','tickets','equipos']);
const fail=message=>Object.assign(Error(message),{code:'SV_CLIENT_HISTORY_INCOMPLETE'});
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const safe=(value,limit=200)=>typeof value==='string'?value.slice(0,limit):'';
const clone=value=>structuredClone(value);
const totalFields=['rows','totalCents','paidCents','balanceCents','receivedCents','unknownAmounts'];
function empty(){return{rows:0,totalCents:0,paidCents:0,balanceCents:0,receivedCents:0,unknownAmounts:0};}
function scopes(domain,uid){return ['ventas','pagos','presupuestos'].includes(domain)?Commercial.scopes(uid):['all'];}
function order(row){return String(99999999-Number((row.date||'0000-00-00').replaceAll('-',''))).padStart(8,'0')+'_'+Account.hash(row.key);}
function addressId(row){return row.addressKey?'a_'+Account.hash(row.addressKey):'unknown';}
function sum(target,row,sign=1){
 for(const field of totalFields){target[field]+=sign*(field==='rows'?1:field==='unknownAmounts'?Number(row.amountKnown===false):row.metrics?.[field]??row[field]??0);if(!Number.isSafeInteger(target[field]))throw fail('El resumen del historial excede su precisión.');}
}
function date(record){const value=safe(record.fecha||record.fechaProgramada||record.fechaInstalacion,10);return /^\d{4}-\d{2}-\d{2}$/.test(value)?value:'';}
function relation(record,sales){
 const explicit=[...new Set(['ventaFbKey','ventaKey','ventaGeneradaFbKey','ventaOrigenFbKey'].map(field=>record[field]).filter(Boolean).map(String))];
 if(explicit.length)return explicit.length===1&&sales[explicit[0]]?explicit[0]:false;
 const hasReference=['venta','ventaId','idVenta','nroVenta','numeroVenta'].some(field=>record[field]);
 if(!hasReference)return null;
 const matches=Object.entries(sales).filter(([key,sale])=>Matcher.belongsToSale(record,{...sale,fbKey:key})).map(([key])=>key);
 return matches.length===1?matches[0]:false;
}
function rowFor(domain,key,record,identity,address){
 const row={schema:1,domain,key,identity:clone(identity),addressKey:address.key,addressStatus:address.status,
  number:safe(record.id||record.numero||key,128),date:date(record),status:safe(record.estado||record.estadoInst,60),
  description:safe(record.descripcion||record.problema||record.equipo||record.modelo||record.desc),
  saleKey:'',totalCents:0,paidCents:0,balanceCents:0,amountKnown:true};
 if(domain==='presupuestos'){
  const stored=['total','totalPresupuesto','importeTotal'].map(field=>record[field]).find(value=>value!==null&&value!==undefined&&value!=='');
  row.amountKnown=typeof stored==='number'&&Number.isFinite(stored)||typeof stored==='string'&&/^-?\d+(?:\.\d+)?$/.test(stored.trim());
  if(row.amountKnown)row.totalCents=Money.cents(Money.decimal(stored));
  if(['anulado','rechazado','convertido'].includes(record.estado))row.metrics={totalCents:0};
 }
 if(domain==='equipos'){row.serial=safe(record.serie,160);row.warrantyEnd=safe(record.fechaVenc||record.vence,10);}
 if(domain==='tickets'||domain==='reclamos')row.priority=safe(record.prioridad||record.prio,40);
 return row;
}
function verifyInput(input){
 if(!object(input?.records)||domains.some(domain=>!Object.hasOwn(input.records,domain)||!object(input.records[domain])))throw fail('Falta una fuente completa del historial.');
 if(!object(input.customers)||!['clients','index','structures'].every(key=>Object.hasOwn(input.customers,key)&&object(input.customers[key])))throw fail('Falta el directorio completo de clientes.');
 if(!Commercial.key(input.generation)||!Number.isSafeInteger(input.revision||1)||(input.revision||1)<1||typeof input.owner!=='function')throw fail('Falta una generación y política de responsables verificadas.');
}
async function prepare(input){
 verifyInput(input);
 const {records,customers,generation,owner}=input,revision=input.revision||1;
 const directory=Identity.create(customers),account=await Accounts.prepare({sales:records.ventas,payments:records.pagos,customers,owner:(record,key)=>owner(record,'ventas',key),generation,revision});
 const patch={},sources={},identities=new Map(),groups=new Map(),coverage={},scopedCoverage=new Map(),embedded={pagos:[],equipos:[],tickets:[]};
 const paymentsBySale=new Map();
 for(const [path,value]of Object.entries(account.patch))if(path.startsWith(Account.ROOT+'/sources/payments/')&&value.public.saleKey){const list=paymentsBySale.get(value.public.saleKey)||[];list.push(value.key);paymentsBySale.set(value.public.saleKey,list);}
 const originalNames={ventas:'sales',pagos:'payments'};
 function add(domain,key,row,ownerUid){
  if(!Commercial.key(key)||typeof ownerUid!=='string'||ownerUid&&!Commercial.key(ownerUid))throw fail('Registro o responsable inválido.');
  const id=Account.hash(row.identity.accountKey);row={...row,accountId:id,generation,revision};
  const requirements=domain==='ventas'?{embedded:row.relatedEmbeddedKeys||[],payments:row.relatedPaymentKeys||[]}:null;
  row={...row};delete row.relatedEmbeddedKeys;delete row.relatedPaymentKeys;
  row.sort=order(row);sources[domain+'/'+key]={row,ownerUid,...(requirements?{requirements}:{})};
  // Financial ownership is already verified by Account. Operational audiences
  // require their separate reader policy; do not guess technician access here.
  for(const scope of scopes(domain,ownerUid)){
   if(!scopedCoverage.has(scope))scopedCoverage.set(scope,Object.fromEntries(domains.map(domain=>[domain,{records:0,originalRecords:0,unlinkedRecords:0}])));
   const covered=scopedCoverage.get(scope)[domain];covered.records++;if(!row.embedded)covered.originalRecords++;if(row.identity.status!=='linked')covered.unlinkedRecords++;
   const name=scope+'/'+id;let group=groups.get(name);
   if(!group){group={identity:clone(row.identity),domains:Object.fromEntries(domains.map(d=>[d,empty()])),order:Object.fromEntries(domains.map(d=>[d,[]])),addresses:{},addressOrder:{}};groups.set(name,group);}
   sum(group.domains[domain],row);
   const address=addressId(row);
   group.addresses[address]||=Object.fromEntries(domains.map(d=>[d,empty()]));sum(group.addresses[address][domain],row);
   group.addressOrder[address]||={recordKey:row.addressKey||null,order:Object.fromEntries(domains.map(d=>[d,[]]))};
   group.order[domain].push(row.sort);group.addressOrder[address].order[domain].push(row.sort);
   patch[ROOT+'/pages/'+name+'/'+domain+'/'+row.sort]=row;
   patch[ROOT+'/addresses/'+name+'/'+domain+'/'+address+'/'+row.sort]=row;
   patch[ROOT+'/memberKeys/'+name+'/'+domain+'/'+row.sort]=true;
   patch[ROOT+'/addressKeys/'+name+'/'+domain+'/'+address+'/'+row.sort]=true;
  }
 }
 for(const domain of domains){
  let count=0;
  for(const [key,record]of Object.entries(records[domain])){
   if(!Commercial.key(key)||!object(record))throw fail('Una fuente del historial no es válida.');
   let identity=directory.resolve(record),address=directory.resolveAddress(record),parent=null;
   if(!['ventas','presupuestos'].includes(domain)){
    const link=relation(record,records.ventas);
    if(link===false)identity={accountKey:'ambiguous:history:'+domain+':'+key,sourceKey:key,recordKey:'',status:'ambiguous',label:safe(record.cliente)||'Sin cliente verificado'};
    else if(link){
     parent=identities.get(link);
     if(!parent)throw fail('Falta la identidad de la venta del historial.');
     // An explicit contradictory customer must not be attached to the parent.
     if(identity.status==='linked'&&identity.accountKey!==parent.identity.accountKey)throw fail('El cliente del registro contradice su venta vinculada.');
     identity=parent.identity;address=parent.address;
    }
   }
   const row=rowFor(domain,key,record,identity,address);
   let uid=parent?.ownerUid??owner(record,domain,key)??'';
   if(originalNames[domain]){
    const contribution=account.patch[Account.ROOT+'/sources/'+originalNames[domain]+'/'+key];
    if(!contribution)throw fail('Falta el miembro financiero del historial.');
    row.identity=contribution.identity;row.accountId=contribution.accountId;row.addressKey=contribution.public.addressKey;row.addressStatus=contribution.public.addressStatus;
    Object.assign(row,domain==='ventas'?{totalCents:contribution.public.totalCents,paidCents:contribution.public.paidCents,balanceCents:contribution.public.balanceCents,metrics:{...contribution.sums,receivedCents:0}}:{amountCents:contribution.public.amountCents,receivedCents:contribution.public.cancelled?0:contribution.public.amountCents,saleKey:contribution.public.saleKey||''});
    row.cancelled=contribution.public.cancelled===true;
    if(domain==='ventas'){
     row.number=contribution.public.number;
     row.paymentSource=contribution.public.paymentSource;row.installationStatus=contribution.public.installation||'';row.invoiced=contribution.public.invoiced===true;
     row.paymentStatus=row.cancelled?'anulada':row.totalCents===0?'sin_cargo':row.balanceCents===0?'pago_total':row.paidCents>0?'seniado':'pendiente_pago';
    }else{row.medium=contribution.public.medium||'';row.saleNumber=contribution.public.saleNumber||'';row.hasReceipt=!!(record.comprobanteRef||record.comprobanteAdjunto||record.comprobante);}
    uid=contribution.ownerUid;
   }else if(parent)row.saleKey=parent.key;
   if(domain==='ventas'){
    identities.set(key,{key,number:row.number,identity:row.identity,address:{key:row.addressKey,status:row.addressStatus},ownerUid:uid});
    row.relatedEmbeddedKeys=[];
    row.relatedPaymentKeys=(paymentsBySale.get(key)||[]).slice().sort();
    const financial=account.patch[Account.ROOT+'/sources/sales/'+key];
    for(const payment of financial.public.embeddedRecords||[]){
     const childKey='embedded_'+payment.token;
     embedded.pagos.push({key:childKey,saleKey:key,index:payment.index,payment});row.relatedEmbeddedKeys.push({domain:'pagos',key:childKey});
    }
    for(const childDomain of ['equipos','tickets']){
     if(record[childDomain]!=null&&!Array.isArray(record[childDomain]))throw fail('El historial embebido necesita revisión antes de preparar la cobertura.');
     for(const [index,item]of (record[childDomain]||[]).entries()){
      if(!object(item))throw fail('Un registro embebido del historial no es válido.');
      const linked=item[childDomain==='equipos'?'equipoFbKey':'ticketFbKey']||item.fbKey||item.key;
      if(linked&&Object.hasOwn(records[childDomain],linked)){
       const canonical=records[childDomain][linked],parentKey=relation(canonical,records.ventas),client=directory.resolve(canonical);
       if(parentKey!==null&&parentKey!==key||client.status==='linked'&&client.accountKey!==row.identity.accountKey)throw fail('El registro embebido contradice su referencia original.');
       continue;
      }
      const childKey='embedded_'+Account.hash(childDomain+'/'+key+'/'+index);
      embedded[childDomain].push({key:childKey,saleKey:key,index,item});row.relatedEmbeddedKeys.push({domain:childDomain,key:childKey});
     }
    }
   }
   add(domain,key,row,uid);count++;
  }
  for(const item of embedded[domain]||[]){
   const parent=identities.get(item.saleKey),row=rowFor(domain,item.key,item.item||{},parent.identity,parent.address);
   Object.assign(row,{saleKey:item.saleKey,embedded:true,embeddedIndex:item.index,embeddedToken:item.payment?.token||Account.hash(JSON.stringify(item.item))});
   if(item.payment)Object.assign(row,{date:item.payment.date==='0000-00-00'?'':item.payment.date,amountCents:item.payment.amountCents,receivedCents:item.payment.amountCents,medium:item.payment.medium,hasReceipt:item.payment.hasReceipt,cancelled:false,paymentSource:'embedded',saleNumber:parent.number});
   add(domain,item.key,row,parent.ownerUid);count++;
  }
  coverage[domain]={schema:1,generation,revision,records:count,originalRecords:Object.keys(records[domain]).length,ready:true};
 }
 function ends(keys){const sorted=keys.slice().sort();return sorted.filter((_,index)=>index%50===49||index===sorted.length-1);}
 // An operational tab must never expose financial totals from another tab.
 for(const [name,value]of groups)for(const domain of domains){
  const [scope,accountId]=name.split('/');
  patch[ROOT+'/accounts/'+name+'/'+domain]={schema:1,generation,revision,scope,accountId,domain,identity:value.identity,totals:value.domains[domain],pageEnds:ends(value.order[domain]),addresses:Object.fromEntries(Object.entries(value.addresses).map(([key,totals])=>[key,{recordKey:value.addressOrder[key].recordKey,totals:totals[domain],pageEnds:ends(value.addressOrder[key].order[domain])}]))};
 }
 for(const [name,value]of Object.entries(sources)){
  patch[ROOT+'/sources/'+name]=value;
  if(value.row.saleKey)patch[ROOT+'/relatedSales/'+value.row.saleKey+'/'+name]=true;
 }
 if(!scopedCoverage.has('all'))scopedCoverage.set('all',Object.fromEntries(domains.map(domain=>[domain,{records:0,originalRecords:0,unlinkedRecords:0}])));
 for(const [scope,counts]of scopedCoverage){
  patch[ROOT+'/scopes/'+scope]=true;
  for(const [domain,count]of Object.entries(counts))patch[ROOT+'/coverage/'+scope+'/'+domain]={schema:1,generation,revision,ready:true,...count};
 }
 patch[ROOT+'/state']={schema:1,generation,revision,ready:true,records:Object.values(coverage).reduce((sum,row)=>sum+row.records,0)};
 return{patch,generation,revision,records:Object.values(coverage).reduce((sum,row)=>sum+row.records,0)};
}
module.exports={ROOT,domains,prepare,relation,empty,sum,scopes,order,addressId,totalFields};
