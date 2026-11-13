'use strict';
const Policy=require('./ot-delete-policy');
const fields=['otKey','otFbKey','ordenTrabajoKey','ordenTrabajoFbKey','otId','otNumero','ordenTrabajoId','ot'];
const saleFields=['ventaFbKey','ventaKey','ventaId'];
const key=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v);
const text=v=>typeof v==='string'?v.trim():typeof v==='number'&&Number.isFinite(v)?String(v):'';
const normalized=v=>text(v).replace(/^#/,'');
const present=v=>v!==null&&v!==undefined&&v!==''&&v!==false;
const fail=message=>Object.assign(Error(message),{code:'SV_OT_DELETE_LINK_REVIEW',statusCode:409});
function plan(otKey,original,sources){
 if(!key(otKey)||!original||typeof original!=='object'||Array.isArray(original))throw fail('La OT requiere revisión.');
 for(const domain of Policy.domains)if(!sources||!Object.hasOwn(sources,domain)||!sources[domain]||typeof sources[domain]!=='object'||Array.isArray(sources[domain]))throw fail('Falta verificar una fuente vinculada.');
 Policy.assertNoActivity(original);
 if(['reclamoKey','reclamoFbKey','reclamoId','presupuestoFbKey'].some(f=>present(original[f])))throw fail('La OT tiene otro origen vinculado.');
 const origin=saleFields.map(f=>original[f]).filter(present),identities=new Set([otKey,original.id,original.numero,original.otId].map(normalized).filter(Boolean));
 const related=v=>v&&typeof v==='object'&&(fields.some(f=>present(v[f])&&identities.has(normalized(v[f])))||Object.values(v).some(child=>child&&typeof child==='object'&&related(child)));
 const patch={['sisventas/ordenes_trabajo/'+otKey]:null};
 if(!origin.length){Policy.plan(otKey,original,sources);return{patch,removedOTKey:otKey,unlinkedSaleKey:null};}
 const matches=origin.map(ref=>Object.entries(sources.ventas).filter(([k,v])=>v&&[k,v.fbKey,v.id,v.numero,v.ventaId].map(normalized).includes(normalized(ref))));
 if(matches.some(rows=>rows.length!==1)||new Set(matches.map(rows=>rows[0][0])).size!==1)throw fail('No se pudo identificar una única venta de origen.');
 const [saleKey,sale]=matches[0][0];if(!key(saleKey)||sale._svListSummary||sale._svPagedSummary)throw fail('Hace falta la venta original completa.');
 if(original.clienteFbKey&&sale.clienteFbKey&&original.clienteFbKey!==sale.clienteFbKey)throw fail('El cliente de la OT y la venta no coincide.');
 for(const domain of Policy.domains)for(const [k,value]of Object.entries(sources[domain]))if(!(domain==='ventas'&&k===saleKey)&&related(value))throw fail('La OT tiene otros registros vinculados.');
 const next=structuredClone(sale);let changed=false;
 for(const field of fields)if(present(next[field])&&identities.has(normalized(next[field]))){delete next[field];changed=true;}
 // Never remove nested audit, collection entries or unrelated visit references.
 if(related(next))throw fail('La venta conserva referencias históricas que requieren revisión.');
 const cleanOT=structuredClone(original);for(const field of saleFields)delete cleanOT[field];
 const remainingSources={...sources,ventas:{...sources.ventas,[saleKey]:next}};Policy.plan(otKey,cleanOT,remainingSources);
 if(changed)patch['sisventas/ventas/'+saleKey]=next;
 return{patch,removedOTKey:otKey,unlinkedSaleKey:changed?saleKey:null};
}
module.exports={plan,fields};
