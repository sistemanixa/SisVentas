'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createMemoryRepository}=require('../scripts/dev-employee-clothing.cjs');
const Clothing=require('../js/core/employee-clothing-model.js');
const Categories=require('../js/core/expense-categories-model.js');
const at='2026-11-13T12:00:00Z';
const delivery=(operationId,actorId='admin-fixture',quantity=1)=>({type:'employee.deliver',operationId,actorId,at,garmentId:'garment-demo',variantId:'size-m',quantity,employeeId:'person-demo-a'});

test('isolated repository supports both authorized roles and leaves expense finance unchanged',()=>{
  for(const [role,uid]of [['admin','admin-fixture'],['administrativo','office-fixture']]){
    const repository=createMemoryRepository(),before=repository.snapshot(),revision=before.state.revision;
    const issued=repository.commit(role,delivery('deliver-'+role,uid,2),revision);
    assert.equal(Clothing.inventory(issued).find(v=>v.variantId==='size-m').quantity,6);
    const returned=repository.commit(role,{...delivery('return-'+role,uid),type:'employee.return',deliveryOperationId:'deliver-'+role},issued.revision);
    assert.equal(Clothing.inventory(returned).find(v=>v.variantId==='size-m').quantity,7);
    assert.equal(Clothing.employeeHistory(returned,'person-demo-a').length,2);
    assert.deepEqual(repository.snapshot().expenses,before.expenses);
    assert.deepEqual(repository.snapshot().employees,before.employees);
  }
});

test('revoked unauthorized or forged actor cannot read or change the fixture',()=>{
  const repository=createMemoryRepository(),before=repository.snapshot();
  for(const role of ['tecnico','revocado','unknown']){
    assert.throws(()=>repository.read(role));
    assert.throws(()=>repository.commit(role,delivery('forbidden'),before.state.revision));
    assert.throws(()=>repository.createCategory(role,{operationId:'forbidden',name:'Nueva',expectedRevision:0}));
  }
  assert.throws(()=>repository.commit('administrativo',delivery('forged','admin-fixture'),before.state.revision));
  assert.deepEqual(repository.snapshot(),before);
});

test('existing expense and active employee references are checked without changing original finance',()=>{
  const repository=createMemoryRepository(),before=repository.snapshot();
  for(const employeeId of ['missing','person-demo-inactive'])assert.throws(()=>repository.commit('admin',{...delivery('invalid-person'),employeeId},before.state.revision),/empleado/i);
  assert.throws(()=>repository.commit('admin',{type:'stock.receive',operationId:'missing-expense',actorId:'admin-fixture',at,garmentId:'garment-demo',variantId:'size-m',quantity:3,unitCost:'0.01',gastoRef:'missing'},before.state.revision),/gasto/i);
  assert.deepEqual(repository.snapshot(),before);
});

test('stale competing delivery cannot overwrite a committed quantity and replay repairs uncertain acknowledgment',()=>{
  const repository=createMemoryRepository(),initial=repository.snapshot(),first=delivery('first','admin-fixture',2);
  const committed=repository.commit('admin',first,initial.state.revision);
  assert.throws(()=>repository.commit('admin',delivery('competing','admin-fixture',1),initial.state.revision),error=>error.status===409);
  assert.deepEqual(repository.snapshot().state,committed);
  // The caller lost the first response and retries the same identity and body.
  assert.deepEqual(repository.commit('admin',first,initial.state.revision),committed);
  assert.equal(Clothing.inventory(repository.snapshot().state).find(v=>v.variantId==='size-m').quantity,6);
  assert.throws(()=>repository.commit('admin',{...first,quantity:3},committed.revision),{code:'CLOTHING_OPERATION_CONFLICT'});
  assert.deepEqual(repository.snapshot().state,committed);
});

test('receipt costs retain cents while linking a purchase never duplicates the expense',()=>{
  const repository=createMemoryRepository(),initial=repository.snapshot();
  const state=repository.commit('admin',{type:'stock.receive',operationId:'exact-cost',actorId:'admin-fixture',at,garmentId:'garment-demo',variantId:'size-l',quantity:3,unitCost:'0.01',gastoRef:'expense-clothing-demo'},initial.state.revision);
  const receipt=state.events.find(e=>e.operationId==='exact-cost');
  assert.equal(receipt.unitCost,0.01);assert.equal(receipt.totalCost,0.03);assert.equal(receipt.currency,'ARS');
  assert.deepEqual(repository.snapshot().expenses,initial.expenses);
  assert.equal(repository.snapshot().expenses.length,1);
});

test('expense category action sentinel is never a saved category and historical aliases are unchanged',()=>{
  const initial=Categories.createState();
  assert.throws(()=>Categories.create(initial,{operationId:'sentinel',expectedRevision:0,name:'__sv_add_expense_category__'}));
  const historical=[' mercaderia ','MERCADERÍA','Uniformes históricos'],copy=JSON.stringify(historical);
  const options=Categories.options(initial,historical);
  assert.equal(JSON.stringify(historical),copy);
  assert(options.find(o=>o.name==='Mercadería').values.includes(' mercaderia '));
  assert(options.some(o=>o.name==='Indumentaria'));
});

test('garment photo validation rejects active or credential-bearing URLs',()=>{
  for(const photoUrl of ['javascript:alert(1)','data:image/png;base64,AA==','https://user:password@example.test/a.jpg','http://example.test/a.jpg'])assert.throws(()=>Clothing.apply(Clothing.create(),{type:'garment.create',operationId:'photo',actorId:'admin-fixture',at,garmentId:'photo-garment',name:'Prenda ficticia',variants:[{id:'m',size:'M',color:'Azul'}],photoUrl}));
});
