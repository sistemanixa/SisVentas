'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const API=require('../js/core/dashboard-startup-demand.v1.js');
const base={authenticated:true,visible:true,page:'dashboard',moduleAllowed:true,can:()=>false,canDomain:()=>true,directoryAllowed:true};
test('no visible consumers produce no collection demand',()=>assert.deepEqual(API.plan(base).sources,[]));
for(const field of ['authenticated','visible','moduleAllowed'])test('denied '+field,()=>assert.deepEqual(API.plan({...base,[field]:false,can:()=>true}).sources,[]));
test('other module never receives dashboard startup',()=>assert.deepEqual(API.plan({...base,page:'productos',can:()=>true}).sources,[]));
test('technical own account does not require commercial catalogs',()=>assert.deepEqual(API.plan({...base,can:a=>a==='dashboard.miCuenta'}).sources,['usuarios','empleados','gastos']));
test('metrics preserve full sales/payment inputs and forbid unrelated catalogs',()=>assert.deepEqual(API.plan({...base,can:a=>a==='dashboard.metricasGlobales'}).sources,['clientes','ventas','pagos','presupuestos']));
test('price health explicitly preserves its provider dependency',()=>assert.deepEqual(API.plan({...base,widgets:{priceHealth:true}}).sources,['productos','proveedores']));
test('own orders retain directory/client references',()=>assert.deepEqual(API.plan({...base,can:a=>a==='dashboard.misOT'}).sources,['usuarios','empleados','clientes','ordenesTrabajo']));
test('permissions intersect consumer demand and do not grant raw employees',()=>assert.deepEqual(API.plan({...base,directoryAllowed:false,can:()=>true,canDomain:()=>false}).sources,[]));
test('immutable reasons document shared source consumers',()=>{const p=API.plan({...base,can:()=>true});assert.equal(p.sources.filter(x=>x==='ventas').length,1);assert.ok(p.reasons.ventas.includes('metrics'));assert.ok(Object.isFrozen(p.reasons.ventas));});
test('reentrant renders join attempts, no timers or network in scheduler',()=>{let core;const scope={},calls=[];const p={sources:['ventas','pagos']};core=API.create({capture:()=>scope,valid:s=>s===scope,loaders:{ventas(){calls.push('ventas');core.start(p);},pagos(){calls.push('pagos');}}});core.start(p);core.start(p);assert.deepEqual(calls,['ventas','pagos']);});
test('retired auth context cannot begin later sources',()=>{let valid=true;const scope={},calls=[];const core=API.create({capture:()=>scope,valid:()=>valid,loaders:{ventas(){calls.push('ventas');valid=false;},pagos(){calls.push('pagos');}}});core.start({sources:['ventas','pagos']});assert.deepEqual(calls,['ventas']);});
test('error stays with source owner, no implicit retry or zero data',()=>{const scope={},errors=[],calls=[];const core=API.create({capture:()=>scope,valid:()=>true,loaders:{ventas(){calls.push(1);throw Error('fixture');}},failed:(s)=>errors.push(s)});core.start({sources:['ventas']});core.start({sources:['ventas']});assert.deepEqual(errors,['ventas']);assert.equal(calls.length,1);});
test('new explicit context can start sources without old cached values',()=>{let scope={};const calls=[];const core=API.create({capture:()=>scope,valid:s=>s===scope,loaders:{ventas(){calls.push(1);}}});core.start({sources:['ventas']});scope={};core.start({sources:['ventas']});assert.equal(calls.length,2);});


test('own identity uses directory authorization even when raw users domain is denied',()=>assert.deepEqual(API.plan({...base,can:a=>a==='dashboard.miCuenta',canDomain:d=>d!=='usuarios'}).sources,['usuarios','empleados','gastos']));
test('recent activity preserves payments even without sales metrics',()=>assert.ok(API.plan({...base,widgets:{recentActivity:true}}).sources.includes('pagos')));
