'use strict';
// Full HTTP/Auth/Gateway/Guard/RESTStore with a genuinely prepared target index.
// Only Auth/RTDB transport is fictitious. This is not a native Rules proof.
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
const {create}=require('./helpers/sale-delete-native-http-lab.cjs');
const sourceRoot=path.resolve(process.env.SV_SALE_DELETE_TARGET_SOURCE_ROOT||path.join(__dirname,'..')),at=createRequire(path.join(sourceRoot,'cotizador/index.js'));
const absent=['sv_client_history','sv_client_history_config','sv_sale_financial_dependencies'];
const target=options=>create({sourceRoot,mode:'targeted',...options});
const pointReads=f=>f.calls.filter(c=>c.method==='GET');
function assertPointBounded(f){const roots=new Set(f.TargetIndex.roots);a.equal(pointReads(f).filter(c=>roots.has(c.path)).length,0,'No complete original collection is read by a delete');a.equal(pointReads(f).filter(c=>c.query).length,0,'No collection query substitutes the target index');a(pointReads(f).length<=450,'Point reads remain bounded for the three linked records');}

for(const kind of ['revoked','reset','role','permission'])test('targeted authorization rejects '+kind+' before reading business records or index',async()=>{
 const f=await target();try{if(kind==='revoked')f.control.revoked=true;if(kind==='reset')f.set('sv_access_resets/u/required',true);if(kind==='role')f.set('sv_chat_roles/u/activo',false);if(kind==='permission')f.set('sv_permisos/admin/acciones/ventas/eliminar',false);
  const before=f.get('sisventas'),r=await f.request(f.body());a([401,403,409].includes(r.status),JSON.stringify(r));a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas'),before);a.equal(pointReads(f).filter(c=>c.path.startsWith('sisventas/')||c.path.startsWith(f.TargetIndex.ROOT+'/')).length,0);
 }finally{await f.close();}
});

test('targeted cascade reads only the sale and indexed links and maintains index/CC/Pages in its one commit',async()=>{
 const f=await target();try{const before={stock:f.get('sisventas/stock'),commissions:f.get('sisventas/comisiones'),fiscal:f.get('sisventas/comprobantesVenta'),budget:f.get('sisventas/presupuestos/budget')},coverage=f.get(f.TargetIndex.ROOT+'/coverage');
  const idle=f.metrics();await new Promise(setImmediate);a.deepEqual(f.metrics(),idle);const result=await f.request(f.body());a.equal(result.status,200,JSON.stringify(result));a.equal(f.commits.length,1);assertPointBounded(f);
  const commit=f.commits[0];a.equal(commit.override.token.svClientHistoryWriterVersion,0);a.equal(commit.override.token.svSaleFinancialWriterVersion,0);a(Object.keys(commit.patch).some(p=>p.startsWith(f.TargetIndex.ROOT+'/')));a(f.get(f.TargetIndex.ROOT+'/coverage/revision')>coverage.revision);
  for(const p of ['sisventas/ventas/sale','sisventas/pagos/payment','sisventas/ordenes_trabajo/ot']){a.equal(f.get(p),null);a.equal(f.get(f.TargetIndex.recordPath(p)),null);}
  a.equal(f.get('sisventas/presupuestos/budget/estado'),'anulado');a.deepEqual(f.get('sisventas/presupuestos/budget/items'),before.budget.items);a.deepEqual(f.get('sisventas/stock'),before.stock);a.deepEqual(f.get('sisventas/comisiones'),before.commissions);a.deepEqual(f.get('sisventas/comprobantesVenta'),before.fiscal);a.equal(f.get('sv_client_accounts/v1/totals/all/balanceCents'),0);for(const p of absent)a.equal(f.get(p),null);
 }finally{await f.close();}
});

test('unrelated original records and attachments do not change delete read paths or transferred JSON',async()=>{
 const runs=[];for(const extra of [false,true]){const f=await target();try{if(extra){for(let i=0;i<300;i++){f.set('sisventas/ventas/other-'+i,{id:'V-OTHER-'+i,total:11,responsableUid:'u',adjunto:'ficticio'.repeat(500)});f.set('sisventas/gastos/other-'+i,{descripcion:'Gasto operativo ficticio',monto:3,adjunto:'ficticio'.repeat(500)});}await f.prepareTargetIndex();}
   const result=await f.request(f.body());a.equal(result.status,200,JSON.stringify(result));assertPointBounded(f);runs.push({paths:pointReads(f).map(c=>c.path).sort(),bytes:pointReads(f).reduce((sum,c)=>sum+c.responseBytes,0)});
  }finally{await f.close();}}
 a.deepEqual(runs[1].paths,runs[0].paths,'The number and identity of reads depend on the target links, not all sales/expenses');
 // The global technical coverage accumulator/count grows by a few characters;
 // unrelated original bodies/attachments must never be transferred.
 a(Math.abs(runs[1].bytes-runs[0].bytes)<100,'Only small coverage counters may change transferred JSON');
});

