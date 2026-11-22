'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{createReferencePort}=require('../cotizador/purchase-inventory-reference-port');
const row=patch=>({source:'sisventas/ordenes/o',rowKey:'0',productoKey:'p',codigo:'OLD',...patch});
test('internal resolver gets read/query ports, preserves three identities and revalidates complete reference',async()=>{
 let revision=1,calls=0;const read=async()=>{},query=async()=>{},port=createReferencePort({resolveReference:async(original,ports)=>{calls++;a.equal(original.purpose,'purchase');a.equal(original.record.items[original.selector].productoKey,'p');a.equal(original.record.items[original.selector].codigo,'OLD');a.equal(ports.read,read);a.equal(ports.query,query);return {productKey:'p',inventoryKey:'physical',receiptIdentityKey:'OLD',mappingRevision:revision};}});
 const sourceOrder={items:[{productoKey:'p',codigo:'OLD'},{productoKey:'p',codigo:'OLD'}]};const result=await port.resolve([row(),row({rowKey:'1'})],{read,query,sourceOrder});a.equal(calls,2);a.equal(result.resolutions.length,2);a.equal(result.references.p.inventoryKey,'physical');a.equal(result.references.p.receiptIdentityKey,'OLD');await result.assertFresh({readFresh:read,queryFresh:query});revision++;await a.rejects(result.assertFresh({readFresh:read,queryFresh:query}),{code:'SV_PURCHASE_REFERENCE_CHANGED'});
});
test('directed-range adapter forwards phase queryPage and a distinct queryPageFresh without guessing its protocol',async()=>{
 const {digest}=require('../cotizador/labor-guard'),sourceOrder={items:[{productoKey:'p',codigo:'OLD'}]},read=async()=>null,query=async()=>({});let old=0,fresh=0;
 const queryPage=async request=>{a.equal(request,'fiction-opaque-range');old++;return {one:1};},queryPageFresh=async request=>{a.equal(request,'fiction-opaque-range');fresh++;return {one:1,two:2};};
 const port=createReferencePort({resolveReference:async(_original,ports)=>{if(typeof ports.queryPage!=='function')throw Error('queryPageFresh required');return {productKey:'p',inventoryKey:'physical',receiptIdentityKey:'OLD',readSet:[{kind:'queryPage',hash:digest(await ports.queryPage('fiction-opaque-range'))}]};}});
 const result=await port.resolve([row()],{sourceOrder,read,query,queryPage});a.equal(old,1);await a.rejects(result.assertFresh({readFresh:read,queryFresh:query}),/queryPageFresh/);await a.rejects(result.assertFresh({readFresh:read,queryFresh:query,queryPageFresh}),{code:'SV_PURCHASE_REFERENCE_CHANGED'});a.equal(fresh,1);a.equal(old,1);
});
test('fresh query port is required and changed historical membership invalidates opaque readSet',async()=>{
 const {digest}=require('../cotizador/labor-guard');let membership={a:{id:'a'}};const read=async()=>null,query=async()=>structuredClone(membership),sourceOrder={items:[{productoKey:'p',codigo:'OLD'}]};
 const port=createReferencePort({resolveReference:async(_original,ports)=>{if(typeof ports.query!=='function')throw Error('queryFresh required');const records=await ports.query('sisventas/ordenes','legacyKey','o');return{productKey:'p',inventoryKey:'physical',receiptIdentityKey:'OLD',readSet:[{kind:'query',path:'sisventas/ordenes',field:'legacyKey',value:'o',hash:digest(records)}]};}});
 const result=await port.resolve([row()],{sourceOrder,read,query});await a.rejects(result.assertFresh({readFresh:read}),/queryFresh/);membership.b={id:'b'};await a.rejects(result.assertFresh({readFresh:read,queryFresh:query}),{code:'SV_PURCHASE_REFERENCE_CHANGED'});
});
test('missing resolver, ambiguous aliases or incomplete reference never fall back to a guessed branch',async()=>{
 a.throws(()=>createReferencePort());const port=createReferencePort({resolveReference:async()=>({productKey:'p',inventoryKey:'physical',receiptIdentityKey:'OLD'})}),read=async()=>{},query=async()=>{};
 await a.rejects(port.resolve([row(),row({codigo:'OTHER'})],{read,query,sourceOrder:{items:[{productoKey:'p',codigo:'OLD'}]}}),/contradictorios/);
 await a.rejects(createReferencePort({resolveReference:async()=>({productKey:'p'})}).resolve([row()],{read,query,sourceOrder:{items:[{productoKey:'p',codigo:'OLD'}]}}),/inválida/);
 await a.rejects(port.resolve([{productoKey:'p'}],{read,query}),/procedencia/);
});
