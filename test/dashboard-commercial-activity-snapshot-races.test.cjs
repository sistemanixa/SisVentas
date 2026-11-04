'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../cotizador/dashboard-commercial-activity-proposal'),Pages=require('../cotizador/commercial-pages-model');
const {fixture,legacy}=require('./helpers/dashboard-commercial-activity-fixture.cjs');
for(const[kind,field,value]of [['sales','totalCents',99999],['sales','ownerUid','v'],['sales','cancelled',true],['payments','amountCents',99999],['payments','ownerUid','v'],['payments','cancelled',true]])test('build refuses same key/count but stale Pages '+kind+'.'+field,async()=>{
 const f=await fixture(2),pages=f.read(Pages.ROOT),key=kind==='sales'?'s0000':'p0000';pages.records[kind][key][field]=value;
 await assert.rejects(M.build({originals:f.data().sisventas,complete:true,pages,pagesEvidence:f.prepared.activitySnapshot,config:f.read('sv_commercial_pages_config'),generation:'other-snapshot',...legacy}));
});
for(const[path,value]of [
 [M.ROOT+'/records/ventas/s0000/sourceHash','foreign-point'],
 [M.ROOT+'/stats/ventas/all/records',777],
 [M.ROOT+'/proof/ventas/all','foreign-proof'],
 [Pages.ROOT+'/records/sales/s0000/ownerUid','v'],
 [Pages.ROOT+'/totals/all/debtCents',777]
])test('precommit refuses a concurrent point/proof/stat change at '+path,async()=>{
 const f=await fixture(2);let hits=0;f.hook(p=>{if(p==='sv_commercial_pages_config'&&++hits===2)f.set(path,value);});
 await assert.rejects(f.mutate({'sisventas/ventas/s0000/observaciones':'cambio ficticio'}));assert.equal(f.calls.commits.length,0);assert.equal(f.read('sisventas/ventas/s0000/observaciones'),null);assert.equal(f.read(path),value);
});
test('receipt binds original values too; Activity never rebuilds Pages to validate it',async()=>{
 const f=await fixture(2),args={originals:f.data().sisventas,complete:true,pages:f.read(Pages.ROOT),pagesEvidence:f.prepared.activitySnapshot,config:f.read('sv_commercial_pages_config'),generation:'same-exact-snapshot',...legacy},originalBuild=Pages.build;
 Pages.build=()=>{throw Error('Activity must not recalculate Pages');};try{const good=await M.build(args);assert.equal(good.coverage.ready,true);for(const[path,value]of [['ventas/s0000/total',999],['ventas/s0000/responsableUid','v'],['pagos/p0000/anulado',true]]){const originals=structuredClone(args.originals),[d,k,field]=path.split('/');originals[d][k][field]=value;await assert.rejects(M.build({...args,originals}));}}finally{Pages.build=originalBuild;}
});
test('canonical prepare receipt pins input before its async build can yield',async()=>{
 const P=require('../cotizador/commercial-pages-projections'),sales={s:{total:1,responsableUid:'u',fecha:'04/11/2026'}},payments={},promise=P.prepare({sales,payments,owner:s=>s.responsableUid,generation:'captured-before-yield'});sales.s.total=999;sales.s.responsableUid='v';const prepared=await promise;assert.equal(prepared.activitySnapshot.salesHash,M.hash({s:{total:1,responsableUid:'u',fecha:'04/11/2026'}}));assert.equal(prepared.patch[Pages.ROOT+'/records/sales/s'].totalCents,100);assert.equal(prepared.patch[Pages.ROOT+'/records/sales/s'].ownerUid,'u');
});