test('ordinary gateway writer maintains source, inverse metadata and summaries in the same real Guard commit',async()=>{
 const f=await target();try{const actor=await f.gateway.authorize({method:'POST',url:'/laboral/escritura',headers:{authorization:'Bearer FICTITIOUS_DELETE_LAB'}}),p='sisventas/reclamos/new-claim';
  const result=await f.gateway.write(actor,{id:'targeted-writer-operation',kind:'set',path:p,value:{id:'CLAIM-FICTICIO',ventaFbKey:'sale',descripcion:'Ficticio'}});a.equal(result.committed,true);a.equal(f.commits.length,1);const patch=f.commits[0].patch;
  a(Object.hasOwn(patch,p));a(Object.hasOwn(patch,f.TargetIndex.recordPath(p)));a(Object.hasOwn(patch,f.TargetIndex.ROOT+'/coverage'));a(Object.hasOwn(patch,'sisventas/listados_resumen/reclamos/new-claim'));f.TargetIndex.validateRecord(p,f.get(p),f.get(f.TargetIndex.recordPath(p)));
  const before=f.get('sisventas'),rejected=await f.request(f.body());a.equal(rejected.status,409);a.equal(f.commits.length,1);a.deepEqual(f.get('sisventas'),before);assertPointBounded(f);
 }finally{await f.close();}
});

test('lost delete ACK and same-id replay preserve exactly one atomic effect',async()=>{const f=await target();try{const body=f.body();f.control.loseAck=true;a.equal((await f.request(body)).status,503);a.equal(f.commits.length,1);const result=await f.request(body);a.equal(result.status,200,JSON.stringify(result));a.equal(result.body.operationId,body.id);a.equal(f.commits.length,1);assertPointBounded(f);}finally{await f.close();}});

for(const kind of ['financial','ambiguous','physical','fiscal'])test('targeted command retains '+kind+' veto with zero partial write',async()=>{
 const f=await target();try{
  if(kind==='financial')f.set('sisventas/gastos/commission',{ventaFbKey:'sale',tipoPagable:'comision',monto:7,estado:'aprobado'});
  if(kind==='ambiguous'){f.set('sisventas/ventas/duplicate',{id:'V-LAB-0001',total:7,responsableUid:'u'});f.set('sisventas/pagos/payment',{ventaId:'V-LAB-0001',monto:20});}
  if(kind==='physical')f.set('sisventas/ordenes_trabajo/ot/materiales',[{productoKey:'P',entregada:1}]);
  if(kind==='fiscal')f.set('sisventas/ventas/sale/factura',{cae:'FICTITIOUS-CAE'});
  await f.prepareTargetIndex();const before=f.get('sisventas'),r=await f.request(f.body());a.equal(r.status,409,JSON.stringify(r));a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas'),before);a.equal(f.get('sv_labor_guard'),null);assertPointBounded(f);
 }finally{await f.close();}
});

for(const kind of ['alias','financial','permission'])test('fresh target verification rejects late '+kind+' changes without a partial delete',async()=>{
 const f=await target();try{const sale=f.get('sisventas/ventas/sale');let coverageReads=0,changed=false;
  f.control.beforeRead=async p=>{if(p!==f.TargetIndex.ROOT+'/coverage'||++coverageReads!==3)return;changed=true;
   if(kind==='permission'){f.set('sv_permisos/admin/acciones/ventas/eliminar',false);return;}
   const originalPath=kind==='alias'?'sisventas/ventas/duplicate':'sisventas/gastos/late-commission',after=kind==='alias'?{id:'V-LAB-0001',total:1,responsableUid:'u'}:{ventaFbKey:'sale',tipoPagable:'comision',monto:7};
   const derived=await at('./sale-delete-target-index-delta').delta({changes:[{path:originalPath,before:null,after}],read:async path=>f.get(path)});f.set(originalPath,after);for(const[path,value]of Object.entries(derived))f.set(path,value);
  };
  const r=await f.request(f.body());a.equal(changed,true,'The adversary must run during fresh target verification');a([403,409].includes(r.status),JSON.stringify(r));a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas/ventas/sale'),sale);a.equal(f.get('sv_labor_guard'),null);assertPointBounded(f);
 }finally{await f.close();}
});

test('tampered original or missing target index record never becomes an empty relationship list',async()=>{
 for(const kind of ['source','metadata']){const f=await target();try{if(kind==='source')f.set('sisventas/pagos/payment/monto',21);else f.set(f.TargetIndex.recordPath('sisventas/pagos/payment'),null);const before=f.get('sisventas'),r=await f.request(f.body());a.equal(r.status,409,JSON.stringify(r));a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas'),before);assertPointBounded(f);}finally{await f.close();}}
});
