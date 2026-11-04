'use strict';
// Reserved writer evidence, derived from full records under the existing lease.
const {digest,parts}=require('./labor-guard');
const Policy=require('./ot-lifecycle-policy'),Rows=require('./ot-material-rows-model'),State=require('./ot-material-state');
const base='sisventas/ordenes_trabajo';
const fields=['cod','codigo','sku','productoKey','adicionalOT','origen','destinoVenta','ventaDestinoFbKey','ventaDestinoId','origenMaterialHistorico','entregada','custodiaActiva','entregadoEn','entregadoPor','entregadoA'];
const fail=()=>Object.assign(Error('El cambio de entrega requiere el protocolo autorizado de OT.'),{statusCode:409,code:'SV_OT_DELIVERY_PROTOCOL'});
function projection(ot){const materiales=Object.entries(ot?.materiales||{}).filter(([,row])=>row&&((row.entregada!=null&&Number(row.entregada)!==0)||row.custodiaActiva===true||['entregadoEn','entregadoPor','entregadoA'].some(k=>row[k]!=null))).map(([index,row])=>[index,Object.fromEntries(fields.filter(k=>row[k]!==undefined).map(k=>[k,row[k]]))]);const remitosEntrega=ot?.remitosEntrega??null;return {ventaFbKey:materiales.length||remitosEntrega?ot?.ventaFbKey??null:null,materiales,remitosEntrega};}
function apply(record,path,value){if(!path.length)return structuredClone(value);let out=structuredClone(record)||{},at=out;for(const key of path.slice(0,-1)){if(!at[key]||typeof at[key]!=='object')at[key]={};at=at[key];}if(value===null)delete at[path.at(-1)];else at[path.at(-1)]=structuredClone(value);return out;}
async function claims({patch,lease,actor,read,query}){
 const grouped=new Map();
 for(const [path,value]of Object.entries(patch)){
  const keys=parts(path),normalized=keys.join('/');
  if(normalized===base||base.startsWith(normalized+'/'))throw fail();
  if(!normalized.startsWith(base+'/'))continue;
  if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))throw fail();
  const id=keys[2];if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push({keys:keys.slice(3),value});
 }
 const token=Policy.token(actor,lease);let historical=false,changed=false;
 for(const [id,edits]of grouped){
  // Reject overlapping patches; the server must not guess their ordering.
  for(let i=0;i<edits.length;i++)for(let j=0;j<i;j++){const a=edits[i].keys.join('/'),b=edits[j].keys.join('/');if(a===b||!a||!b||a.startsWith(b+'/')||b.startsWith(a+'/'))throw fail();}
  const before=await read(base+'/'+id);let after=before;for(const edit of edits)after=apply(after,edit.keys,edit.value);
  const custody=token.svOTLifecycleVersion===1&&token.svOTLifecycleOTKey===id&&token.svOTLifecycleKind==='custody';
  let transitions;
  if(custody){
   if(digest(before?.items??null)!==digest(after?.items??null))throw fail();
   const materialInput=digest(before?.materiales??null)===digest(after?.materiales??null)?Rows.persisted(Rows.view(before)):after?.materiales;
   transitions=require('./ot-lifecycle-model').materialChanges(before,materialInput,'custody');
   for(const transition of transitions)if(transition.needsStockReceipt||transition.needsProductBinding){try{const productKey=await State.resolveProduct(transition.target,{read,query,source:transition.needsProductBinding?transition.source:null});await State.verifyReceipt({ot:before,otKey:id,transition,productKey,read});}catch(error){if(error.code==='SV_OT_MATERIAL_REVIEW')throw fail();throw error;}}
   // Passive persistence retains the authoritative items history; it is not a
   // new delivery merely because Rows.persisted materializes the source row.
   if(digest(projection({...before,materiales:Rows.persisted(Rows.view(before))}))===digest(projection(after)))continue;
  }
  if(digest(projection(before))===digest(projection(after)))continue;
  changed=true;
  if(token.svOTLifecycleVersion!==1||token.svOTLifecycleOTKey!==id)throw fail();
  if(token.svOTLifecycleKind==='delivery')continue;
  // Only the existing recovery model may initialize a previously recovered row.
  if(token.svOTLifecycleKind!=='custody'||digest(before?.remitosEntrega??null)!==digest(after?.remitosEntrega??null)||before?.ventaFbKey!==after?.ventaFbKey)throw fail();
  const source=Rows.view(before),targets=after?.materiales;
  const expected=Rows.persisted(source).map((row,i)=>transitions[i].recovery?targets[i]:row);
  if(digest(projection({...before,materiales:expected}))!==digest(projection(after)))throw fail();
  if(!transitions.some(t=>t.recovery))throw fail();
  historical=true;
 }
 return {svOTDeliveryUnchanged:!changed,svOTDeliveryCommitVersion:1,svOTDeliveryHistoricalVerified:historical};
}
module.exports={claims,projection};
