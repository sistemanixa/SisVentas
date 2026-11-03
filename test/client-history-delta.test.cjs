'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../cotizador/client-history-model'),A=require('../cotizador/client-account-projection'),{delta}=require('../cotizador/client-history-delta');
function input(){return{records:{ventas:{s:{id:'V-FAKE',clienteFbKey:'c1',total:100.11,responsableUid:'u'}},pagos:{p:{ventaFbKey:'s',monto:20.03}},presupuestos:{},ordenes_trabajo:{},reclamos:{},tickets:{},equipos:{}},customers:{clients:{c1:{nombre:'Cliente uno'},c2:{nombre:'Cliente dos'}},index:{},structures:{}},owner:record=>record.responsableUid||'u',generation:'history-delta'};}
function tree(patch){const root={};apply(root,patch);return root;}
function apply(root,patch){for(const [path,value]of Object.entries(patch)){const keys=path.split('/');let node=root;for(const key of keys.slice(0,-1))node=node[key]||(node[key]={});if(value===null)delete node[keys.at(-1)];else node[keys.at(-1)]=structuredClone(value);}}
const at=(root,path)=>path.split('/').reduce((node,key)=>node?.[key],root)??null;
const source=(built,domain,key)=>built.patch[M.ROOT+'/sources/'+domain+'/'+key]??null;
function change(before,after,domain,key){return{domain,key,before:source(before,domain,key),after:source(after,domain,key)};}
async function project(before,after,changes,root=tree(before.patch)){
 const reads=[],patch=await delta(changes,{generation:before.generation,revision:2,read:async path=>{reads.push(path);return structuredClone(at(root,path));}});
 assert(reads.every(path=>path.startsWith(M.ROOT+'/')));assert(Object.keys(patch).every(path=>path.startsWith(M.ROOT+'/')));apply(root,patch);return{root,patch,reads};
}
test('financial source change updates exact totals, rows and memberships together without original reads or writes',async()=>{
 const f=input(),before=await M.prepare(f);f.records.ventas.s.total=120.11;f.records.pagos.p.monto=40.03;const originals=structuredClone(f.records),after=await M.prepare({...f,revision:2});
 const {root}=await project(before,after,[change(before,after,'ventas','s'),change(before,after,'pagos','p')]),path=M.ROOT+'/accounts/all/'+A.hash('client:c1');
 assert.deepEqual(at(root,path+'/ventas').totals,{rows:1,totalCents:12011,paidCents:4003,balanceCents:8008,receivedCents:0,unknownAmounts:0});assert.equal(at(root,path+'/pagos').totals.receivedCents,4003);assert.deepEqual(f.records,originals);assert.equal(at(root,M.ROOT+'/state').records,2);
});
test('changing a sale identity requires every related source in the same commit',async()=>{
 const f=input();f.records.equipos.e={ventaFbKey:'s',serie:'FAKE-1'};const before=await M.prepare(f);f.records.ventas.s.clienteFbKey='c2';f.records.ventas.s.responsableUid='v';const after=await M.prepare({...f,revision:2}),root=tree(before.patch),frozen=structuredClone(root);
 await assert.rejects(project(before,after,[change(before,after,'ventas','s')],root),/vínculo/);assert.deepEqual(root,frozen);
 const {root:updated}=await project(before,after,['ventas/s','pagos/p','equipos/e'].map(name=>change(before,after,...name.split('/'))));
 assert.equal(at(updated,M.ROOT+'/accounts/u_u/'+A.hash('client:c1')+'/ventas').totals.rows,0);assert.equal(at(updated,M.ROOT+'/accounts/u_v/'+A.hash('client:c2')+'/ventas').totals.balanceCents,8008);assert.equal(at(updated,M.ROOT+'/accounts/all/'+A.hash('client:c2')+'/equipos').totals.rows,1);
});
test('stale source, incomplete coverage and missing existing membership fail before returning a patch',async()=>{
 const f=input(),before=await M.prepare(f);f.records.ventas.s.total=120;const after=await M.prepare({...f,revision:2}),changes=[change(before,after,'ventas','s')];
 let root=tree(before.patch);at(root,M.ROOT+'/sources/ventas/s').row.totalCents=999;await assert.rejects(project(before,after,changes,root),/fuente/);
 root=tree(before.patch);at(root,M.ROOT+'/coverage/all/tickets').ready=false;await assert.rejects(project(before,after,changes,root),/fuente completa/);
 root=tree(before.patch);delete at(root,M.ROOT+'/memberKeys/all/'+A.hash('client:c1')).ventas;await assert.rejects(project(before,after,changes,root),/membresía/);
});
test('removing rows across a fifty-row boundary recomputes bounded page manifests and address totals',async()=>{
 const f=input();for(let i=0;i<121;i++)f.records.presupuestos['p'+i]={id:'PP-'+i,clienteFbKey:'c1',total:0.1,fecha:'2026-11-01'};
 const before=await M.prepare(f);for(let i=0;i<21;i++)delete f.records.presupuestos['p'+i];const after=await M.prepare({...f,revision:2});const {root}=await project(before,after,Array.from({length:21},(_,i)=>change(before,after,'presupuestos','p'+i))),meta=at(root,M.ROOT+'/accounts/all/'+A.hash('client:c1')+'/presupuestos');
 assert.equal(meta.totals.rows,100);assert.equal(meta.totals.totalCents,1000);assert.equal(meta.pageEnds.length,2);assert.equal(Object.values(meta.addresses)[0].totals.rows,100);assert.equal(at(root,M.ROOT+'/coverage/all/presupuestos').records,100);
});
test('new customer metadata includes explicitly covered empty tabs without manufacturing an absent user scope',async()=>{
 const f=input(),before=await M.prepare(f);f.records.ventas.new={id:'V-NEW',clienteFbKey:'c2',total:70,responsableUid:'v'};const after=await M.prepare({...f,revision:2}),{root}=await project(before,after,[change(before,after,'ventas','new')]);
 assert.equal(at(root,M.ROOT+'/accounts/u_v/'+A.hash('client:c2')+'/pagos').totals.rows,0);assert.equal(at(root,M.ROOT+'/accounts/u_unknown'),null);assert.equal(at(root,M.ROOT+'/coverage/all/ventas').records,2);
});
test('a removed or renamed sort key cannot survive in either history or physical-address page',async()=>{
 const f=input();f.records.ventas.s.fecha='2026-10-01';const before=await M.prepare(f);f.records.ventas.s.fecha='2026-11-01';const after=await M.prepare({...f,revision:2}),old=source(before,'ventas','s').row,{root}=await project(before,after,[change(before,after,'ventas','s')]);
 assert.equal(at(root,M.ROOT+'/pages/all/'+old.accountId+'/ventas/'+old.sort),null);assert.equal(at(root,M.ROOT+'/addresses/all/'+old.accountId+'/ventas/'+M.addressId(old)+'/'+old.sort),null);assert.equal(at(root,M.ROOT+'/accounts/all/'+old.accountId+'/ventas').totals.totalCents,10011);
});
test('reader consumes the coordinated delta and rejects a cursor from the previous complete generation',async()=>{
 const Reader=require('../js/core/client-history-reader.v1'),f=input();for(let i=0;i<121;i++)f.records.presupuestos['p'+i]={id:'PP-'+i,clienteFbKey:'c1',total:0.1,fecha:'2026-11-01'};
 const before=await M.prepare(f),root=tree(before.patch),id=A.hash('client:c1');root.sv_client_history_config={schema:1,generation:f.generation,ready:true};
 const c={uid:'u',role:'admin',auth:{uid:'u'},db:{},route:'historialcliente',canReadClients:true,financialHistoryAccess:{ventas:true,pagos:true,presupuestos:true},allowedDomains:M.domains};
 const reader=Reader.create({capture:()=>c,read:async path=>structuredClone(at(root,path)),query:async(path,{after,limit})=>Object.fromEntries(Object.entries(at(root,path)||{}).filter(([key])=>!after||key>after).sort(([a],[b])=>a<b?-1:1).slice(0,limit))});
 const first=await reader.page(id,'presupuestos');assert.equal(first.totalRows,121);
 for(let i=0;i<21;i++)delete f.records.presupuestos['p'+i];const after=await M.prepare({...f,revision:2});await project(before,after,Array.from({length:21},(_,i)=>change(before,after,'presupuestos','p'+i)),root);
 await assert.rejects(reader.page(id,'presupuestos',{cursor:first.cursor,expectedRevision:first.revision}),{code:'SV_PAGE_CHANGED'});
 const fresh=await reader.page(id,'presupuestos'),last=await reader.page(id,'presupuestos',{cursor:fresh.cursor,expectedRevision:fresh.revision});assert.equal(fresh.rows.length,50);assert.equal(last.rows.length,50);assert.equal(last.hasMore,false);assert.equal(last.totalRows,100);assert.equal(last.totals.totalCents,1000);
});
test('confirming a previously unknown stored amount updates its completeness marker and cents together',async()=>{
 const f=input();f.records.presupuestos.unknown={id:'PP-UNKNOWN',clienteFbKey:'c1'};const before=await M.prepare(f);f.records.presupuestos.unknown.totalPresupuesto=42.03;const after=await M.prepare({...f,revision:2}),{root}=await project(before,after,[change(before,after,'presupuestos','unknown')]),summary=at(root,M.ROOT+'/accounts/all/'+A.hash('client:c1')+'/presupuestos').totals;
 assert.equal(summary.unknownAmounts,0);assert.equal(summary.totalCents,4203);assert.equal(summary.rows,1);
});
test('switching from embedded to global payments requires removing the old history row in that same commit',async()=>{
 const f=input();f.records.pagos={};f.records.ventas.s.pagos=[{fecha:'2026-10-01',monto:30}];const before=await M.prepare(f),embedded=Object.keys(before.patch).find(path=>path.startsWith(M.ROOT+'/sources/pagos/')),embeddedKey=embedded.split('/').at(-1);f.records.pagos.p={ventaFbKey:'s',monto:30,fecha:'2026-10-01'};const after=await M.prepare({...f,revision:2}),parent=change(before,after,'ventas','s'),payment=change(before,after,'pagos','p');
 await assert.rejects(project(before,after,[parent,payment]),/vínculo/);const {root}=await project(before,after,[parent,payment,change(before,after,'pagos',embeddedKey)]),summary=at(root,M.ROOT+'/accounts/all/'+A.hash('client:c1')+'/pagos').totals;
 assert.equal(summary.rows,1);assert.equal(summary.receivedCents,3000);assert.equal(at(root,M.ROOT+'/sources/pagos/'+embeddedKey),null);assert.equal(at(root,M.ROOT+'/coverage/all/pagos').originalRecords,1);
});
