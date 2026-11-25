'use strict';
// An additional server commit check, not permission to write OT metadata.
const {digest,parts}=require('./labor-guard'),Policy=require('./ot-lifecycle-policy'),Model=require('./ot-lifecycle-model');
const base='sisventas/ordenes_trabajo';
const amounts=['entregada','instalada','cantidadInstalada','devueltaPendiente','devuelta','enTecnico','danada','faltante'];
const flags=['custodiaActiva','custodiaClasificada'];
const evidence=['entregadoEn','entregadoPor','entregadoA','estadoCustodia','recibidoEn','recibidoPor','stockRegistro','stockRevision','stockPendiente','stockBaseInstalada'];
const identity=['cod','codigo','sku','productoKey','productoFbKey','productKey','destinoVenta','ventaDestinoFbKey','ventaDestinoId','origenMaterialHistorico'];
const otFields=['custodiaIniciada','custodiaRendida','custodiaEntregadaEn','custodiaRendidaEn','custodiaRendidaPor','custodiaTecnico','remitosEntrega','movimientosStock','fechaCierre','fechaCompletada','cerradaEn','finalizadaEn','cerrada','finalizada','cierreConObservaciones'];
const fail=()=>Object.assign(Error('Los cambios físicos de la OT requieren su comando autorizado.'),{statusCode:409,code:'SV_OT_PHYSICAL_COMMAND_REQUIRED'});
const meaningful=v=>v!==undefined&&v!==null&&v!==false&&v!==0&&v!==''&&(typeof v!=='object'||Object.keys(v).length>0);
function projection(ot){
 const result={closed:Model.closed(ot),records:{},fields:{}};
 for(const field of otFields)if(meaningful(ot?.[field]))result.fields[field]=ot[field];
 for(const source of ['materiales','items']){
  const rows=ot?.[source];if(rows==null)continue;if(typeof rows!=='object'){result.records[source]={invalid:rows};continue;}
  const active={};for(const [index,row]of Object.entries(rows)){
   if(!row||typeof row!=='object'){active[index]={invalid:row};continue;}
   const physical={};for(const field of amounts)if(row[field]!==undefined&&row[field]!==null&&row[field]!==0)physical[field]=row[field];
   for(const field of flags)if(row[field]!==undefined&&row[field]!==false)physical[field]=row[field];
   for(const field of evidence)if(Object.hasOwn(row,field))physical[field]=row[field];
   if(Object.values(physical).some(meaningful)){for(const field of identity)if(Object.hasOwn(row,field))physical[field]=row[field];active[index]=physical;}
  }
  if(Object.keys(active).length)result.records[source]=active;
 }
 // An existing physical record cannot be moved to another sale by metadata.
 if(Object.keys(result.records).length||Object.keys(result.fields).length)result.sale={ventaFbKey:ot?.ventaFbKey??null,ventaId:ot?.ventaId??null,venta:ot?.venta??null};
 return result;
}
function apply(record,path,value){if(!path.length)return structuredClone(value);const result=structuredClone(record)||{};let at=result;for(const field of path.slice(0,-1)){if(!at[field]||typeof at[field]!=='object')at[field]={};at=at[field];}if(value===null)delete at[path.at(-1)];else at[path.at(-1)]=structuredClone(value);return result;}
async function claims({patch,actor,lease,read}){
 const grouped=new Map();for(const [path,value]of Object.entries(patch)){
  const keys=parts(path),normalized=keys.join('/');if(normalized===base||base.startsWith(normalized+'/'))throw fail();if(!normalized.startsWith(base+'/'))continue;
  if(keys.some(key=>['__proto__','prototype','constructor'].includes(key)))throw fail();const id=keys[2];if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push({path:keys.slice(3),value});
 }
 let changed=false;const token=Policy.token(actor,lease),inventoryToken=require('./ot-inventory-policy').token(actor,lease);
 for(const [id,edits]of grouped){
  for(let i=0;i<edits.length;i++)for(let j=0;j<i;j++){const a=edits[i].path.join('/'),b=edits[j].path.join('/');if(!a||!b||a===b||a.startsWith(b+'/')||b.startsWith(a+'/'))throw fail();}
  const before=await read(base+'/'+id);let after=before;for(const edit of edits)after=apply(after,edit.path,edit.value);
  if(digest(projection(before))===digest(projection(after)))continue;
  if(!(token.svOTLifecycleVersion===1&&token.svOTLifecycleOTKey===id)&&!(inventoryToken.svOTInventoryVersion===1&&inventoryToken.svOTInventoryOTKey===id))throw fail();changed=true;
 }
 return{svOTPhysicalCommitVersion:1,svOTPhysicalUnchanged:!changed};
}
module.exports={projection,claims};
