'use strict';
// Pure planning only. This module never obtains credentials or performs I/O.
const crypto=require('node:crypto');
const ROOT='sisventas/productos/';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const record=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
function key(value){if(typeof value!=='string'||!value||value.length>256||/[.#$\[\]\/\u0000-\u001f]/.test(value)||['__proto__','prototype','constructor'].includes(value))throw Error('Identificador de producto inválido');return value;}
function amount(value){if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:null;if(typeof value==='string'&&/^\d+(?:\.\d+)?$/.test(value.trim())){const n=Number(value);return Number.isFinite(n)?n:null;}return null;}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(record(value))return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');}
function clone(value){return JSON.parse(JSON.stringify(value));}
function unitOf(p){return String(p.unidad||p.unit||'').trim().toLowerCase();}
function approvedRootEvidence(p,evidence){
 if(!record(evidence)||evidence.verified!==true||evidence.currency!=='ARS'||typeof evidence.reference!=='string'||!evidence.reference.trim())return null;
 const n=amount(evidence.amount);if(n===null||n!==amount(p.costoRealArs))return null;
 // Metres/presentations and USD-origin records need a distinct conversion audit.
 if(unitOf(p)==='metro'||unitOf(p)==='m'||String(p.moneda||'').toUpperCase()==='USD'||String(p.monedaCarga||'').toUpperCase()==='USD')return null;
 return n;
}
function buildPlan(catalog,{rootEvidence={}}={}){
 if(!record(catalog))throw Error('Se requiere el catálogo por clave, no una exportación de otro dominio');
 const rows=[],blocked=[];let total=0,present=0,different=0,zeros=0,promoted=0;
 for(const [id,p]of Object.entries(catalog)){
  key(id);if(!record(p))throw Error('Producto con formato inválido');total++;
  if(!own(p,'costoRealArs'))continue;present++;
  let cost=amount(p.compraARS),copy=false;
  if(cost===null){
   // A malformed existing canonical field is never replaced by the duplicate.
   if(own(p,'compraARS')){blocked.push({id,reason:'Costo de compra existente inválido'});continue;}
   cost=approvedRootEvidence(p,rootEvidence[id]);copy=cost!==null;
   if(!copy){blocked.push({id,reason:'Falta costo canónico ARS verificado; no inferirlo del duplicado'});continue;}
  }
  if(cost===0)zeros++;if(amount(p.costoRealArs)!==null&&amount(p.costoRealArs)!==cost)different++;
  const after=clone(p);delete after.costoRealArs;if(copy){after.compraARS=cost;promoted++;}
  rows.push({id,beforeHash:digest(p),afterHash:digest(after),canonicalCost:cost,copyCanonical:copy,backup:{rootValue:clone(p.costoRealArs),hadCompraARS:own(p,'compraARS'),...(own(p,'compraARS')?{compraARS:clone(p.compraARS)}:{})}});
 }
 return {schema:1,scope:ROOT,summary:{total,present,retirable:rows.length,blocked:blocked.length,different,zeros,promoted},blocked,rows};
}
function validatePlan(plan){if(!record(plan)||plan.schema!==1||plan.scope!==ROOT||!Array.isArray(plan.rows)||!Array.isArray(plan.blocked))throw Error('Plan de retiro inválido');if(new Set(plan.rows.map(r=>r.id)).size!==plan.rows.length)throw Error('Producto repetido en el plan');for(const row of plan.rows){key(row.id);if(!/^[a-f0-9]{64}$/.test(row.beforeHash)||!/^[a-f0-9]{64}$/.test(row.afterHash)||amount(row.canonicalCost)===null||typeof row.copyCanonical!=='boolean')throw Error('Candidato de retiro inválido');}}
function preflight(catalog,plan){validatePlan(plan);if(!record(catalog))throw Error('Catálogo inválido');for(const row of plan.rows){const current=catalog[row.id];if(!record(current)||digest(current)!==row.beforeHash)throw Error('El producto cambió después del inventario: '+row.id);if(!own(current,'costoRealArs')||row.copyCanonical===own(current,'compraARS')||row.canonicalCost!==(row.copyCanonical?amount(current.costoRealArs):amount(current.compraARS)))throw Error('El plan no conserva el costo canónico: '+row.id);const after=clone(current);delete after.costoRealArs;if(row.copyCanonical)after.compraARS=row.canonicalCost;if(digest(after)!==row.afterHash)throw Error('El plan cambia campos fuera de alcance: '+row.id);}return true;}
function executablePatch(catalog,plan,activation={}){
 validatePlan(plan);if(plan.blocked.length)throw Error('Hay productos sin costo confirmado; el plan no se aplica parcialmente');
 if(activation.readersReady!==true||activation.writersReady!==true||activation.legacyClientsBlocked!==true||typeof activation.targetVersion!=='string'||!/^v\d+\.\d+\.\d+$/.test(activation.targetVersion)||activation.servedVersion!==activation.targetVersion)throw Error('Primero verificar lectores, escritores, versión servida y bloqueo de clientes antiguos');
 preflight(catalog,plan);const patch=Object.create(null);
 for(const row of plan.rows){patch[ROOT+row.id+'/costoRealArs']=null;if(row.copyCanonical)patch[ROOT+row.id+'/compraARS']=row.canonicalCost;}
 return patch;
}
function verifyAfter(catalog,plan){validatePlan(plan);if(!record(catalog))throw Error('Catálogo inválido');for(const row of plan.rows){if(!record(catalog[row.id])||own(catalog[row.id],'costoRealArs')||digest(catalog[row.id])!==row.afterHash)throw Error('El retiro no coincide o cambió otro campo: '+row.id);}return true;}
module.exports={buildPlan,preflight,executablePatch,verifyAfter};
