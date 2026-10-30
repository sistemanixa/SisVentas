'use strict';
// Local proposal, never writes Firebase or grants access to another module.
function prepare(current){
 if(!current||current.indiceVersion!==2||current.indiceModulos?.ordentrabajo!==true||Object.values(current.bloqueados||{}).includes('ordentrabajo')||!Number.isSafeInteger(current.indiceRevision))throw Error('Revisá el acceso actual del rol a Órdenes de trabajo.');
 const next=structuredClone(current);next.acciones||={};next.acciones.ot||={};
 if(next.acciones.ot.ajustarStockOficina===true)return next;
 next.acciones.ot.ajustarStockOficina=true;next.indiceRevision++;
 return next;
}
module.exports={prepare};
