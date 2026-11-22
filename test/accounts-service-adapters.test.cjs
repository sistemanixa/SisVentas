'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {reviewedService,reviewedReadQuery}=require('../scripts/lib/client-account-runtime-overlay.cjs');
const fixtures=require('./fixtures/accounts-service-adapters.json');
test('reviewed modern service reverses exactly to the historical Accounts service',()=>{
 const legacy=reviewedService(fixtures.legacy),modern=reviewedService(fixtures.modern);
 assert.equal(modern,legacy);assert.equal(fixtures.modern.includes('PurchaseSourceCost.sanitize(StockOrderPolicy.sanitizeClaims(StockLinkPolicy.sanitizeClaims(claims)))'),true);
});
test('Accounts reader is byte-identical and the exact separate Stock port stays outside the historical payload',()=>{
 assert.equal(reviewedReadQuery(fixtures.legacyReadQuery),fixtures.legacyReadQuery);
 assert.equal(reviewedReadQuery(fixtures.modernReadQuery),fixtures.legacyReadQuery);
 for(const source of [fixtures.modernReadQuery+'unreviewed();',fixtures.modernReadQuery.replace('129','999'),fixtures.modernReadQuery.replace('Object.hasOwn(fields,path)','true'),fixtures.legacyReadQuery+' ',fixtures.modernReadQuery.replace('async function queryPage','async function unknownPage')])assert.throws(()=>reviewedReadQuery(source),/adapter|reader|reversal/);
});
test('unreviewed service code and weakened or substituted sanitization reject',()=>{
 for(const text of [
  fixtures.modern.replace('svLaborService:true','svLaborService:false'),
  fixtures.modern.replace('svLaborWriterSchema:2','svLaborWriterSchema:1'),
  fixtures.modern.replace('PurchaseSourceCost.sanitize(StockOrderPolicy.sanitizeClaims(StockLinkPolicy.sanitizeClaims(claims)))','{...(claims||{})}'),
  fixtures.modern.replace('PurchaseSourceCost.sanitize(', 'unreviewedSanitize('),
  fixtures.modern.replace('delete clean.svLaborWriterSchema;',''),
  fixtures.modern.replace('return clean;','return claims;'),
  fixtures.modern.replace('}});','}});unreviewed();'),
  fixtures.modern+'\n'+fixtures.modern,
  fixtures.modern.replace(' const sanitizedClaims=', ' const sanitizedClaims ='),
  fixtures.modern.replaceAll('\n','\r\n'),
  fixtures.legacy.replace('return clean;','return claims;'),
 ])assert.throws(()=>reviewedService(text),/adapter|claims|reversal/i);
});
