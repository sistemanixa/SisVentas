'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),{createReferencePort}=require('../cotizador/purchase-inventory-reference-port');
const row=patch=>({source:'sisventas/ordenes/o',rowKey:'0',productoKey:'p',codigo:'OLD',...patch});
test('internal resolver gets read/query ports, preserves three identities and revalidates complete reference',async()=>{
 let revision=1,calls=0;const read=async()=>{},query=async()=>{},port=createReferencePort({resolveReference:async(original,ports)=>{calls++;a.equal(original.productoKey,'p');a.equal(original.codigo,'OLD');a.equal(ports.read,read);a.equal(ports.query,query);return {productKey:'p',inventoryKey:'physical',receiptIdentityKey:'OLD',mappingRevision:revision};}});
 const result=await port.resolve([row(),row({rowKey:'1'})],{read,query});a.equal(calls,2);a.equal(result.resolutions.length,2);a.equal(result.references.p.inventoryKey,'physical');a.equal(result.references.p.receiptIdentityKey,'OLD');await result.assertFresh({readFresh:read,queryFresh:query});revision++;await a.rejects(result.assertFresh({readFresh:read,queryFresh:query}),{code:'SV_PURCHASE_REFERENCE_CHANGED'});
});
test('missing resolver, ambiguous aliases or incomplete reference never fall back to a guessed branch',async()=>{
 a.throws(()=>createReferencePort());const port=createReferencePort({resolveReference:async()=>({productKey:'p',inventoryKey:'physical',receiptIdentityKey:'OLD'})}),read=async()=>{},query=async()=>{};
 await a.rejects(port.resolve([row(),row({codigo:'OTHER'})],{read,query}),/contradictorios/);
 await a.rejects(createReferencePort({resolveReference:async()=>({productKey:'p'})}).resolve([row()],{read,query}),/inválida/);
 await a.rejects(port.resolve([{productoKey:'p'}],{read,query}),/procedencia/);
});
