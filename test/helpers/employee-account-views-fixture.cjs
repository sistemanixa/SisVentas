'use strict';
// The same browser read adapter as index.html, backed only by in-memory SDK
// callbacks. Financial fixtures retain their exact saved money and identity.
const assert=require('node:assert/strict'),Core=require('../../js/core/employee-account-views.v1.js'),Model=require('../../cotizador/employee-account-view-model');
function install(context){const browser=context.window||context;
 if(browser!==context){for(const name of Object.keys(browser))if(name!=='window'&&!(name in context))Object.defineProperty(context,name,{configurable:true,enumerable:true,get:()=>browser[name],set:value=>browser[name]=value});for(const name of Object.keys(context))if(name!=='window'&&!(name in browser))Object.defineProperty(browser,name,{configurable:true,enumerable:true,get:()=>context[name],set:value=>context[name]=value});}
 const raw={get:context.fbGet||(()=>assert.fail('No GET in subscription fixture')),onValue:context.fbOnValue,ref:context.fbRef,query:context.fbQuery};const ref=(...args)=>{const result=raw.ref(...args);if(result&&typeof result==='object'&&typeof result.path==='string')Object.defineProperty(result,'toString',{configurable:true,value(){return this.path;}});return result;};context.fbRef=ref;
 const api=Core.create(context);api.install({sdk:{...raw,ref}});context.SVEmployeeAccountViews=api;browser.SVEmployeeAccountViews=api;return api;
}
function employeeEnvelope(employeeId,cta={},gastos={}){const account={},expenses={};for(const [key,raw]of Object.entries(cta||{})){if(raw===null)continue;const out=Model.projectMovement(raw,{employeeId,key});assert.equal(out.complete,true,'Fixture CTA tipada: '+key+' '+out.issues);account[key]=out.value;}for(const [key,raw]of Object.entries(gastos||{})){const owner=Model.ownerOfExpense(raw);if(!owner.complete||owner.owner!==employeeId)continue;const out=Model.projectExpense(raw,{key});assert.equal(out.complete,true,'Fixture Gasto tipada: '+key+' '+out.issues);expenses[key]=out.value;}return{meta:{schema:1,ready:true,revision:'fixture-safe-revision-000001'},ctaemp:account,gastos:expenses};}
module.exports={install,employeeEnvelope,BASE:Core.BASE};
