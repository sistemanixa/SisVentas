'use strict';
const {test}=require('node:test'),a=require('node:assert/strict');
const {fixture}=require('./helpers/commercial-ownership-fixtures.cjs'),Index=require('../cotizador/payment-membership-index'),{createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),{create}=require('../cotizador/commercial-sale-payments');
async function setup(payments={p:{ventaFbKey:'one',monto:40,fecha:'2026-11-25',medio:'Efectivo'}}){
 const f=fixture(),root=f.db.root;root.sisventas.pagos=structuredClone(payments);root.sisventas.ventas.one.responsableUid='a';root.sisventas.ventas.one.totalPagado=40;root.sisventas.ventas.one.pagos=[];
 const put=(path,value)=>{const parts=path.split('/');let target=root;for(const k of parts.slice(0,-1))target=target[k]??={};target[parts.at(-1)]=structuredClone(value);};
 for(const [path,value]of Object.entries(Index.buildIndex(payments,{generation:'history-fixture',ready:true}).patch))put(path,value);
 const calls=[],control={hook:null,deny:null},get=p=>p.split('/').reduce((v,k)=>v?.[k],root)??null;
 const store=createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=fictitious-history',accessToken:async()=>'FIXTURE_ONLY',fetchImpl:async(url,options)=>{
  a.equal(options.method,'GET','Read-only module must never write');const u=new URL(url),path=decodeURIComponent(u.pathname).slice(1,-5),override=JSON.parse(u.searchParams.get('auth_variable_override')||'null');calls.push({path,override});
  if(override){a.equal(override.uid,'a');a.equal(override.token.uid,'a');if(path.startsWith('sisventas/ventas/')){const visible=await f.api.visibleRecordsByIds(await f.auth('a'),'ventas',[path.split('/').at(-1)]);if(!visible[path.split('/').at(-1)])return {ok:false,status:403,json:async()=>({})};}
   // This is the local REST transport denial boundary, not a Rules certificate.
   if(control.deny===path)return {ok:false,status:403,json:async()=>({})};
  }
  const value=structuredClone(get(path));await control.hook?.({path,override,calls});return {ok:true,status:200,json:async()=>value};
 }});
 const actor=await f.auth('a'),req={headers:{authorization:'Bearer a'}},service=create({ownership:f.api,store});
 return {...f,root,calls,control,put,actor,req,store,load:()=>service.load({req,actor,saleKey:'one',record:structuredClone(root.sisventas.ventas.one)}),service};
}
test('global source restores history despite empty embedded data, strips attachments, preserves non-enumerable claims and writes nothing',async()=>{
 const f=await setup({p:{id:'P-1',ventaFbKey:'one',monto:40,fecha:123,medio:'Efectivo',obs:'Nota',comprobante:{data:'PRIVATE_BINARY'},otraVentaPrecio:999}}),before=structuredClone(f.root);
 a.equal(Object.keys(f.actor).includes('claims'),false);const result=await f.load();a.equal(result.paymentHistory.source,'global');a.equal(result.paymentHistory.paidAmount,40);a.deepEqual(result.paymentHistory.payments,[{fbKey:'p',id:'P-1',monto:40,fecha:123,medio:'Efectivo',nota:'Nota',hasReceipt:true}]);a.deepEqual(f.root,before);a(f.calls.some(c=>c.override&&c.path==='sisventas/pagos/p'));a(f.calls.every(c=>c.path!=='sisventas/pagos'));
});
test('global payments win over embedded duplicates and annulled globals never resurrect embedded',async()=>{const f=await setup({p:{ventaFbKey:'one',monto:40,anulado:true,estado:'anulado'}});f.root.sisventas.ventas.one.pagos=[{monto:40}];const r=(await f.load()).paymentHistory;a.equal(r.source,'global');a.equal(r.paidAmount,0);a.equal(r.payments.length,1);a.equal(r.payments[0].anulado,true);});
test('an active global payment is counted once despite a duplicate embedded receipt',async()=>{const f=await setup();f.root.sisventas.ventas.one.pagos=[{id:'p',monto:40}];const h=(await f.load()).paymentHistory;a.equal(h.paidAmount,40);a.equal(h.payments.length,1);a.equal(h.source,'global');});
test('embedded legitimate fallback and legacy total produce no invented payment',async()=>{const f=await setup({});f.root.sisventas.ventas.one.pagos=[{monto:20,medio:'Efectivo'},{monto:10,anulado:true}];let h=(await f.load()).paymentHistory;a.equal(h.source,'embedded');a.equal(h.paidAmount,20);f.root.sisventas.ventas.one.pagos=[];h=(await f.load()).paymentHistory;a.equal(h.source,'legacy');a.equal(h.paidAmount,40);a.deepEqual(h.payments,[]);});
test('missing indexed source fails instead of returning an empty successful history',async()=>{const f=await setup();delete f.root.sisventas.pagos.p;await a.rejects(f.load(),/referencia ausente/);});
test('source mutation during the snapshot fails closed',async()=>{const f=await setup();let changed=false;f.control.hook=({path,override})=>{if(!changed&&override&&path==='sisventas/pagos/p'){changed=true;f.root.sisventas.pagos.p.monto=41;}};await a.rejects(f.load(),/fuente del cobro cambió/);});
test('coverage mutation during reads fails closed',async()=>{const f=await setup();f.control.hook=({path,override})=>{if(override&&path==='sisventas/pagos/p')f.put(Index.COVERAGE_PATH,Index.buildIndex(f.root.sisventas.pagos,{generation:'history-new-generation',ready:true}).coverage);};await a.rejects(f.load(),/cobros cambiaron/);});
test('owner change during reads does not return another user sale',async()=>{const f=await setup();f.control.hook=({path,override})=>{if(override&&path==='sisventas/pagos/p')f.root.sisventas.ventas.one.responsableUid='b';};await a.rejects(f.load());});
test('fresh role and permission digest changes reject the old actor',async()=>{for(const kind of ['role','permission']){const f=await setup();f.control.hook=({path,override})=>{if(override&&path==='sisventas/pagos/p'){if(kind==='role')f.root.sv_chat_roles.a.activo=false;else f.root.sv_permisos.vendedor.indiceRevision=99;}};await a.rejects(f.load());}});
test('changed session and view-as are denied',async()=>{const f=await setup();f.req.headers.authorization='Bearer b';await a.rejects(f.load());const viewed=await f.auth('admin','ventas','a');await a.rejects(f.service.load({req:f.req,actor:viewed,saleKey:'one',record:f.root.sisventas.ventas.one}),e=>e.statusCode===403);});
test('payment user-read denial remains fail closed without a service-read fallback',async()=>{const f=await setup();f.control.deny='sisventas/pagos/p';await a.rejects(f.load());a.equal(f.calls.filter(c=>c.path==='sisventas/pagos/p'&&!c.override).length,0);});
test('alias candidate of another sale is not disclosed and indexed collision denial is retained',async()=>{const f=await setup({p:{ventaId:'V-FICTICIA-999',monto:70}});const r=await f.load();a.equal(r.paymentHistory.source,'legacy');a.deepEqual(r.paymentHistory.payments,[]);const other=await f.auth('b');await a.rejects(f.service.load({req:{headers:{authorization:'Bearer b'}},actor:other,saleKey:'one',record:f.root.sisventas.ventas.one}));});
test('a numeric-alias collision never bypasses the payment source user-read denial',async()=>{const f=await setup({p:{ventaId:'OT-001',monto:70}});f.root.sisventas.ventas.one.id='V-001';f.control.deny='sisventas/pagos/p';await a.rejects(f.load());a(f.calls.some(c=>c.path==='sisventas/pagos/p'&&c.override));});
test('malformed or negative payment amounts fail instead of becoming zero',async()=>{for(const monto of [false,' ', '40invalid',-1]){const f=await setup({p:{ventaFbKey:'one',monto}});await a.rejects(f.load());}});
test('shared account receipt requires its original group and exposes only a boolean, including annulled globals',async()=>{
 for(const [extra,expected]of [[{comprobanteCuenta:true,grupoPago:'group-fixture'},true],[{comprobanteCuenta:true,pagoCuentaGrupo:'account-fixture'},true],[{comprobanteCuenta:true},false],[{comprobanteCuenta:true,grupoPago:null,pagoCuentaGrupo:null},false],[{comprobanteCuenta:null,grupoPago:'group-fixture'},false]]){
  const f=await setup({p:{ventaFbKey:'one',monto:40,anulado:true,...extra}});f.root.sisventas.ventas.one.pagos=[{monto:40}];const before=structuredClone(f.root),h=(await f.load()).paymentHistory;
  a.equal(h.source,'global');a.equal(h.paidAmount,0);a.equal(h.payments.length,1);a.equal(h.payments[0].hasReceipt,expected);a.equal(h.payments[0].anulado,true);
  for(const key of ['comprobanteCuenta','grupoPago','pagoCuentaGrupo'])a.equal(Object.hasOwn(h.payments[0],key),false);a.deepEqual(f.root,before);
 }
});


