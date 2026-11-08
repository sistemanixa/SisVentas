'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Receipt=require('../scripts/lib/commercial-delete-receipt-baseline.cjs'),Metadata=require('../scripts/lib/commercial-delete-metadata-baseline.cjs'),Writer=require('../scripts/lib/commercial-writer-protocol-rules.cjs'),Atomic=require('../scripts/lib/commercial-delete-atomic-rules.cjs'),F=require('./helpers/commercial-delete-atomic-fixture.cjs');
for(const [name,receipt]of Object.entries(Receipt.variants))test('Atomic preserves exact writer version gate on '+name+' receipt and guard',()=>{
 const input=F.baseline();input.rules.sv_labor_receipts.$op['.write']=receipt;const gated=Writer.prepare(input),original=structuredClone(gated),candidate=Atomic.prepare(gated);
 assert.deepEqual(gated,original);for(const path of ['sv_labor_guard','sv_labor_receipts/$op']){const prior=path==='sv_labor_guard'?gated.rules.sv_labor_guard['.write']:gated.rules.sv_labor_receipts.$op['.write'];assert(Metadata.recognized(path,prior));const next=path==='sv_labor_guard'?candidate.rules.sv_labor_guard['.write']:candidate.rules.sv_labor_receipts.$op['.write'];assert.equal(next.slice(0,prior.length+3),'('+prior+') ');assert.equal(Metadata.recognized(path,'('+prior+') || true'),false);assert.equal(Metadata.recognized(path,prior+' '),false);}
});
test('unknown writer gate and alternate metadata path remain rejected',()=>{
 const b=Writer.prepare(F.baseline());b.rules.sv_labor_guard['.write']='('+b.rules.sv_labor_guard['.write']+') && true';assert.throws(()=>Atomic.prepare(b));assert.equal(Metadata.recognized('sv_labor_indexes',b.rules.sv_labor_receipts.$op['.write']),false);
});
