'use strict';
// RTDB ordering double: null, false, true, number, string, object, then key.
const rank=value=>value==null?0:value===false?1:value===true?2:typeof value==='number'?3:typeof value==='string'?4:5;
const compare=(a,b)=>rank(a)-rank(b)||(rank(a)===5?0:a<b?-1:a>b?1:0);
function queryRows(rows,options){
 const value=([key,record])=>options.orderBy==='$key'?key:record?.[options.orderBy]??null;
 return Object.fromEntries(Object.entries(rows||{}).filter(([,record])=>record!==null).sort((a,b)=>compare(value(a),value(b))||compare(a[0],b[0])).filter(entry=>Object.hasOwn(options,'equalTo')?compare(value(entry),options.equalTo)===0:(!Object.hasOwn(options,'startAt')||compare(value(entry),options.startAt)>=0)&&(!Object.hasOwn(options,'endAt')||compare(value(entry),options.endAt)<=0)).slice(0,options.limitToFirst).map(([key,record])=>[key,structuredClone(record)]));
}
function auditedHistory(identity='originalIdentity'){
 const tuple=['ot','r0',identity,'sale'],id=require('node:crypto').createHash('sha256').update(JSON.stringify(tuple)).digest('hex');
 return{rendicionesOT:{[id]:{ot:'ot',venta:'sale',revision:1,instalada:1}},confirmacionesOT:{event:{r0:{receipt:id,ot:'ot',fila:'r0',producto:identity,venta:'sale',revision:1}}}};
}
module.exports={queryRows,auditedHistory};
