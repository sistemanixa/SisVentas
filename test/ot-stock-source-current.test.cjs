'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),Source=require('../cotizador/ot-stock-source-authority');
const Fixture=require('./helpers/ot-active-flow-fixture.cjs');
for(const tamper of [false,true])test('current Lifecycle Guard/REST Store source seal, tamper='+tamper,async()=>{
 const f=await Fixture.create({productCount:1,otherCount:0,rowCount:1}),commit=f.runtime.store.commit.bind(f.runtime.store);
 f.runtime.store.commit=async(patch,lease,actor)=>{
  assert.equal(Source.isBound(actor),true);
  if(tamper)patch['sisventas/inventario_operativo/product0'].general=999;
  await Source.validate({actor,lease,patch,readFresh:p=>f.runtime.store.read(p),operationalSummaries:true});
  return commit(patch,lease,actor);
 };
 if(tamper){await assert.rejects(f.save());assert.equal(f.commits.length,0);assert.equal(f.get('sisventas/inventario_operativo/product0').consumido,0);}
 else{assert.equal((await f.save()).confirmed,true);assert.equal(f.commits.length,1);}
});
test('serialized client and operation flags cannot supply source authority',()=>{
 for(const operation of ['ot-lifecycle','ot-inventory'])assert.equal(Source.isBound({operation,claims:{svOTLifecycleVersion:1,svOTInventoryVersion:1},otLifecycle:{uid:'u'},otInventory:{uid:'u'}}),false);
});