test('one-payment history has bounded reads, concurrent independent checks and one final reauthentication',async()=>{
 const f=await setup(),before=structuredClone(f.root);let authorized=0,finished=false;const original=f.api.authorize;
 f.api.authorize=async(...args)=>{if(args[0]===f.req)authorized++;return original(...args);};
 const stages=new Map();let active=0,maxConcurrent=0;
 f.control.hook=async({path,override})=>{const key=(override?'user:':'service:')+path;stages.set(key,(stages.get(key)||0)+1);active++;maxConcurrent=Math.max(maxConcurrent,active);await new Promise(resolve=>setImmediate(resolve));active--;};
 const result=await f.load();finished=true;a.equal(result.paymentHistory.paidAmount,40);a.equal(authorized,1,'initial route authorization is supplied; final authorization must be fresh exactly once');
 a.equal(f.calls.length,12);a.equal(stages.get('service:'+Index.COVERAGE_PATH),2,'initial and final coverage, no redundant middle read');a(maxConcurrent>=2);a(maxConcurrent<=6);a.equal(active,0);a.deepEqual(f.root,before);
 const count=f.calls.length;await new Promise(resolve=>setImmediate(resolve));a.equal(f.calls.length,count,'no idle polling');a.equal(finished,true);
});

test('role revoked during the last user-source check is rejected by final authorization',async()=>{
 const f=await setup();let n=0;f.control.hook=({path,override})=>{if(override&&path==='sisventas/pagos/p'&&++n===2)f.root.sv_chat_roles.a.activo=false;};
 await a.rejects(f.load(),e=>e.statusCode===403);a.equal(n,2);
});

