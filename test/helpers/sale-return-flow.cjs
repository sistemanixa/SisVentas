'use strict';
const assert=require('node:assert/strict');
async function runFlow(adapter){
 const required=['openColdList','openDetail','duplicate','waitDependencies','inspectForm','save','reopen','returnToBudget','inspectPresentation','inspectInvariants'];
 for(const method of required)assert.equal(typeof adapter[method],'function','Missing adapter method '+method);
 const listed=await adapter.openColdList();assert.equal(listed.ready,true);assert.equal(listed.complete,true);
 const original=await adapter.openDetail(listed.fixtureKey);assert.ok(original.items.length);
 await adapter.duplicate();
 const dependencies=await adapter.waitDependencies();assert.equal(dependencies.catalog,true);assert.equal(dependencies.directory,true);
 const form=await adapter.inspectForm();assert.deepEqual(form.items,original.items);assert.deepEqual(form.photos,original.photos);assert.equal(form.editable,true);
 const saved=await adapter.save();assert.equal(saved.confirmed,true);assert.notEqual(saved.key,listed.fixtureKey);
 const reopened=await adapter.reopen(saved.key);assert.deepEqual(reopened.items,form.items);assert.deepEqual(reopened.photos,form.photos);assert.equal(reopened.total,form.total);
 const returned=await adapter.returnToBudget(saved.key);assert.equal(returned.confirmed,true);assert.ok(returned.budgetKey);assert.equal(returned.saleKey,saved.key);
 const presentation=await adapter.inspectPresentation();assert.equal(presentation.saleVisible,false);assert.equal(presentation.budgetVisible,true);assert.equal(presentation.pending,false);assert.equal(presentation.error,null);
 const invariants=await adapter.inspectInvariants();assert.equal(invariants.originalUnchanged,true);assert.equal(invariants.paymentsUnchanged,true);assert.equal(invariants.stockUnchanged,true);assert.equal(invariants.commissionsUnchanged,true);assert.equal(invariants.returnCommits,1);
 return {savedKey:saved.key,budgetKey:returned.budgetKey};
}
module.exports={runFlow};
