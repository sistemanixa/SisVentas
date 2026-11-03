'use strict';
// Offline proposal only: preserve the existing payment authorization and fence.
function build(input){
 const out=structuredClone(input),r=out.rules,v=r?.sv_commercial_pages?.v1;
 if(!v||!['.read','.write'].every(k=>r[k]===undefined||r[k]===false||r[k]==='false')||![undefined,false,'false'].includes(r.sv_commercial_pages['.read'])||![undefined,false,'false'].includes(v['.read']))throw Error('Revisar autoridad de las rutas comerciales.');
 const pay=v.records?.payments?.$record?.['.read'];
 if(typeof pay!=='string'||!pay.includes('cobranzas')||!pay.includes('sv_access_resets')||v.records?.['.read']||v.search?.['.read'])throw Error('No existe autorización acotada de Cobranzas.');
 if(v.records.collection&&!v.records.collection.$record?.['.read'])throw Error('Revisar el selector de Cobranzas.');
 const paymentNode=r.sisventas?.pagos;if(!paymentNode)throw Error('Falta la ruta de cobros.');const existing=paymentNode['.indexOn'];paymentNode['.indexOn']=[...new Set([...(Array.isArray(existing)?existing:typeof existing==='string'?[existing]:[]),'grupoPago'])];
 const enabled="root.child('sv_commercial_pages_config/nativeCollectionsReady').val() === true && root.child('sv_commercial_pages_config/nativeCollectionsSchema').val() === 1 && root.child('sv_commercial_pages/v1/coverage/nativeCollectionsSchema').val() === 1";
 v.paymentGroups={$group:{'.read':'('+pay+') && '+enabled+" && $group.matches(/^[a-f0-9]{64}$/)"}};
 v.records.collection={$record:{'.read':'('+pay+') && '+enabled}};
 v.search=v.search||{};for(const kind of ['collection','payments'])v.search[kind]={$term:{'.read':'('+pay+') && '+enabled+" && $term.matches(/^[a-f0-9]{4}([a-f0-9]{2})?$/) && query.orderByKey && query.limitToFirst > 0 && query.limitToFirst <= 50"}};
 return out;
}
module.exports={build};
