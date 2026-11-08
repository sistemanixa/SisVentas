'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {compare}=require('./fixtures/cc-before-after-comparator.cjs');
test('same fictional dataset preserves every account cent while the first native page remains bounded',async()=>{
 const result=await compare({customers:75,sales:300,budgets:17,repetitions:2,latencyMs:0});
 assert.equal(result.parity.exactCents,true);assert.equal(result.parity.allAccountRows,75);
 assert.equal(result.after.requests.p50,8);
 assert.equal(result.samples.after[0].visibleRows,50);
 assert.equal(result.samples.before[0].completeRows,75);
 assert(result.before.responseJsonBytes.p50>result.after.responseJsonBytes.p50);
 assert.equal(result.before.simulatedTransportWaitUnionMs.p50,0);
 assert.equal(result.after.simulatedTransportWaitUnionMs.p50,0);
 assert.match(result.limits.join(' '),/Not a production/);
});
