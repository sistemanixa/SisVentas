'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../cotizador/dashboard-commercial-activity-proposal'),Pages=require('../cotizador/commercial-pages-model'),Core=require('../js/core/dashboard-activity-model.v2');
const {fixture,legacy}=require('./helpers/dashboard-commercial-activity-fixture.cjs');
test('all three complete universes: first5 stable instants, canonical cents; OT no money or assignees',async()=>{
 const f=await fixture(127);for(const domain of M.DOMAINS){const r=await f.reader(),result=await r.read(domain);assert.equal(result.recent.rows.length,5);assert.equal(result.coverage.records,127);assert.equal(result.recent.exhausted,false);assert.equal(result.recent.rows[0].ms,1126);assert.equal(result.mixedActivityComplete,false);assert.equal(result.notificationCenterComplete,false);assert(!JSON.stringify(result).includes('NEVER_TRANSPORT'));assert(r.trace.every(t=>!['sisventas/ventas','sisventas/pagos','sisventas/ordenes_trabajo'].includes(t.path)));assert.equal(result.recent.rows[0].amountCents,domain==='ventas'?12345:domain==='pagos'?1234:null);if(domain==='ordenes_trabajo')assert.equal(result.recent.rows[0].ownerUid,'');}
});
test('real domain policies, own commercial scopes, module-wide OT, forbidden external role',async()=>{
 const f=await fixture(12);for(const uid of ['u','v'])for(const d of ['ventas','pagos']){const result=await(await f.reader(uid)).read(d);assert.equal(result.coverage.records,6);assert(result.recent.rows.every(r=>r.ownerUid===uid));assert.equal(result.recent.scope,'own');}
 const ot=await(await f.reader('t')).read('ordenes_trabajo');assert.equal(ot.coverage.records,12);assert.equal(ot.recent.scope,'all');
 await assert.rejects((await f.reader('d')).read('ordenes_trabajo'));f.set('sv_permisos/tecnico/indiceModulos/ordentrabajo',false);await assert.rejects((await f.reader('t')).read('ordenes_trabajo'));
 f.set('sv_permisos/vendedor/indiceModulos/venta',false);f.set('sv_permisos/vendedor/indiceModulos/detalle',false);f.set('sv_permisos/vendedor/indiceModulos/cobranzas',false);await assert.rejects((await f.reader('u')).read('ventas'));
});
test('real guard: create edit move instant reassign delete and retry all in one commit, sentinels untouched',async()=>{
 const f=await fixture(9),sentinels=Object.fromEntries(['stock','comisiones','ctaemp','productos','presupuestos'].map(d=>[d,f.read('sisventas/'+d)]));
 const s={id:'V-NEW',fecha:'04/11/2026',ts:9000,total:42.19,responsableUid:'u',cliente:'Nuevo',subtotal:42.19,iva:0,descuento:0,items:[{cod:'FICTICIO',qty:1,punit:42.19,sub:42.19,costoUnitarioCompra:10}]};
 await f.mutate({'sisventas/ventas/new':s});assert.equal(f.calls.commits.length,1);assert(f.calls.commits[0][M.ROOT+'/coverage']);assert(f.calls.commits[0][Pages.ROOT+'/records/sales/new']);
 await f.mutate({'sisventas/ventas/new':{...s,total:45.67,subtotal:45.67,items:[{...s.items[0],punit:45.67,sub:45.67}]}});assert.equal(f.read(M.ROOT+'/records/ventas/new/row/amountCents'),4567);
 await f.mutate({'sisventas/pagos/new':{ventaFbKey:'new',fecha:'04/11/2026',ts:9001,monto:2.01}});
 await f.mutate({'sisventas/ventas/new/responsableUid':'v','sisventas/ventas/new/ts':9500});
 for(const d of ['ventas','pagos']){const u=await(await f.reader('u')).read(d),v=await(await f.reader('v')).read(d);assert(!u.recent.rows.some(r=>r.key==='new'));assert(v.recent.rows.some(r=>r.key==='new'));}
 assert.equal(f.read(M.ROOT+'/records/pagos/new/row/ownerUid'),'v');
 await f.mutate({'sisventas/pagos/new/anulado':true});assert.equal(f.read(M.ROOT+'/records/pagos/new/row'),null);assert(!(await(await f.reader('a')).read('pagos')).recent.rows.some(r=>r.key==='new'));
 await f.mutate({'sisventas/pagos/new':null});await f.mutate({'sisventas/ventas/new':null});
 await f.mutate({'sisventas/ordenes_trabajo/new':{id:'OT-N',fecha:'04/11/2026',ts:9999,estado:'pendiente',costo:991}});
 await f.mutate({'sisventas/ordenes_trabajo/new/fechaCierre':'01/01/2020','sisventas/ordenes_trabajo/new/ts':10000});assert.equal(f.read(M.ROOT+'/records/ordenes_trabajo/new/row/ms'),10000);
 const original=f.read('sisventas/ordenes_trabajo/new');await f.mutate({'sisventas/ordenes_trabajo/new/estado':'cerrada'},{opId:'retry-fictional-id'});const revision=f.read(M.ROOT+'/coverage/revision'),count=f.calls.commits.length;await f.mutate({'sisventas/ordenes_trabajo/new/estado':'cerrada'},{opId:'retry-fictional-id'});assert.equal(f.calls.commits.length,count);assert.equal(f.read(M.ROOT+'/coverage/revision'),revision);assert.equal(f.read('sisventas/ordenes_trabajo/new/fechaCierre'),original.fechaCierre);
 await f.mutate({'sisventas/ordenes_trabajo/new':null});for(const[d,v]of Object.entries(sentinels))assert.deepEqual(f.read('sisventas/'+d),v);
});
test('zero instants and canonical annulled payments excluded; OT fechaCierre fallback, original dates retained',async()=>{
 const f=await fixture(2);await f.mutate({'sisventas/pagos/p0000/estado':'anulado','sisventas/pagos/p0001/ts':'bad','sisventas/ordenes_trabajo/o0000/ts':null,'sisventas/ordenes_trabajo/o0001/ts':null,'sisventas/ordenes_trabajo/o0001/fechaCierre':null});
 const p=await(await f.reader()).read('pagos');assert.equal(p.recent.rows.length,0);assert.equal(p.coverage.excluded,2);assert.equal(p.recent.exhausted,true);
 assert.equal(f.read(M.ROOT+'/records/ordenes_trabajo/o0000/row/ms'),Core.legacyMs('04/11/2026',null,legacy.timeZone));assert.equal(f.read(M.ROOT+'/records/ordenes_trabajo/o0001/row/ms'),Core.legacyMs('01/01/2000',null,legacy.timeZone));assert.equal(f.read('sisventas/ordenes_trabajo/o0000/fechaCierre'),'04/11/2026');
});
test('ready=false and corrupt points never resurrect; reject injected derived root and broad originals',async()=>{
 const f=await fixture();f.set(M.ROOT+'/coverage/ready',false);await assert.rejects(f.mutate({'sisventas/ordenes_trabajo/o0000/estado':'cerrada'}));assert.equal(f.calls.commits.length,0);assert.equal(f.read(M.ROOT+'/coverage/ready'),false);
 f.set(M.ROOT+'/coverage/ready',true);f.set(M.ROOT+'/records/ordenes_trabajo/o0000/sourceHash','corrupt');await assert.rejects(f.mutate({'sisventas/ordenes_trabajo/o0000/estado':'cerrada'}));assert.equal(f.calls.commits.length,0);
 await assert.rejects(f.mutate({[M.ROOT+'/coverage']:{ready:true}}));await assert.rejects(f.mutate({'sisventas/ordenes_trabajo':{}}));
});
test('permission/coverage changes during reads reject; incomplete prefix fails closed',async()=>{
 const f=await fixture();let changed=false;const r=await f.reader('u',p=>{if(p.includes('/document/')&&!changed){changed=true;f.set('sv_permisos/vendedor/indiceRevision',8);}});await assert.rejects(r.read('ventas'));
 const rr=await f.reader('a',p=>{if(p.includes('/document/'))f.set(M.ROOT+'/coverage/revision',99);});await assert.rejects(rr.read('ventas'));
 const records=f.read(M.ROOT+'/document/ventas/all');f.set(M.ROOT+'/document/ventas/all',Object.fromEntries(Object.entries(records).slice(0,2)));await assert.rejects((await f.reader()).read('ventas'));
});
test('metadata race before commit aborts original+projection together',async()=>{
 const f=await fixture();let hits=0;f.hook(p=>{if(p===M.ROOT+'/coverage'&&++hits===2)f.set(M.ROOT+'/coverage/revision',99);});await assert.rejects(f.mutate({'sisventas/ordenes_trabajo/o0000/estado':'cerrada'}));assert.equal(f.calls.commits.length,0);assert.equal(f.read('sisventas/ordenes_trabajo/o0000/estado'),'pendiente');
});
test('missing existing destination scope never becomes a fresh empty scope on reassignment',async()=>{
 const f=await fixture(9);f.set(M.ROOT+'/stats/ventas/u_v',null);f.set(M.ROOT+'/proof/ventas/u_v',null);await assert.rejects(f.mutate({'sisventas/ventas/s0000/responsableUid':'v'}));assert.equal(f.calls.commits.length,0);assert.equal(f.read('sisventas/ventas/s0000/responsableUid'),'u');
});
test('punctual work independent of unrelated history and stable key ties',async()=>{
 for(const n of [9,1009]){const f=await fixture(9,n);await f.mutate({'sisventas/ordenes_trabajo/o0000/ts':50000});const reads=f.calls.reads,patch=f.calls.commits[0];assert(!reads.some(p=>M.DOMAINS.some(d=>p==='sisventas/'+d)));assert(reads.length<30);assert(Object.keys(patch).length<15);}
 const f=await fixture(0);await f.mutate({'sisventas/ordenes_trabajo/é':{ts:100},'sisventas/ordenes_trabajo/Z':{ts:100},'sisventas/ordenes_trabajo/AA':{ts:100}});assert.deepEqual((await(await f.reader('t')).read('ordenes_trabajo')).recent.rows.map(r=>r.key),['AA','Z','é']);
});
test('bootstrap requires complete three-domain snapshot and complete Pages; empty owner scope certified',async()=>{
 const f=await fixture(0);assert.equal((await(await f.reader('u')).read('ventas')).recent.rows.length,0);const args={originals:f.data().sisventas,pages:f.read(Pages.ROOT),config:f.read('sv_commercial_pages_config'),generation:'another',...legacy};await assert.rejects(M.build(args));await assert.rejects(M.build({...args,complete:true,pages:{...args.pages,coverage:{...args.pages.coverage,sales:50}}}));
});
test('three providers share stable-v3 contract and merge primary instant then domain priority',async()=>{
 const f=await fixture(9),sources={},expected={},context={uid:'a',role:'admin',auth:{},db:{},permissionRevision:7,timeZone:M.zone(legacy.timeZone),sourceLocale:legacy.sourceLocale,grants:{ventas:'all',pagos:'all',ordenes_trabajo:'all',presupuestos:null}};
 for(const d of M.DOMAINS){const result=await(await f.reader()).read(d);sources[d]={...result.recent,context};expected[d]={generation:result.recent.generation,revision:result.recent.revision};}
 const merged=Core.merge({context,sources,expected});assert.equal(merged.complete,true);assert.deepEqual(merged.items.slice(0,3).map(r=>r.domain),M.DOMAINS);assert.equal(merged.items[0].ms,1008);assert.equal(merged.items.length,5);
});
test('mutating a host context object during a pending prefix cannot change its captured locale',async()=>{
 const f=await fixture(),previous=legacy.sourceLocale,r=await f.reader('a',p=>{if(p.includes('/document/'))legacy.sourceLocale='en-US';});try{await assert.rejects(r.read('ventas'));}finally{legacy.sourceLocale=previous;}
});
