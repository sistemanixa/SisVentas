'use strict';
const Audience=require('./commercial-models/client-history-audience.v1.js'),Account=require('./client-account-projection');
const fields=['rows','totalCents','paidCents','balanceCents','receivedCents','unknownAmounts'];
const fail=()=>{throw Object.assign(Error('Falta un manifiesto completo y coherente de la página del historial.'),{code:'SV_CLIENT_HISTORY_QUERY_INCOMPLETE'});};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const key=value=>typeof value==='string'&&value.length>0&&value.length<=768&&!/[.#$\[\]\/\x00-\x1f\x7f]/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
function totals(value){if(!object(value)||!fields.every(field=>Number.isSafeInteger(value[field]))||value.rows<0||value.rows>5000||value.unknownAmounts<0||value.unknownAmounts>value.rows)fail();return Object.fromEntries(fields.map(field=>[field,value[field]]));}
function manifest(value){const sum=totals(value?.totals),ends=value.pageEnds??[];if(!Array.isArray(ends)||ends.length!==Math.ceil(sum.rows/50)||ends.some((end,index)=>!/^\d{8}_[a-f0-9]{64}$/.test(end)||index>0&&end<=ends[index-1]))fail();return {totals:sum,ends};}
function prepare({input,context,audience,config,coverage,meta}={}){
 const policy=Audience.plan(context,input?.domain);
 if(!policy||!audience||JSON.stringify(policy)!==JSON.stringify(audience))return null;
 const financial=['ventas','pagos','presupuestos'].includes(input.domain),scope=financial&&context.role!=='admin'?'u_'+context.uid:'all';
 if(financial){if(context.role==='admin'?audience.originals!=='all'||audience.embedded!=='all':audience.originals!=='own'||audience.embedded!=='own')return null;}
 else if(!['ordenes_trabajo','reclamos'].includes(input.domain)||audience.originals!=='all'||audience.embedded!=='none')return null;
 if(!input||!/^[a-f0-9]{64}$/.test(input.accountId||'')||config?.schema!==1||config.ready!==true||!key(config.generation)||coverage?.schema!==1||coverage.ready!==true||coverage.generation!==config.generation||!Number.isSafeInteger(coverage.revision)||coverage.revision<1||!['records','originalRecords','unlinkedRecords'].every(field=>Number.isSafeInteger(coverage[field])&&coverage[field]>=0)||coverage.originalRecords>coverage.records||coverage.unlinkedRecords>coverage.records)fail();
 if(!financial&&coverage.originalRecords!==coverage.records)return null;
 if(meta?.schema!==1||meta.scope!==scope||meta.accountId!==input.accountId||meta.domain!==input.domain||meta.generation!==config.generation||!Number.isSafeInteger(meta.revision)||meta.revision<1||meta.revision>coverage.revision)fail();
 if(input.expectedRevision!=null&&input.expectedRevision!==coverage.revision||input.expectedGeneration!=null&&input.expectedGeneration!==config.generation)fail();
 if(!Object.hasOwn(meta,'unlinkedRecords'))return null;
 const main=manifest(meta);if(main.totals.rows>coverage.records)fail();
 if(!Number.isSafeInteger(meta.unlinkedRecords)||meta.unlinkedRecords<0||meta.unlinkedRecords>main.totals.rows)fail();
 if(meta.identity?.status!=='linked')return null;
 const partitions=meta.addresses??{};if(!object(partitions))fail();const sums=Object.fromEntries(fields.map(field=>[field,0])),physical=new Set();let selected=main,path='sv_client_history/v1/pages/'+scope+'/'+input.accountId+'/'+input.domain,found=false;
 for(const [id,partition]of Object.entries(partitions)){
  if(!object(partition))fail();const recordKey=partition.recordKey??null;
  if(id==='unknown'?recordKey!==null:!key(recordKey)||id!=='a_'+Account.hash(recordKey))fail();
  if(physical.has(recordKey))fail();physical.add(recordKey);const checked=manifest(partition);
  for(const field of fields){sums[field]+=checked.totals[field];if(!Number.isSafeInteger(sums[field]))fail();}
  if(input.address!=null&&recordKey===input.address){if(found)fail();found=true;selected=checked;path='sv_client_history/v1/addresses/'+scope+'/'+input.accountId+'/'+input.domain+'/'+id;}
 }
 if(fields.some(field=>sums[field]!==main.totals[field]))fail();
 if(input.address!=null&&(!key(input.address)||!found))fail();
 let index=0;const after=input.cursor??null;if(after!==null){const position=selected.ends.indexOf(after);if(position<0)fail();index=position+1;if(index>=selected.ends.length)fail();}
 const expected=Math.min(50,Math.max(0,selected.totals.rows-index*50)),end=selected.ends[index]??null,hasMore=index+1<selected.ends.length;
 return {path,after,expected,end,hasMore,nextCursor:hasMore?end:null,totals:structuredClone(selected.totals),domainTotals:structuredClone(main.totals),totalRows:selected.totals.rows,unlinkedRecords:meta.unlinkedRecords};
}
module.exports={prepare};
