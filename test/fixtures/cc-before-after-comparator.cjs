'use strict';
// Offline ONLY: actual list service, canonical legacy reconciliation and Accounts
// reader over one deterministic fictional database. No SDK, HTTP or credentials.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const Projection=require('../../cotizador/client-account-projection');
const Reader=require('../../js/core/client-account-reader.v1');
const {createCommercialOwnership}=require('../../cotizador/commercial-ownership');
const {load}=require('../helpers/app-functions.cjs');
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cents=value=>Math.round(value*100),clone=value=>value==null?null:JSON.parse(JSON.stringify(value));
function dataset({customers=225,sales=1200,budgets=64}={}){
 assert(Number.isSafeInteger(customers)&&customers>0&&Number.isSafeInteger(sales)&&sales>=customers&&Number.isSafeInteger(budgets)&&budgets>0);
 const clients={},records={},payments={},quotes={};
 for(let i=0;i<customers;i++)clients['c'+i]={id:'C'+i,nombre:'Persona ficticia '+String(i).padStart(5,'0')};
 for(let i=0;i<budgets;i++)quotes['q'+i]={id:'PP-QA-'+i,responsableUid:'qa',creadorOriginalNombre:'Actor ficticio',audit:[{accion:'Creado',usuario:'Actor ficticio'}]};
 for(let i=0;i<sales;i++){
  const client='c'+i%customers,total=100+i%17;
  const row={id:'V-QA-'+i,clienteFbKey:client,cliente:clients[client].nombre,responsableUid:'qa',fecha:i%4?'2026-11-01':'2020-01-01',total,presupuestoFbKey:'q'+i%budgets,
   items:Array.from({length:12},(_,j)=>({cod:'QA-'+j,desc:'Producto ficticio '+j,qty:1,punit:10,sub:10,costoUnitarioCompra:5})),observaciones:'Información ficticia no requerida por la lista de cuentas.'.repeat(4)};
  if(i%11===0)row.anulada=true;
  if(i%3===0){row.pagos=[{monto:20,fecha:'2026-11-01'}];payments['p'+i]={ventaFbKey:'s'+i,venta:row.id,clienteFbKey:client,cliente:row.cliente,monto:20,fecha:'2026-11-01',anulado:i%7===0};}
  else if(i%3===1)row.pagos=[{monto:30,fecha:'2026-10-01'}];
  else row.totalPagado=40;
  records['s'+i]=row;
 }
 return {clients,sales:records,payments,budgets:quotes};
}
function legacyContext(){
 const c={console,Map,Set,Array,Object,String,Number,Math,JSON,parseFloat,ventaEsSinCargo:()=>false,
  _svCrearIndiceClientes:()=>({}),_svClaveClientePrincipalRegistro:r=>'client:'+r.clienteFbKey,
  _svResolverClienteRegistro:()=>null,clienteRaizRegistro:()=>null,ventaValidaParaMetricas:v=>!v.anulada,
  _svResumenVentaCanonico:()=>null,_svTotalVentaCanonico:v=>Number(v.total)||0};
 c.window=c;
 load(c,['_svTxtClave','_svVentaClaves','_svRegistroPerteneceVenta','_svPagoValido','_svPagosGlobalesRelacionadosVenta','_svAgregarPagoIndice','_svCrearIndicePagosVentas','_svPagosIndiceVenta','_svPagosGlobalesVenta','_svPagosEmbebidosVenta','_svResumenPagoLegacyVenta','_svMontoPagadoVenta','_svPagosCanonicosVenta','_svClavesVentaCuentaCorriente','_svClavesPagoCuentaCorriente','_svClaveUnicaPagoCuentaCorriente','_svConstruirCuentaCorriente']);
 return c;
}
function transport({latencyMs=0}={}){
 const calls=[],waits=[];
 return {calls,waits,async get(path,value,kind='get'){
   const start=performance.now(),waitStart=performance.now();
   if(latencyMs)await new Promise(resolve=>setTimeout(resolve,latencyMs));
   const waitEnd=performance.now();if(latencyMs)waits.push([waitStart,waitEnd]);
   const raw=JSON.stringify(value??null),out=JSON.parse(raw);
   calls.push({path,kind,bytes:Buffer.byteLength(raw),elapsedMs:performance.now()-start});return out;
 }};
}
function unionMs(intervals){let end=-Infinity,total=0;for(const[a,b]of intervals.slice().sort((a,b)=>a[0]-b[0])){total+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}return total;}
function summarizeTiming(start,cpu,io,extra={}){const usage=process.cpuUsage(cpu);return{wallMs:performance.now()-start,processCpuMs:(usage.user+usage.system)/1000,simulatedTransportWaitUnionMs:unionMs(io.waits),requests:io.calls.length,responseJsonBytes:io.calls.reduce((n,r)=>n+r.bytes,0),clientResponseJsonBytes:io.calls.filter(r=>r.kind!=='backend').reduce((n,r)=>n+r.bytes,0),backendResponseJsonBytes:io.calls.filter(r=>r.kind==='backend').reduce((n,r)=>n+r.bytes,0),requestsByKind:Object.fromEntries([...new Set(io.calls.map(r=>r.kind))].map(kind=>[kind,io.calls.filter(r=>r.kind===kind).length])),...extra};}
function canonicalLegacy(map){return Object.entries(map).map(([key,v])=>({id:Projection.hash(key),totalCents:cents(v.total),paidCents:cents(v.cobrado),balanceCents:cents(v.total-v.cobrado)})).sort((a,b)=>a.id.localeCompare(b.id));}
function canonicalRows(rows){return rows.map(({id,totalCents,paidCents,balanceCents})=>({id,totalCents,paidCents,balanceCents})).sort((a,b)=>a.id.localeCompare(b.id));}
async function legacyRun(data,{latencyMs=0}={}){
 const io=transport({latencyMs}),root={sv_usuarios:{qa:{uid:'qa',nombre:'Actor ficticio',rol:'admin',activo:true}},sv_chat_roles:{qa:{rol:'admin',activo:true}},sv_permisos:{admin:{indiceVersion:2,indiceRevision:1,indiceModulos:{venta:true,detalle:true,cuentacorriente:true}}},sisventas:{ventas:data.sales,presupuestos:data.budgets}};
 const db={ref:path=>({get:async()=>{const value=await io.get(path,path.split('/').reduce((v,k)=>v?.[k],root),'backend');return {val:()=>value};}})};
 const service=createCommercialOwnership({auth:{verifyIdToken:async uid=>({uid})},db,enabled:true,listReadConcurrency:16});
 const context=legacyContext(),start=performance.now(),cpu=process.cpuUsage();
 const [sales,clients,payments]=await Promise.all([(async()=>{const actor=await service.authorize({headers:{authorization:'Bearer qa'}},'ventas');return io.get('/comerciales/ventas',await service.list(actor),'frontend');})(),io.get('sisventas/clientes',data.clients,'frontend'),io.get('sisventas/pagos',data.payments,'frontend')]);
 const reconcileStart=performance.now();
 const rows=canonicalLegacy(context._svConstruirCuentaCorriente(Object.entries(sales.records).map(([fbKey,v])=>({...v,fbKey})),Object.entries(payments).map(([fbKey,v])=>({...v,fbKey}))));
 const totals=rows.reduce((a,r)=>({accounts:a.accounts+1,debtors:a.debtors+(r.balanceCents>0?1:0),totalCents:a.totalCents+r.totalCents,paidCents:a.paidCents+r.paidCents,balanceCents:a.balanceCents+r.balanceCents}),{accounts:0,debtors:0,totalCents:0,paidCents:0,balanceCents:0});
 return {rows,totals,metrics:summarizeTiming(start,cpu,io,{reconcileMs:performance.now()-reconcileStart,visibleRows:Math.min(50,rows.length),completeRows:rows.length}),calls:io.calls};
}
async function nativeRun(flat,{latencyMs=0,complete=false}={}){
 const io=transport({latencyMs}),actor={uid:'qa',role:'admin',auth:{uid:'qa'},db:{},route:'cuentacorriente',permissionRevision:1,canReadAccounts:true,online:true};
 // Build the fake indexed store outside measured request time. A real indexed
 // RTDB query does not scan this fixture's entire flattened dictionary in JS.
 const index=new Map();for(const[p,v]of Object.entries(flat)){if(v===null)continue;const cut=p.lastIndexOf('/'),parent=p.slice(0,cut),key=p.slice(cut+1);if(!index.has(parent))index.set(parent,[]);index.get(parent).push([key,v]);}for(const rows of index.values())rows.sort(([a],[b])=>a.localeCompare(b));
 const reader=Reader.create({capture:()=>actor,read:path=>io.get(path,flat[path],'sdk-get'),query:(path,{after,limit})=>{
  const rows=(index.get(path)||[]).filter(([key])=>!after||key>after).slice(0,limit);
  return io.get(path,Object.fromEntries(rows),'sdk-query');
 }});
 const start=performance.now(),cpu=process.cpuUsage();
 const [summary,page]=await Promise.all([reader.totals(),reader.page()]);
 assert.equal(summary.revision,page.revision);assert.equal(summary.generation,page.generation);
 const firstMetrics=summarizeTiming(start,cpu,io,{visibleRows:page.rows.length});
 const rows=[...page.rows];let next=page;
 if(complete)while(next.hasMore){next=await reader.page({cursor:next.cursor,expectedRevision:summary.revision});rows.push(...next.rows);}
 return {rows:canonicalRows(rows),totals:summary.totals,metrics:firstMetrics,allPageRequests:io.calls.length,calls:io.calls,reader,actor};
}
function distribution(rows,key){const sorted=rows.map(r=>r[key]).sort((a,b)=>a-b);return{p50:sorted[Math.floor((sorted.length-1)*.5)],p95:sorted[Math.ceil((sorted.length-1)*.95)]};}
async function compare({customers=225,sales=1200,budgets=64,repetitions=10,latencyMs=2}={}){
 const data=dataset({customers,sales,budgets}),original=hash(data),setup=performance.now();
 const projected=await Projection.build({sales:data.sales,payments:data.payments,customers:{clients:data.clients,index:{},structures:{}},owner:()=> 'qa',generation:'fictional-comparison-v1'});
 const flat={...projected.patch,sv_client_accounts_config:{schema:1,ready:true,generation:'fictional-comparison-v1'}},projectionBuildMs=performance.now()-setup;
 const old=await legacyRun(data),next=await nativeRun(flat,{complete:true});
 assert.deepEqual(next.rows,old.rows,'all account cents must match, not just first 50');
 for(const field of ['accounts','debtors','totalCents','paidCents','balanceCents'])assert.equal(next.totals[field],old.totals[field],field);
 // Warm up both actual code paths; no reuse of an unverified data snapshot.
 await legacyRun(data);await nativeRun(flat);
 const before=[],after=[];
 for(let i=0;i<repetitions;i++){before.push((await legacyRun(data,{latencyMs})).metrics);after.push((await nativeRun(flat,{latencyMs})).metrics);}
 const calls=next.calls.length;await new Promise(resolve=>setImmediate(resolve));assert.equal(next.calls.length,calls,'idle must issue no reads');
 next.actor.canReadAccounts=false;await assert.rejects(next.reader.page());assert.equal(next.calls.length,calls,'revoked access must not read');
 assert.equal(hash(data),original,'business input must remain unchanged');
 const fields=['wallMs','processCpuMs','simulatedTransportWaitUnionMs','responseJsonBytes','clientResponseJsonBytes','backendResponseJsonBytes','requests'];
 return {kind:'offline-fictional-comparison',source:'10aecd47a71954ccffb455c956c011bc90e62325',dataset:{customers,sales,payments:Object.keys(data.payments).length,budgets,itemsPerSale:12,years:['2020','2026'],checksum:original},actor:{role:'admin',scope:'all',permissionRevision:1},repetitions,latencyMs,projectionBuildMs,parity:{allAccountRows:old.rows.length,checksum:hash(old.rows),exactCents:true},before:Object.fromEntries(fields.map(k=>[k,distribution(before,k)])),after:Object.fromEntries(fields.map(k=>[k,distribution(after,k)])),samples:{before,after},limits:['Not a production, browser or DOM benchmark.','Transport wait is simulated per operation; frontend and backend simulated calls both counted in legacy.','Explicit fictional customer IDs use a minimal identity adapter in legacy; ambiguous identity/security is covered separately.','Projection generation excluded from entry timing; writer/maintenance cost not measured.','Node process CPU is separate from wall time but includes decoding/validation/setup in that process.','No claim of billed savings or real network latency.']};
}
module.exports={dataset,compare,legacyRun,nativeRun};
if(require.main===module)compare().then(result=>process.stdout.write(JSON.stringify(result,null,2)+'\n')).catch(error=>{console.error(error.stack);process.exitCode=1;});
