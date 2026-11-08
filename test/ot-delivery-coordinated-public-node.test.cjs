'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{fixture}=require('./helpers/current-ot-delivery-node.cjs');
const {digest}=require('../cotizador/labor-guard'),{createOTLifecycle}=require('../cotizador/ot-lifecycle'),{apply}=require('./helpers/labor-ui-flow.cjs');
for(const coordinated of [false,true])test('public complete delivery with real RecordList/Labor/Guarded adapters, coordinated='+coordinated,async()=>{
 const f=await fixture({coordinated}),before=structuredClone(f.state.sisventas),commits=f.commits.length;
 await f.w.otCustodiaEntregar();
 assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/0/entregada'),3,JSON.stringify(f.notes));
 assert.equal(Object.keys(f.get('sisventas/ordenes_trabajo/ot/remitosEntrega')).length,1);
 assert.deepEqual(f.get('sisventas/inventario_operativo'),before.inventario_operativo);
 for(const domain of ['ventas','pagos','comisiones','gastos','ctaemp','productos','ordenes'])assert.deepEqual(f.get('sisventas/'+domain),before[domain]??null);
 if(coordinated){assert.equal(f.commits.length,commits+1);assert.equal(f.commands.length,1);assert.equal(f.sdkPatches.length,0);}else{assert.equal(f.sdkPatches.length,1);assert.equal(f.commands.length,0);}
});
for(const missing of ['RecordList','Guarded','atomic'])test('missing '+missing+' refuses without an SDK or command fallback',async()=>{
 const f=await fixture(),before=structuredClone(f.state.sisventas);if(missing==='RecordList')delete f.w.SVRecordListWrites;else if(missing==='Guarded')delete f.w.SVGuardedWrites;else delete f.w.SVLaborWrites.atomic;
 await f.w.otCustodiaEntregar();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);assert.equal(f.sdkPatches.length,0);
});
for(const kind of ['cancel','uid','auth','role','revision','materials'])test('confirmation '+kind+' invalidation leaves delivery and financial originals intact',async()=>{
 const f=await fixture(),before=structuredClone(f.state.sisventas);f.w.svConfirm=async()=>{if(kind==='cancel')return false;if(kind==='uid')f.w.currentUserUid='other';if(kind==='auth')f.w.fbAuth.currentUser={uid:'u'};if(kind==='role')f.w.currentRole='tecnico';if(kind==='revision')f.w.PERMISOS_ROLES.admin.indiceRevision++;if(kind==='materials')f.w.otData[0].materiales[0].vendida=4;return true;};
 await f.w.otCustodiaEntregar();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);assert.equal(f.sdkPatches.length,0);
});
test('coordinated transport rejects before commit without partial sources/projections',async()=>{
 const f=await fixture(),before=structuredClone(f.state.sisventas);f.store.commit=async()=>{throw Error('Fictitious rejected PATCH');};await f.w.otCustodiaEntregar();assert.deepEqual(f.state.sisventas,before);assert.equal(f.get('sv_labor_guard'),null);assert.equal(f.commands.length,1);assert.equal(f.sdkPatches.length,0);
});
for(const role of ['tecnico','vendedor'])test('public delivery remains unavailable to '+role+' even with permissive UI flags',async()=>{
 const f=await fixture(),before=structuredClone(f.state.sisventas);f.w.currentRole=role;await f.w.otCustodiaEntregar();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);assert.equal(f.sdkPatches.length,0);
});
test('changed server materials are rejected instead of overwriting the concurrent edit',async()=>{
 const f=await fixture(),commits=f.commits.length;f.w.svConfirm=async()=>{apply(f.state,{'sisventas/ordenes_trabajo/ot/materiales/0/vendida':4});return true;};await f.w.otCustodiaEntregar();assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/0/vendida'),4);assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/0/entregada'),0);assert.equal(f.commits.length,commits);assert.equal(f.sdkPatches.length,0);
});
test('failed coordinated preparation cannot fall back to a raw SDK write',async()=>{
 const f=await fixture(),before=structuredClone(f.state.sisventas);f.w.SVClientAccountHost.prepareWrite=async()=>{throw Error('Fictional permission/context revocation');};await f.w.otCustodiaEntregar();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);assert.equal(f.sdkPatches.length,0);
});
test('prepareOT false with a coordinated host refuses instead of using the captured SDK',async()=>{
 const f=await fixture(),before=structuredClone(f.state.sisventas);f.w.SVLaborWrites.prepareOT=async()=>false;await f.w.otCustodiaEntregar();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);assert.equal(f.sdkPatches.length,0);
});
test('prepareOT rejection cannot use a captured SDK fallback',async()=>{
 const f=await fixture(),before=structuredClone(f.state.sisventas);f.w.SVLaborWrites.prepareOT=async()=>{throw Error('Preparation denied');};await f.w.otCustodiaEntregar();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);assert.equal(f.sdkPatches.length,0);
});
for(const changed of ['uid','revision','mode'])test('changed '+changed+' during preparation prevents every transport write',async()=>{
 const f=await fixture(),before=structuredClone(f.state.sisventas);let calls=0,mode=true;f.w.SVClientAccountHost.coordinated=()=>mode;f.w.SVClientAccountHost.prepareWrite=async()=>{if(++calls===2){if(changed==='uid')f.w.currentUserUid='other';if(changed==='revision')f.w.PERMISOS_ROLES.admin.indiceRevision++;if(changed==='mode')mode=false;}return true;};await f.w.otCustodiaEntregar();assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);assert.equal(f.sdkPatches.length,0);
});
for(const initial of [false,true])for(const prepared of [false,true])test('generic OT records rejects mode '+initial+'→'+!initial+' during prepareOT='+prepared,async()=>{
 const f=await fixture({coordinated:initial}),before=structuredClone(f.state.sisventas);let mode=initial;f.w.SVClientAccountHost.coordinated=()=>mode;f.w.SVLaborWrites.prepareOT=async()=>{mode=!initial;return prepared;};const path='sisventas/ordenes_trabajo/ot';
 await assert.rejects(f.w.SVRecordListWrites.records([path],records=>({[path]:{...records[path],observaciones:'Fictional generic caller'}})),/preparación coordinada|cambió/);assert.deepEqual(f.state.sisventas,before);assert.equal(f.commands.length,0);assert.equal(f.sdkPatches.length,0);
});
test('lost ACK followed by same user intention cannot create a second remito or discount stock',async()=>{
 const f=await fixture(),inventory=f.get('sisventas/inventario_operativo'),commit=f.store.commit;let lost=false;f.store.commit=async(...args)=>{await commit(...args);if(!lost){lost=true;throw Error('Fictitious ACK lost after real mock commit');}};const n=f.commits.length;await f.w.otCustodiaEntregar();await f.w.otCustodiaEntregar();assert.equal(f.commits.length,n+1);assert.equal(Object.keys(f.get('sisventas/ordenes_trabajo/ot/remitosEntrega')).length,1);assert.deepEqual(f.get('sisventas/inventario_operativo'),inventory);
});
test('receipt2of3 → current full delivery3 → atomic install2 → correct1 → receive1 preserves costs, other allocation and financial projections',async()=>{
 const f=await fixture(),before=structuredClone(f.state.sisventas);await f.w.otCustodiaEntregar();assert.equal(f.get('sisventas/ordenes_trabajo/ot/materiales/0/entregada'),3);const receipts=f.get('sisventas/ordenes_trabajo/ot/remitosEntrega');assert.equal(Object.values(receipts)[0].items[0].cantidad,3);
 const api=createOTLifecycle({db:{ref:p=>({get:async()=>({val:()=>f.get(p)})})},store:f.store,guard:f.guard,enabled:true,commercialPages:true,atomicCustody:true}),identity={uid:'u',claims:{uid:'u'}};
 const body=(id,kind,changes,atomic=false)=>({id,kind,otKey:'ot',expectedOTHash:digest(f.get('sisventas/ordenes_trabajo/ot')),changes,action:'Fictional chain',...(atomic?{protocol:'ot-rendition-atomic-v1'}:{})});
 const changes=(installed,pending)=>({materiales:f.get('sisventas/ordenes_trabajo/ot/materiales').map(m=>({...m,instalada:installed,devueltaPendiente:pending,enTecnico:1,danada:0,faltante:0,custodiaClasificada:true,estadoCustodia:'en_tecnico'})),custodiaIniciada:true,custodiaRendida:true});
 const install=body('chain-node-install','custody',changes(2,0),true);await api.executeAtomic(identity,install);const afterInstall=structuredClone(f.state.sisventas),n=f.commits.length;await api.executeAtomic(identity,install);assert.equal(f.commits.length,n);assert.deepEqual(f.state.sisventas,afterInstall);assert.equal(f.get('sisventas/inventario_operativo/p/consumido'),2);
 await api.executeAtomic(identity,body('chain-node-correct','custody',changes(1,1),true));assert.equal(f.get('sisventas/inventario_operativo/p/consumido'),1);assert.equal(f.get('sisventas/inventario_operativo/p/asignaciones/s/reservado'),1);
 const received=body('chain-node-return','return',{});await api.execute(identity,received);const final=structuredClone(f.state.sisventas),commits=f.commits.length;await api.execute(identity,received);assert.equal(f.commits.length,commits);assert.deepEqual(f.state.sisventas,final);
 const m=f.get('sisventas/ordenes_trabajo/ot/materiales/0'),inv=f.get('sisventas/inventario_operativo/p');assert.deepEqual([m.vendida,m.entregada,m.instalada,m.devuelta,m.devueltaPendiente,m.enTecnico],[3,3,1,1,0,1]);assert.equal(inv.general,5);assert.equal(inv.reservado,5);assert.equal(inv.consumido,1);assert.equal(inv.enCompra,1);assert.deepEqual(inv.asignaciones.foreign,before.inventario_operativo.p.asignaciones.foreign);assert.deepEqual(f.get('sisventas/ordenes_trabajo/ot/remitosEntrega'),receipts);
 for(const domain of ['pagos','comisiones','gastos','ctaemp','ordenes'])assert.deepEqual(f.get('sisventas/'+domain),before[domain]??null);for(const [key,value]of Object.entries(before.ventas.s))if(!['estadoInst','audit'].includes(key))assert.deepEqual(f.get('sisventas/ventas/s/'+key),value);
 assert.equal(f.get('sv_commercial_pages/v1/totals/all/debtCents'),26000);assert.equal(f.get('sv_client_accounts/v1/totals/all/balanceCents'),26000);assert.equal(f.get('sv_client_history/v1/sources/ventas/s/row/balanceCents'),26000);assert.equal(f.get('sisventas/listados_resumen/ordenes_trabajo/ot/materiales/0/instalada'),1);assert.equal(f.sdkPatches.length,0);
});
