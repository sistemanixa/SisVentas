'use strict';
// Server-only representation binding. A JSON object never carries this authority.
const {digest}=require('./labor-guard'),Life=require('./ot-lifecycle-model'),State=require('./ot-material-state'),Money=require('./commercial-models/commercial-money');
const issued=new WeakMap(),key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const fail=()=>Object.assign(Error('La delegación de inventario OT requiere su wire y original exactos.'),{statusCode:409,code:'SV_OT_INVENTORY_WIRE_INVALID'});
function exact(value,fields){return !!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Object.keys(value).sort().join(',')===[...fields].sort().join(',');}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function quantity(v){if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw fail();return v;}
function derive(wire,original){
 if(!exact(wire,['id','otKey','expectedOTHash','kind','changes'])||!key(wire.id)||wire.id.length<8||!key(wire.otKey)||!/^[a-f0-9]{64}$/.test(wire.expectedOTHash||'')||!['consume','return'].includes(wire.kind)||!original||typeof original!=='object'||Array.isArray(original)||original._svListSummary||original._svPagedSummary||!key(original.ventaFbKey)||original.fbKey!=null&&original.fbKey!==wire.otKey||digest(original)!==wire.expectedOTHash)throw fail();
 // Canonical sale identity is required. Display references, when present, must
 // be nonempty and agree; an absent canonical key is never standalone proof.
 const refs=['ventaId','venta'].filter(field=>original[field]!=null).map(field=>{if(!['string','number'].includes(typeof original[field]))throw fail();const value=String(original[field]).replace(/^#/,'').trim().toUpperCase();if(!value)throw fail();return value;});if(new Set(refs).size>1)throw fail();
 if(!Array.isArray(original.materiales)||!original.materiales.length||original.items&&Object.keys(original.items).length)throw fail();
 for(let i=0;i<original.materiales.length;i++)if(!Object.hasOwn(original.materiales,i)||!original.materiales[i]||typeof original.materiales[i]!=='object'||Array.isArray(original.materiales[i]))throw fail();
 let kind,changes,action;
 if(wire.kind==='consume'){
  if(!exact(wire.changes,['rowIndex','instalada'])||!Number.isSafeInteger(wire.changes.rowIndex)||wire.changes.rowIndex<0||wire.changes.rowIndex>=original.materiales.length)throw fail();
  const materials=structuredClone(original.materiales),row=materials[wire.changes.rowIndex],before=quantity(row.instalada??0),target=quantity(wire.changes.instalada);State.bounds(row,{unchanged:true});
  if(row.custodiaActiva!==true||row.entregada==null||row.stockPendiente===true||target===before||!Number.isSafeInteger(row.stockRevision??0)||(row.stockRevision??0)<0)throw fail();
  row.instalada=target;row.enTecnico=Math.max(0,Money.quantitySum([quantity(row.enTecnico??0),before,-target]));row.stockRevision=(row.stockRevision??0)+1;if(!Number.isSafeInteger(row.stockRevision))throw fail();
  kind='custody';changes={materiales:materials};Life.materialChanges(original,materials,kind);action='Instalación registrada por inventario OT';
 }else{
  if(!exact(wire.changes,['receptions'])||!Array.isArray(wire.changes.receptions)||!wire.changes.receptions.length)throw fail();
  const pending=new Map();original.materiales.forEach((row,index)=>{const qty=quantity(row.devueltaPendiente??0);if(qty>0)pending.set(index,qty);});
  if(wire.changes.receptions.length!==pending.size)throw fail();const seen=new Set();
  for(const entry of wire.changes.receptions){if(!exact(entry,['rowIndex','cantidad'])||!Number.isSafeInteger(entry.rowIndex)||entry.rowIndex<0||seen.has(entry.rowIndex)||!pending.has(entry.rowIndex)||quantity(entry.cantidad)!==pending.get(entry.rowIndex))throw fail();seen.add(entry.rowIndex);}
  kind='return';changes={};action='Devolución recibida por inventario OT';
 }
 return{id:wire.id,otKey:wire.otKey,expectedOTHash:wire.expectedOTHash,kind,changes,action};
}
function issue({wire,original}={}){const body=derive(wire,original),handle=Object.freeze(Object.create(null));issued.set(handle,freeze({wire:structuredClone(wire),lifeBody:body,source:structuredClone(original)}));return handle;}
function resolve(handle){const entry=handle&&issued.get(handle);if(!entry||digest(derive(entry.wire,entry.source))!==digest(entry.lifeBody))throw fail();return entry;}
module.exports={issue,resolve,read:resolve};
