'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Sales=require('../js/v3/sales-read-model.js');
const Economics=require('../js/v3/budget-read-model.js');
const Writer=require('../js/core/sale-writer.v1.js');

test('repeated summaries perform one economic build per lookup without retaining mutable results',()=>{
 const sales=Array.from({length:100},(_,i)=>({fbKey:'s'+i,id:'V'+i,total:i+100}));
 const payments=sales.map(s=>({fbKey:'p'+s.fbKey,ventaFbKey:s.fbKey,monto:10}));
 const model=new Sales.SalesReadModel(sales,payments),build=Economics.build;let count=0;
 Economics.build=function(...args){count++;return build.apply(this,args);};
 try{for(let i=0;i<1000;i++){const result=model.summaryFor('s'+i%100);assert.equal(result.total,sales[i%100].total);assert.equal(result.paid,10);}assert.equal(count,1000,'one fresh economic build per found summary');}
 finally{Economics.build=build;}
 sales[0].total=200;payments[0].monto=25;
 const changed=model.summaryFor('s0');assert.equal(changed.total,200);assert.equal(changed.paid,25);assert.equal(changed.balance,175);
});

test('summary observes item edits between calls and retains exact line rounding',()=>{
 const calculated=Writer.calculate({items:[{qty:5,punit:1.34,disc:35}],descuentoGeneral:0,conIva:true});
 const sale={...calculated,fbKey:'sale',id:'V1'},payment={fbKey:'payment',ventaFbKey:'sale',monto:1};
 const model=new Sales.SalesReadModel([sale],[payment]);
 const first=model.summaryFor('sale');assert.equal(first.total,Sales.saleTotal(sale));assert.equal(first.total,5.28);assert.equal(first.paid,1);
 sale.items[0].punit=2;const changed=model.summaryFor('sale');assert.equal(changed.total,Sales.saleTotal(sale));assert.notEqual(changed.total,first.total);assert.notDeepEqual(changed.economic,first.economic);assert.equal(first.total,5.28);assert(Object.isFrozen(changed));assert(Object.isFrozen(changed.payments));
});

test('missing and ambiguous references perform no economics and cannot inherit payments',()=>{
 const model=new Sales.SalesReadModel([{fbKey:'duplicate',id:'A',total:100},{fbKey:'duplicate',id:'B',total:200}],[{fbKey:'p',ventaFbKey:'duplicate',monto:10}]);
 const build=Economics.build;let count=0;Economics.build=function(...args){count++;return build.apply(this,args);};
 try{assert.equal(model.summaryFor('missing').status,'missing');assert.equal(model.summaryFor('duplicate').status,'ambiguous');assert.equal(count,0);const business=model.summaryFor('A');assert.equal(business.total,100);assert.equal(business.paid,0);assert.equal(business.payments.length,0);}
 finally{Economics.build=build;}
});


test('summary preserves writer totals and cent balances across fractional discount and tax combinations',()=>{
 for(const punit of [1.34,10.13,17.19,101.99])for(const qty of [1,3,5,2.5])for(const disc of [0,5,35,12.5])for(const descuentoGeneral of [0,10,2.5])for(const conIva of [false,true]){
  const out=Writer.calculate({items:[{qty,punit,disc}],descuentoGeneral,conIva}),sale={...out,fbKey:'sale',id:'V1'},amount=Math.min(1,out.total);
  const result=new Sales.SalesReadModel([sale],[{fbKey:'payment',ventaFbKey:'sale',monto:amount}]).summaryFor('sale');
  assert.equal(result.total,out.total);assert.equal(result.paid,amount);assert.equal(Math.round(result.balance*100),Math.max(0,Math.round(out.total*100)-Math.round(amount*100)));
 }
});
