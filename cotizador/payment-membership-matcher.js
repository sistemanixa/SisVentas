'use strict';
const crypto=require('node:crypto');
// These three functions preserve the published v3.14.0 matcher, including its
// truthy String conversion, technical priority and significant leading zeroes.
function txtKey(x){return String(x||'').trim();}
function saleKeys(v){
 v=v||{};
 const exactas=[v.fbKey,v.ventaFbKey,v.ventaKey,v.id,v.idOriginal,v.numeroOriginal,v.ventaIdOriginal,v.numero,v.ventaId,v.idVenta,v.nro,v.codigo].map(txtKey).filter(Boolean);
 const visibles=[v.id,v.idOriginal,v.numeroOriginal,v.ventaIdOriginal,v.numero,v.ventaId,v.idVenta,v.nro,v.codigo].map(txtKey).filter(Boolean);
 const nums=visibles.map(k=>k.replace(/\D/g,'')).filter(Boolean);
 return{exactas:Array.from(new Set(exactas)),nums:Array.from(new Set(nums))};
}
function belongsToSale(reg,venta){
 if(!reg||!venta)return false;
 const claves=saleKeys(venta);
 const refsTecnicas=[reg.ventaFbKey,reg.ventaKey,reg.ventaGeneradaFbKey,reg.ventaOrigenFbKey].map(txtKey).filter(Boolean);
 if(refsTecnicas.length){const tecnicas=[venta.fbKey,venta.ventaFbKey,venta.ventaKey].map(txtKey).filter(Boolean);return refsTecnicas.some(r=>tecnicas.includes(r));}
 const refs=[reg.venta,reg.ventaId,reg.idVenta,reg.nroVenta,reg.numeroVenta,reg.ventaNumero].map(txtKey).filter(Boolean);
 if(refs.some(r=>claves.exactas.includes(r)))return true;
 const nums=refs.map(r=>r.replace(/\D/g,'')).filter(Boolean);
 return claves.nums.some(n=>nums.includes(n));
}
const TECHNICAL_FIELDS=Object.freeze(['ventaFbKey','ventaKey','ventaGeneradaFbKey','ventaOrigenFbKey']);
const BUSINESS_FIELDS=Object.freeze(['venta','ventaId','idVenta','nroVenta','numeroVenta','ventaNumero']);
const MATCHER_HASH=crypto.createHash('sha256').update([txtKey,saleKeys,belongsToSale].map(fn=>fn.toString().replace(/\r\n?/g,'\n')).join('\n')).digest('hex');
function paymentReferences(record){
 const technical=Array.from(new Set(TECHNICAL_FIELDS.map(key=>txtKey(record?.[key])).filter(Boolean))).sort();
 if(technical.length)return{hasTechnicalRefs:true,technical,businessExact:[],businessDigits:[]};
 const businessExact=Array.from(new Set(BUSINESS_FIELDS.map(key=>txtKey(record?.[key])).filter(Boolean))).sort();
 return{hasTechnicalRefs:false,technical:[],businessExact,businessDigits:Array.from(new Set(businessExact.map(value=>value.replace(/\D/g,'')).filter(Boolean))).sort()};
}
function saleReferences(sale){const keys=saleKeys(sale);return{technical:Array.from(new Set([sale?.fbKey,sale?.ventaFbKey,sale?.ventaKey].map(txtKey).filter(Boolean))).sort(),businessExact:keys.exactas.slice().sort(),businessDigits:keys.nums.slice().sort()};}
module.exports={txtKey,saleKeys,belongsToSale,paymentReferences,saleReferences,TECHNICAL_FIELDS,BUSINESS_FIELDS,MATCHER_HASH};
