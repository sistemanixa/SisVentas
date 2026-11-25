'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Builder=require('../scripts/lib/inventory-current-rules.cjs');
test('current rules constructor rejects unreviewed baseline objects and bytes before composing authority',()=>{
  assert.throws(()=>Builder.prepare({rules:{}}),/bytes/);
  assert.throws(()=>Builder.prepare(Buffer.from('{"rules":{}}')),/Baseline efectivo distinto/);
  assert.throws(()=>Builder.prepare(''),/Baseline efectivo distinto/);
  assert.equal(Builder.STAGES.at(-1),'office-stock-atomic-presence');
  assert.equal(Object.isFrozen(Builder.STAGES),true);
});
