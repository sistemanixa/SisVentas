'use strict';
// Offline only: preserve the exact serving router outside one read-only purpose.
const crypto=require('node:crypto');
const BASE_NATIVE_SHA256='073cfa67fc237ab770044d9efb8a65c3ab9af2a75fdc5643a5a0ff5f680bb9a8';
const before="result={record:{...(commissionDetail?require('./commission-detail-projection').project(records[id]):records[id]),fbKey:id},...(commissionDetail?{projection:'commission-economic-v1'}:{})};";
const after="/* sale-payment-history-v1 */ if(new URL(req.url,'http://localhost').searchParams.get('para')==='pagos'){if(match[1]!=='ventas'||actor.viewing)throw Object.assign(Error('Sin acceso al historial de pagos'),{statusCode:403});const detail=await require('./commercial-sale-payments').create({ownership:commercialOwnership,store:laborRuntime.store}).load({req,actor,saleKey:id,record:records[id]});result={...detail,record:{...detail.record,fbKey:id}};}else{"+before+'}';
const sha=value=>crypto.createHash('sha256').update(value.replace(/\r\n/g,'\n')).digest('hex');
function count(text,part){return text.split(part).length-1;}
function prepareSource(source){
 if(typeof source!=='string'||count(source,before)!==1)throw Error('Unknown commercial record boundary');
 if(source.includes('/* sale-payment-history-v1 */')){if(count(source,after)!==1)throw Error('Modified sale payment purpose');return source;}
 return source.replace(before,after);
}
function restoreProduction(source){if(typeof source!=='string'||count(source,after)!==1||count(source,before)!==1)throw Error('Unknown production payment overlay');const restored=source.replace(after,before);if(sha(restored)!==BASE_NATIVE_SHA256)throw Error('Unreviewed native router changes');return restored;}
function prepareProduction(source){
 if(typeof source!=='string')throw Error('Missing native router');
 if(source.includes('/* sale-payment-history-v1 */')){restoreProduction(source);return source;}
 if(sha(source)!==BASE_NATIVE_SHA256)throw Error('Unreviewed native router');return prepareSource(source);
}
module.exports={BASE_NATIVE_SHA256,prepareSource,prepareProduction,restoreProduction};
