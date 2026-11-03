(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVClientHistoryReader=api;})(typeof window==='object'?window:globalThis,function(){
'use strict';
const ROOT='sv_client_history/v1',LIMIT=50;
const domains=['ventas','pagos','presupuestos','ordenes_trabajo','reclamos','tickets','equipos'];
const financial=new Set(['ventas','pagos','presupuestos']);
const fields=['rows','totalCents','paidCents','balanceCents','receivedCents','unknownAmounts'];
const key=value=>typeof value==='string'&&value.length>0&&value.length<=768&&!/[.#$\[\]/\x00-\x1f\x7f]/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
const id=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const sort=value=>typeof value==='string'&&/^\d{8}_[a-f0-9]{64}$/.test(value);
const incomplete=()=>Object.assign(Error('El historial todavía no tiene una cobertura completa. Volvé a actualizar.'),{code:'SV_CLIENT_HISTORY_INCOMPLETE'});
const abort=()=>Object.assign(Error('La pantalla o la sesión cambió.'),{name:'AbortError'});
function totals(value){if(!value||!fields.every(field=>Number.isSafeInteger(value[field]))||value.rows<0||value.unknownAmounts<0||value.unknownAmounts>value.rows)throw incomplete();return value;}
function manifest(value){
 const count=totals(value?.totals).rows,ends=value.pageEnds??[];
 if(!Array.isArray(ends)||ends.length!==Math.ceil(count/LIMIT)||ends.some((key,index)=>!sort(key)||index>0&&key<=ends[index-1]))throw incomplete();
 return{count,ends};
}
function create({capture,read,query,readiness,sdk}={}){
 if(sdk){read=(path,c)=>sdk.get(sdk.ref(c.db,path)).then(s=>s.val());query=(path,{after},c)=>{const args=[sdk.orderByKey()];if(after)args.push(sdk.startAt(after+'\u0000'));args.push(sdk.limitToFirst(LIMIT));return sdk.get(sdk.query(sdk.ref(c.db,path),...args)).then(s=>s.val());};}
 let epoch=0;
 function context(domain){
  const now=capture();
  if(!now||!key(now.uid)||!now.auth||!now.db||now.hidden||now.viewing||now.online===false||!now.canReadClients||!now.allowedDomains?.includes(domain))throw abort();
  if(financial.has(domain)&&now.financialHistoryAccess?.[domain]!==true)throw abort();
  if(!financial.has(domain)&&!['admin','administrativo'].includes(now.role))throw Object.assign(Error('El historial operativo de este rol todavía no está preparado.'),{code:'SV_CLIENT_HISTORY_AUDIENCE_UNAVAILABLE'});
  const c={...now,epoch,scope:now.role==='admin'||!financial.has(domain)&&now.role==='administrativo'?'all':'u_'+now.uid};
  c.valid=()=>{const next=capture();return!!next&&epoch===c.epoch&&next.uid===c.uid&&next.role===c.role&&next.auth===c.auth&&next.db===c.db&&next.route===c.route&&next.permissionRevision===c.permissionRevision&&!next.hidden&&!next.viewing&&next.online!==false&&next.canReadClients&&next.allowedDomains?.includes(domain)&&(!financial.has(domain)||next.financialHistoryAccess?.[domain]===true);};
  return c;
 }
 function check(c){if(!c.valid())throw abort();}
 async function get(c,path){check(c);const value=await read(path,c);check(c);return value;}
 function coverage(config,value){if(config?.ready!==true||config.schema!==1||value?.schema!==1||value.ready!==true||value.generation!==config.generation||!Number.isSafeInteger(value.revision)||value.revision<1||!['records','originalRecords','unlinkedRecords'].every(field=>Number.isSafeInteger(value[field])&&value[field]>=0)||value.originalRecords>value.records||value.unlinkedRecords>value.records)throw incomplete();}
 async function page(accountId,domain,{address=null,cursor=null,expectedRevision=null}={}){
  if(!id(accountId)||!domains.includes(domain)||address!==null&&!key(address)||cursor!==null&&!sort(cursor))throw Error('Consulta de historial inválida.');
  const c=context(domain),state=readiness?.beginSource?.('historialcliente','client-history/'+domain);
  try{
   const [config,before]=await Promise.all([get(c,'sv_client_history_config'),get(c,ROOT+'/coverage/'+c.scope+'/'+domain)]);coverage(config,before);
   if(expectedRevision!==null&&before.revision!==expectedRevision)throw Object.assign(incomplete(),{code:'SV_PAGE_CHANGED'});
   const meta=await get(c,ROOT+'/accounts/'+c.scope+'/'+accountId+'/'+domain);
   if(!meta||meta.schema!==1||meta.domain!==domain||meta.scope!==c.scope||meta.accountId!==accountId||meta.generation!==config.generation||!Number.isSafeInteger(meta.revision)||meta.revision<1||meta.revision>before.revision)throw incomplete();
   manifest(meta);
   const combined=Object.fromEntries(fields.map(field=>[field,0])),physical=new Set();
   for(const [addressId,value]of Object.entries(meta.addresses||{})){
    if(addressId==='unknown'?value.recordKey!=null:!/^a_[a-f0-9]{64}$/.test(addressId)||!key(value.recordKey)||physical.has(value.recordKey))throw incomplete();
    manifest(value);physical.add(value.recordKey);
    for(const field of fields){combined[field]+=value.totals[field];if(!Number.isSafeInteger(combined[field]))throw incomplete();}
   }
   if(fields.some(field=>combined[field]!==meta.totals[field]))throw incomplete();
   let selected=meta,path=ROOT+'/pages/'+c.scope+'/'+accountId+'/'+domain;
   if(address!==null){
    const addresses=Object.entries(meta.addresses||{}).filter(([,value])=>value.recordKey===address);
    if(addresses.length!==1||!/^a_[a-f0-9]{64}$/.test(addresses[0][0]))throw incomplete();
    selected=addresses[0][1];path=ROOT+'/addresses/'+c.scope+'/'+accountId+'/'+domain+'/'+addresses[0][0];
   }
   const {count,ends}=manifest(selected),position=cursor===null?0:ends.indexOf(cursor)+1;
   if(cursor!==null&&(position===0||position>=ends.length))throw Error('La página del historial ya no es válida.');
   const expected=Math.min(LIMIT,count-position*LIMIT);
   let entries=[];
   if(expected){check(c);const result=await query(path,{after:cursor,limit:LIMIT},c);check(c);entries=Object.entries(result||{}).sort(([a],[b])=>a<b?-1:a>b?1:0);}
   if(entries.length!==expected||entries.some(([sortKey,row])=>!sort(sortKey)||cursor&&sortKey<=cursor||!row||row.schema!==1||typeof row.amountKnown!=='boolean'||!key(row.key)||row.sort!==sortKey||row.accountId!==accountId||row.domain!==domain||row.generation!==config.generation||!Number.isSafeInteger(row.revision)||row.revision<1||row.revision>meta.revision||!['totalCents','paidCents','balanceCents'].every(field=>Number.isSafeInteger(row[field]))||['receivedCents','amountCents'].some(field=>row[field]!=null&&!Number.isSafeInteger(row[field]))||address!==null&&row.addressKey!==address)||expected&&entries.at(-1)[0]!==ends[position])throw incomplete();
   const [after,finalConfig]=await Promise.all([get(c,ROOT+'/coverage/'+c.scope+'/'+domain),get(c,'sv_client_history_config')]);coverage(finalConfig,after);
   if(after.revision!==before.revision||after.generation!==before.generation||finalConfig.generation!==config.generation)throw Object.assign(incomplete(),{code:'SV_PAGE_CHANGED'});
   check(c);state?.ready();const hasMore=position+1<ends.length;
   return{domain,accountId,generation:config.generation,revision:before.revision,unlinkedRecords:before.unlinkedRecords,completeAmounts:selected.totals.unknownAmounts===0,rows:entries.map(([,row])=>row),totals:selected.totals,domainTotals:meta.totals,totalRows:count,page:position+1,hasMore,cursor:hasMore?entries.at(-1)[0]:null};
  }catch(error){if(error.name==='AbortError')state?.cancel();else state?.error();throw error;}
  finally{state?.cancel();}
 }
 return Object.freeze({page,reset(){epoch++;}});
}
return Object.freeze({ROOT,LIMIT,create});
});
