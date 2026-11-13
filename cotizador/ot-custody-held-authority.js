'use strict';
// Commit-time custody proof from certified summaries and their full originals.
// Never accepts a browser/audit counter as authority for a sibling's material.
const Index=require('./record-list-model'),Rows=require('./ot-material-rows-model'),Money=require('./commercial-models/commercial-money.v1'),{digest}=require('./labor-guard'),{normalizeRtdb}=require('./payment-membership-index');
const fail=()=>Object.assign(Error('La custodia vinculada requiere revisión.'),{statusCode:409,code:'SV_OT_MATERIAL_REVIEW'});
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const allocation=(ot,row)=>{const id=row.destinoVenta==='nueva'?row.ventaDestinoFbKey:ot.ventaFbKey;if(!key(id))throw fail();return id;};
const q=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw fail();return v;};
const scoped=new WeakMap();
async function compute(input){
 if(typeof input?.read!=='function')throw fail();let cache=scoped.get(input.read);if(!cache){cache=new Map();scoped.set(input.read,cache);}
 const id=digest({otKey:input.otKey,productKey:input.productKey,ot:input.ot,group:input.group});if(!cache.has(id))cache.set(id,computeOriginal(input));return new Map(await cache.get(id));
}
async function computeOriginal({ot,otKey,productKey,group,read,query}){
 if(!key(otKey)||!key(productKey)||!Array.isArray(group)||!group.length||typeof read!=='function'||typeof query!=='function')throw fail();
 const State=require('./ot-material-state'),targets=Rows.persisted(Rows.view(ot)),selected=new Map(),destinations=new Set(),codes=new Set();
 for(const entry of group){const i=Number(entry.rowKey);if(!Number.isInteger(i)||String(i)!==entry.rowKey||!targets[i]||selected.has(i)||!entry.transition?.target)throw fail();selected.set(i,entry);targets[i]=structuredClone(entry.transition.target);destinations.add(allocation(ot,targets[i]));for(const row of [entry.transition.row,entry.transition.target])for(const c of [row?.cod,row?.codigo])if(typeof c==='string'&&c)codes.add(c);}
 const index=Index.parseIndex('ordenes_trabajo',await read(Index.index+'/ordenes_trabajo'));
 for(const sale of destinations)for(const id of Object.keys(await query('sisventas/ordenes_trabajo','ventaFbKey',sale)||{}))if(!index[id])throw fail();
 const originals=new Map([[otKey,ot]]),matches=row=>row.productoKey===productKey||!key(row.productoKey)&&codes.has(row.cod||row.codigo);
 for(const [id,summary]of Object.entries(index)){
  if(id===otKey)continue;
  if(!destinations.has(summary.ventaFbKey)&&!Rows.persisted(Rows.view(summary)).some(row=>matches(row)&&(destinations.has(row.destinoVenta==='nueva'?row.ventaDestinoFbKey:summary.ventaFbKey)||!key(row.destinoVenta==='nueva'?row.ventaDestinoFbKey:summary.ventaFbKey))))continue;
  if(originals.size>=500)throw fail();const original=await read('sisventas/ordenes_trabajo/'+id);
  if(!original||digest(normalizeRtdb(Index.summary('ordenes_trabajo',original)))!==digest(normalizeRtdb(summary)))throw fail();originals.set(id,original);
 }
 const resolved=new Map(),result=new Map();
 for(const [i,entry]of selected){let held=0;const destination=allocation(ot,entry.transition.target);
  for(const [id,record]of originals){const rows=id===otKey?targets:Rows.persisted(Rows.view(record));for(let j=0;j<rows.length;j++){
   const row=rows[j];if(id===otKey&&j===i||!matches(row))continue;
   const ref=JSON.stringify([row.productoKey||null,row.cod||row.codigo||null]);if(!resolved.has(ref))resolved.set(ref,await State.resolveProduct(row,{read,query}));if(resolved.get(ref)!==productKey)continue;if(allocation(record,row)!==destination)continue;
   State.bounds(row,{unchanged:true});const delivered=q(row.entregada??0),installed=q(row.instalada??0),returned=q(row.devuelta??0);if(Money.quantitySum([installed,returned])>delivered||delivered>0&&row.custodiaActiva!==true)throw fail();
   // Changed current rows are projected targets, not already committed receipts.
   if(installed>0&&!(id===otKey&&selected.has(j)))await State.verifyReceipt({ot:record,otKey:id,transition:{target:row},productKey,read});
   held=Money.quantitySum([held,delivered,-installed,-returned]);
  }}result.set(entry.rowKey,held);
 }
 return result;
}
module.exports={compute};
