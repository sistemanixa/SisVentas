(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SVClientHistoryServiceReader=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const domains=['ventas','pagos','presupuestos','ordenes_trabajo','reclamos','tickets','equipos'],fields=['rows','totalCents','paidCents','balanceCents','receivedCents','unknownAmounts'];
 const abort=()=>Object.assign(Error('La pantalla o la sesión cambió.'),{name:'AbortError'}),incomplete=()=>Object.assign(Error('No se pudo verificar el historial completo. Volvé a actualizar.'),{code:'SV_CLIENT_HISTORY_INCOMPLETE'});
 const id=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),sort=value=>typeof value==='string'&&/^\d{8}_[a-f0-9]{64}$/.test(value),key=value=>typeof value==='string'&&value.length>0&&value.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
 function checkTotals(value){return value&&fields.every(field=>Number.isSafeInteger(value[field]))&&value.rows>=0&&value.unknownAmounts>=0&&value.unknownAmounts<=value.rows;}
 function create({capture,fetch:transport,endpoint,headers,readiness,timeoutMs=20000}={}){
  if(typeof capture!=='function'||typeof transport!=='function'||typeof headers!=='function'||typeof endpoint!=='string'||!endpoint)throw TypeError('Falta la consulta autorizada del historial.');
  let epoch=0;const requests=new Set();
  async function page(accountId,domain,{address=null,cursor=null,expectedRevision=null,expectedGeneration=null,expectedSnapshotRevision=null}={}){
   if(expectedSnapshotRevision!==null&&(!Number.isSafeInteger(expectedSnapshotRevision)||expectedSnapshotRevision<1)||!id(accountId)||!domains.includes(domain)||address!==null&&!key(address)||cursor!==null&&!sort(cursor)||expectedRevision!==null&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<1)||expectedGeneration!==null&&!key(expectedGeneration))throw Error('Consulta inválida.');
   const captured=capture(),actor=captured?{...captured}:null,at=epoch;
   const valid=()=>{const now=capture();return now&&actor&&at===epoch&&actor.uid&&actor.auth?.uid===actor.uid&&now.uid===actor.uid&&now.epoch===actor.epoch&&now.auth===actor.auth&&now.auth?.uid===now.uid&&now.role===actor.role&&now.db===actor.db&&now.route===actor.route&&now.permissionRevision===actor.permissionRevision&&!now.hidden&&!now.viewing&&now.online!==false&&now.canReadClients===true&&now.allowedDomains?.includes(domain);};
   if(!valid())throw abort();
   const controller=new AbortController(),state=readiness?.beginSource?.('historialcliente','client-history/'+domain);requests.add(controller);let settled=false,timer;
   try{
    const authHeaders=await headers({'Content-Type':'application/json'});if(!valid())throw abort();
    timer=setTimeout(()=>controller.abort(),timeoutMs);
    const response=await transport(endpoint,{method:'POST',headers:authHeaders,body:JSON.stringify({accountId,domain,address,cursor,...(expectedRevision!==null?{expectedRevision}:{}),...(expectedGeneration!==null?{expectedGeneration}:{}),...(expectedSnapshotRevision!==null?{expectedSnapshotRevision}:{})}),cache:'no-store',signal:controller.signal});if(!valid())throw abort();
    let result;try{result=await response.json();}catch(_){throw incomplete();}if(!valid())throw abort();
    if(!response.ok||result?.ok!==true)throw Object.assign(Error(result?.mensaje||'No se pudo consultar el historial. Volvé a intentar.'),{code:result?.code||'SV_CLIENT_HISTORY_UNAVAILABLE'});
    if(result.snapshotRevision!=null&&(!Number.isSafeInteger(result.snapshotRevision)||result.snapshotRevision<1)||expectedSnapshotRevision!==null&&result.snapshotRevision!==expectedSnapshotRevision||result.accountId!==accountId||result.domain!==domain||!key(result.generation)||!Number.isSafeInteger(result.revision)||result.revision<1||expectedGeneration!==null&&expectedGeneration!==result.generation||expectedRevision!==null&&expectedRevision!==result.revision||!Array.isArray(result.rows)||result.rows.length>50||!Number.isSafeInteger(result.totalRows)||result.totalRows<result.rows.length||result.totalRows>5000||!checkTotals(result.totals)||result.totals.rows!==result.totalRows||!checkTotals(result.domainTotals)||result.domainTotals.rows<result.totalRows||typeof result.hasMore!=='boolean'||result.hasMore&&(!result.rows.length||result.rows.length!==50||result.cursor!==result.rows.at(-1)?.sort)||!result.hasMore&&result.cursor!==null||typeof result.completeAmounts!=='boolean'||result.completeAmounts!==(result.totals.unknownAmounts===0)||!Number.isSafeInteger(result.unlinkedRecords)||result.unlinkedRecords<0||result.unlinkedRecords>result.domainTotals.rows)throw incomplete();
    const seen=new Set();let previous=cursor;
    for(const row of result.rows){if(row?.schema!==1||row.domain!==domain||row.accountId!==accountId||row.generation!==result.generation||!key(row.key)||!sort(row.sort)||previous&&row.sort<=previous||seen.has(row.key)||typeof row.amountKnown!=='boolean'||!['totalCents','paidCents','balanceCents'].every(field=>Number.isSafeInteger(row[field]))||row.receivedCents!=null&&!Number.isSafeInteger(row.receivedCents)||address!==null&&row.addressKey!==address)throw incomplete();seen.add(row.key);previous=row.sort;}
    if(!valid())throw abort();state?.ready();settled=true;return result;
   }catch(error){if(error.name==='AbortError'||!valid())state?.cancel();else state?.error(error.message);settled=true;throw error;}finally{clearTimeout(timer);requests.delete(controller);if(!settled)state?.cancel();}
  }
  return Object.freeze({page,reset(){epoch++;for(const controller of requests)controller.abort();requests.clear();}});
 }
 return Object.freeze({create});
});
