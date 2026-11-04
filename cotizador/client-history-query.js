'use strict';
const Audience=require('./commercial-models/client-history-audience.v1.js'),{digest}=require('./labor-guard');
const ROOT='sv_client_history/v1',fields=['rows','totalCents','paidCents','balanceCents','receivedCents','unknownAmounts'];
const fail=message=>Object.assign(Error(message),{code:'SV_CLIENT_HISTORY_QUERY_INCOMPLETE'});
function create({read,query,trustedAuthorize,readOriginal,readHistoryOriginal,verifyHistoryOriginal}){
 async function page(input){
  if(!input||Object.keys(input).some(key=>!['accountId','domain','address','cursor','expectedRevision','expectedGeneration','expectedSnapshotRevision'].includes(key))||Object.hasOwn(input,'expectedRevision')&&(!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<1)||Object.hasOwn(input,'expectedSnapshotRevision')&&(!Number.isSafeInteger(input.expectedSnapshotRevision)||input.expectedSnapshotRevision<1)||Object.hasOwn(input,'expectedGeneration')&&(typeof input.expectedGeneration!=='string'||!input.expectedGeneration||input.expectedGeneration.length>128||!/^[A-Za-z0-9_-]+$/.test(input.expectedGeneration))||!/^[a-f0-9]{64}$/.test(input.accountId||'')||!['ventas','pagos','presupuestos','ordenes_trabajo','reclamos','tickets','equipos'].includes(input.domain)||input.address!=null&&(typeof input.address!=='string'||/[.#$\[\]\/]/.test(input.address))||input.cursor!=null&&!/^\d{8}_[a-f0-9]{64}$/.test(input.cursor))throw fail('Consulta inválida.');
  const context=await trustedAuthorize(),audience=Audience.plan(context,input.domain);if(!audience)throw fail('Esta solapa no está autorizada.');
  const scope=['ventas','pagos','presupuestos'].includes(input.domain)&&context.role!=='admin'?'u_'+context.uid:'all';
  const paths=['sv_client_history_config',ROOT+'/state',ROOT+'/coverage/'+scope+'/'+input.domain,ROOT+'/accounts/'+scope+'/'+input.accountId+'/'+input.domain];
  const snapshot=async()=>structuredClone(await Promise.all(paths.map(path=>read(path))));
  const before=await snapshot(),[config,state,coverage,meta]=before,pageEnds=meta?.pageEnds??[];
  if(Object.hasOwn(input,'expectedSnapshotRevision')&&input.expectedSnapshotRevision!==state?.revision||Object.hasOwn(input,'expectedRevision')&&input.expectedRevision!==coverage?.revision||Object.hasOwn(input,'expectedGeneration')&&input.expectedGeneration!==config?.generation)throw fail('La revisión o generación del historial cambió.');
  if(config?.ready!==true||config.schema!==1||!config.generation||state?.ready!==true||state.schema!==1||state.dependencyManifest!==1||coverage?.ready!==true||coverage.schema!==1||state.generation!==config.generation||coverage.generation!==config.generation||!Number.isSafeInteger(state.revision)||state.revision<1||!Number.isSafeInteger(coverage.revision)||coverage.revision<1||!meta||meta.schema!==1||meta.generation!==config.generation||meta.accountId!==input.accountId||meta.domain!==input.domain||meta.scope!==scope||!Number.isSafeInteger(meta.revision)||meta.revision<1||meta.revision>coverage.revision||!Number.isSafeInteger(meta.totals?.rows)||meta.totals.rows<0||meta.totals.rows>5000||!Array.isArray(pageEnds)||pageEnds.length!==Math.ceil(meta.totals.rows/50))throw fail('Falta cobertura completa del cliente.');
  if(audience.originals==='assigned'&&(!context.employeeDirectoryVerified||!context.employee||!context.employeeDirectory||typeof readOriginal!=='function'))throw fail('Falta verificar la identidad y asignación del técnico.');
  if(!['records','originalRecords','unlinkedRecords'].every(field=>Number.isSafeInteger(coverage[field])&&coverage[field]>=0)||coverage.records<meta.totals.rows||pageEnds.some((value,index)=>!/^\d{8}_[a-f0-9]{64}$/.test(value)||index>0&&value<=pageEnds[index-1]))throw fail('Falta el manifiesto completo de fuentes.');
  async function validated(sort,row,after){
    if(!/^\d{8}_[a-f0-9]{64}$/.test(sort)||after&&sort<=after||row?.schema!==1||row.sort!==sort||row.domain!==input.domain||row.accountId!==input.accountId||row.generation!==config.generation||!Number.isSafeInteger(row.revision)||row.revision<1||row.revision>meta.revision||typeof row.key!=='string'||!row.key||/[.#$\[\]\/]/.test(row.key))throw fail('Una fila del historial cambió.');
    const source=await read(ROOT+'/sources/'+input.domain+'/'+row.key);if(!source||digest(source.row)!==digest(row)||typeof source.ownerUid!=='string')throw fail('Falta la contribución autoritativa.');
    if(typeof row.amountKnown!=='boolean'||!['totalCents','paidCents','balanceCents'].every(field=>Number.isSafeInteger(row[field]))||row.metrics!=null&&(typeof row.metrics!=='object'||Object.entries(row.metrics).some(([field,value])=>![...fields,'salesRecords','paymentRecords','activeSales','activePayments'].includes(field)||!Number.isSafeInteger(value))))throw fail('Faltan importes originales completos.');
    return source;
  }
  async function freshContext(){if(digest(await snapshot())!==digest(before))throw fail('Las fuentes cambiaron durante la consulta.');const fresh=await trustedAuthorize();if(!Audience.plan(fresh,input.domain)||fresh.uid!==context.uid||fresh.role!==context.role||fresh.revision!==context.revision||digest(Audience.plan(fresh,input.domain))!==digest(audience))throw fail('La autorización cambió.');return fresh;}
  const complete=require('./client-history-complete-page').prepare({input,context,audience,config,coverage,meta});
  if(complete){
   const entries=complete.expected?Object.entries(await query(complete.path,{after:complete.after,limit:50})||{}).sort(([a],[b])=>a.localeCompare(b)):[];
   if(entries.length!==complete.expected||complete.expected&&entries.at(-1)?.[0]!==complete.end)throw fail('La página completa del cliente cambió.');
   let index=0;const rows=entries.map(([,row])=>row);await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{while(index<entries.length){const [sort,row]=entries[index++],source=await validated(sort,row,complete.after);if(input.address!=null&&row.addressKey!==input.address||!Audience.allows(context,input.domain,{origin:row.embedded?'embedded':'original',ownerUid:source.ownerUid})||['ordenes_trabajo','reclamos'].includes(input.domain)&&row.embedded===true)throw fail('La página contradice la audiencia completa preparada.');}}));
   await freshContext();
   return {domain:input.domain,accountId:input.accountId,generation:config.generation,revision:coverage.revision,snapshotRevision:state.revision,rows,totals:complete.totals,domainTotals:complete.domainTotals,completeAmounts:complete.totals.unknownAmounts===0,unlinkedRecords:complete.unlinkedRecords,totalRows:complete.totalRows,hasMore:complete.hasMore,cursor:complete.nextCursor};
  }
  const authorized=[],proofs=[],assignmentProofs=[];let after=null,count=0;
  for(let index=0;index<pageEnds.length;index++){
   const rows=Object.entries(await query(ROOT+'/pages/'+scope+'/'+input.accountId+'/'+input.domain,{after,limit:50})||{}).sort(([left],[right])=>left.localeCompare(right));
   if(rows.length!==Math.min(50,meta.totals.rows-count)||rows.at(-1)?.[0]!==pageEnds[index])throw fail('El manifiesto del cliente está incompleto.');
   for(const [sort,row]of rows){
    const source=await validated(sort,row,after);
    const origin=row.embedded?'embedded':'original';let original;
    if(origin==='original'&&audience.originals==='assigned'){
     if(typeof readHistoryOriginal==='function'){if(typeof verifyHistoryOriginal!=='function')throw fail('Falta verificar la asignación al completar el historial.');const decision=await readHistoryOriginal(input.domain,row.key,context);if(!decision||!decision.proof||!['included','excluded'].includes(decision.status)||decision.status==='included'&&(!decision.record||decision.reason!=='assigned-self')||decision.status==='excluded'&&(decision.record!==null||decision.reason!=='assigned-other'))throw fail('La asignación original no pudo verificarse.');assignmentProofs.push(decision.proof);if(decision.status==='excluded')continue;original=decision.record;}else original=await readOriginal(input.domain,row.key,context);
    }
    const proof={origin,ownerUid:source.ownerUid,record:original};if(Audience.allows(context,input.domain,proof)){authorized.push(row);proofs.push(proof);}
   }
   count+=rows.length;after=rows.at(-1)[0];
  }
  if(digest(await snapshot())!==digest(before))throw fail('Las fuentes cambiaron durante la consulta.');
  const current=await trustedAuthorize();if(!Audience.plan(current,input.domain)||current.uid!==context.uid||current.role!==context.role||current.revision!==context.revision||digest(Audience.plan(current,input.domain))!==digest(audience))throw fail('La autorización cambió.');
  if(audience.originals==='assigned'&&!current.employeeDirectoryVerified||proofs.some(proof=>!Audience.allows(current,input.domain,proof)))throw fail('La asignación o autorización cambió.');
  for(const proof of assignmentProofs)if(await verifyHistoryOriginal(proof,current)!==true)throw fail('La asignación cambió al completar el historial.');
  if(assignmentProofs.length&&digest(await snapshot())!==digest(before))throw fail('Las fuentes cambiaron al verificar las asignaciones.');
  function sum(records){const totals=Object.fromEntries(fields.map(field=>[field,0]));for(const row of records)for(const field of fields){const value=field==='rows'?1:field==='unknownAmounts'?Number(row.amountKnown===false):row.metrics?.[field]??row[field]??0;if(!Number.isSafeInteger(value)||!Number.isSafeInteger(totals[field]+value))throw fail('Importe incompleto.');totals[field]+=value;}return totals;}
  const domainTotals=sum(authorized),filtered=authorized.filter(row=>input.address==null||row.addressKey===input.address),totals=sum(filtered);
  if(input.cursor&&!filtered.some(row=>row.sort===input.cursor))throw fail('El cursor ya no pertenece al historial autorizado.');
  const selected=filtered.filter(row=>!input.cursor||row.sort>input.cursor),rows=selected.slice(0,50);
  return {domain:input.domain,accountId:input.accountId,generation:config.generation,revision:coverage.revision,snapshotRevision:state.revision,rows,totals,domainTotals,completeAmounts:totals.unknownAmounts===0,unlinkedRecords:authorized.filter(row=>row.identity?.status!=='linked').length,totalRows:filtered.length,hasMore:selected.length>50,cursor:selected.length>50?rows.at(-1).sort:null};
 }
 return {page};
}
module.exports={create};