test('final coverage and final sale checks still reject changes after source rereads',async()=>{
 for(const target of ['coverage','sale']){const f=await setup(),original=f.api.visibleRecordsByIds;
 f.api.visibleRecordsByIds=async(...args)=>{if(target==='coverage')f.put(Index.COVERAGE_PATH,Index.buildIndex(f.root.sisventas.pagos,{generation:'changed-late',ready:true}).coverage);else f.root.sisventas.ventas.one.totalPagado=41;return original(...args);};
 await a.rejects(f.load(),/cambi/);}
});

test('performance report contains only bounded numeric timings and cannot change a read result',async()=>{const f=await setup(),before=structuredClone(f.root),reports=[];const service=create({ownership:f.api,store:f.store,observe:r=>{reports.push(r);throw Error('observer failure');}});const result=await service.load({req:f.req,actor:f.actor,saleKey:'one',record:structuredClone(f.root.sisventas.ventas.one)});a.equal(result.paymentHistory.paidAmount,40);a.equal(reports.length,1);const report=reports[0];a.equal(report.event,'sale_payment_history_performance');for(const [key,value]of Object.entries(report))if(key!=='event'){a(key.endsWith('Ms'));a(Number.isFinite(value)&&value>=0);}a.deepEqual(f.root,before);a.equal(f.calls.length,12);});
