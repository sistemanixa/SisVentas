'use strict';
// Execute only against the reviewed live-originals API/freeze. No provider stub.
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),{create}=require('./helpers/sale-delete-native-http-lab.cjs');
const sourceRoot=path.resolve(process.env.SV_SALE_DELETE_LIVE_SOURCE_ROOT||path.join(__dirname,'..'));
const absent=['sv_client_history','sv_client_history_config','sv_sale_financial_dependencies'];
const live=options=>create({sourceRoot,mode:'live-originals',...options});
test('lab mode accepts only the two closed literals',async()=>{for(const mode of ['live',true,null,'LIVE-ORIGINALS'])await a.rejects(create({sourceRoot,mode}),/Unknown sale-delete lab mode/);});
test('live originals cascade uses genuine RAM financial semantics with H/Fin absent and no H/Fin writes or claims',async()=>{
 const f=await live();try{for(const p of absent)a.equal(f.get(p),null);a.equal(f.runtime.guard.clientHistory,false);a.equal(f.runtime.guard.saleFinancialDependencies,false);
  const idle=f.metrics();await new Promise(resolve=>setImmediate(resolve));a.deepEqual(f.metrics(),idle);let active=0,maximum=0;f.control.beforeRead=async p=>{if(/^sisventas\/[^/]+$/.test(p)||p==='sv_commission_generation'){maximum=Math.max(maximum,++active);await new Promise(resolve=>setImmediate(resolve));active--;}};
  const before={stock:f.get('sisventas/stock'),commission:f.get('sisventas/comisiones'),fiscal:f.get('sisventas/comprobantesVenta'),budget:f.get('sisventas/presupuestos/budget')};
  const r=await f.request(f.body());a.equal(r.status,200,JSON.stringify(r));a.equal(f.commits.length,1);const captured=f.commits[0];a.equal(captured.override.token.svClientHistoryWriterVersion,0);a.equal(captured.override.token.svSaleFinancialWriterVersion,0);
  a(Object.keys(captured.patch).every(p=>!absent.some(parent=>p===parent||p.startsWith(parent+'/'))));for(const p of absent)a.equal(f.get(p),null);
  for(const p of ['sisventas/ventas/sale','sisventas/pagos/payment','sisventas/ordenes_trabajo/ot'])a.equal(f.get(p),null);a.equal(f.get('sisventas/presupuestos/budget/estado'),'anulado');a.deepEqual(f.get('sisventas/presupuestos/budget/items'),before.budget.items);a.deepEqual(f.get('sisventas/stock'),before.stock);a.deepEqual(f.get('sisventas/comisiones'),before.commission);a.deepEqual(f.get('sisventas/comprobantesVenta'),before.fiscal);a.equal(f.get('sv_client_accounts/v1/totals/all/balanceCents'),0);a.equal(maximum,6);a.equal(active,0);
  // The generic helper classifies only sisventas/* roots as collections. Count
  // this fifth financial original root explicitly, without changing the helper.
  const metrics=f.metrics(),externalOriginalRoots=f.calls.filter(c=>c.method==='GET'&&c.path==='sv_commission_generation').length;
  console.log('SALE_DELETE_LIVE_METRICS '+JSON.stringify({...metrics,externalOriginalRootReads:externalOriginalRoots,allOriginalRootReads:metrics.collectionReads+externalOriginalRoots,pointGetsExcludingOriginalRoots:metrics.pointGets-externalOriginalRoots,maximumCollectionConcurrency:maximum,idleReadDelta:0}));
 }finally{await f.close();}
});
test('live financial commission and unresolved source remain blocking without creating indexes',async()=>{
 for(const expense of [{ventaFbKey:'sale',tipoPagable:'comision',monto:7,estado:'aprobado'},{tipoPagable:'comision',monto:7,estado:'aprobado'}]){const f=await live({input:{gastos:{commission:expense}}});try{const before=f.get('sisventas'),r=await f.request(f.body());a.equal(r.status,409);a.equal(r.body.ok,false);a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas'),before);for(const p of absent)a.equal(f.get(p),null);}finally{await f.close();}}
});
for(const parent of absent)test('live refuses partial namespace at '+parent,async()=>{const f=await live();try{f.set(parent,{partialFixture:true});const before=f.get('sisventas'),r=await f.request(f.body());a([409,503].includes(r.status),JSON.stringify(r));a.equal(r.body.ok,false);a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas'),before);}finally{await f.close();}});
for(const parent of absent)test('namespace appearance after first financial plan vetoes commit at '+parent,async()=>{
 const f=await live();try{const before=f.get('sisventas');let appeared=false;f.control.beforeRead=async p=>{if(!appeared&&p==='sisventas/agenda'){appeared=true;f.set(parent,{partialFixture:true});}};
  const r=await f.request(f.body());a.equal(appeared,true);a([409,503].includes(r.status),JSON.stringify(r));a.equal(r.body.ok,false);a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas'),before);a.equal(f.get('sv_labor_guard'),null);
 }finally{await f.close();}
});
test('late live financial dependency is re-read without installing financial metadata',async()=>{
 const f=await live();try{const sale=f.get('sisventas/ventas/sale');let inserted=false;f.control.beforeRead=async p=>{if(!inserted&&p==='sisventas/agenda'){inserted=true;f.set('sisventas/gastos/late',{ventaFbKey:'sale',tipoPagable:'comision',monto:7,estado:'aprobado'});}};
  const r=await f.request(f.body());a.equal(inserted,true);a.equal(r.status,409);a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas/ventas/sale'),sale);a.equal(f.get('sisventas/gastos/late/monto'),7);for(const p of absent)a.equal(f.get(p),null);
 }finally{await f.close();}
});
test('live ACK recovery returns one persisted effect while H/Fin remain absent',async()=>{const f=await live();try{const body=f.body();f.control.loseAck=true;a.equal((await f.request(body)).status,503);a.equal(f.commits.length,1);const r=await f.request(body);a.equal(r.status,200);a.equal(r.body.operationId,body.id);a.equal(f.commits.length,1);for(const p of absent)a.equal(f.get(p),null);}finally{await f.close();}});
for(const change of ['sale-action','ot-action','sale-module','blocked-value'])test('same-revision permission change at the last Activity root of the fresh plan vetoes '+change,async()=>{
 const f=await live();try{const before=f.get('sisventas'),revision=f.get('sv_permisos/admin/indiceRevision');let passes=0,changed=false;
  f.control.beforeRead=async p=>{if(p==='sisventas/ordenesTrabajo'&&++passes===2){changed=true;
   if(change==='sale-action')f.set('sv_permisos/admin/acciones/ventas/eliminar',false);
   if(change==='ot-action')f.set('sv_permisos/admin/acciones/ot/eliminar',false);
   if(change==='sale-module')f.set('sv_permisos/admin/indiceModulos/venta',false);
   if(change==='blocked-value')f.set('sv_permisos/admin/bloqueados',{arbitraryFixtureKey:'venta'});
  }};
  // Native Guard checks an explicitly disabled sale permission before comparing
  // the complete permission digest. OT-only changes reach that digest check.
  const r=await f.request(f.body());a.equal(changed,true,'The fault must occur during the second complete plan');a.equal(passes,2);a.equal(f.get('sv_permisos/admin/indiceRevision'),revision);a.equal(r.status,change==='ot-action'?409:403,JSON.stringify(r));a.equal(r.body.code,change==='ot-action'?'SV_LABOR_AUTH_CHANGED':'LAB_FAILURE');a.equal(r.body.ok,false);a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas'),before);a.equal(f.get('sv_labor_guard'),null);for(const p of absent)a.equal(f.get(p),null);
 }finally{await f.close();}
});
