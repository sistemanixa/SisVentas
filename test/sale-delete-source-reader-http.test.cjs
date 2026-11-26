'use strict';
// Native Auth/gateway/Guard/Store/Live financial provider. Only the five-root
// RTDB HTTP transport is replaced with a deterministic ETag-capable fixture.
const {test}=require('node:test'),a=require('node:assert/strict'),path=require('node:path'),{createRequire}=require('node:module');
const sourceRoot=path.resolve(process.env.SV_SALE_DELETE_READER_SOURCE_ROOT||path.join(__dirname,'..'));
const at=createRequire(path.join(sourceRoot,'cotizador/index.js')),{create}=at('../test/helpers/sale-delete-native-http-lab.cjs');
const roots=['sisventas/ventas','sisventas/gastos','sisventas/ctaemp','sisventas/comisiones_generacion','sv_commission_generation'];
async function fixture({etags=true}={}){
 const f=await create({sourceRoot,mode:'live-originals'}),events=[],counts=new Map();let disposed=0,created=0;
 f.runtime.store.createSaleDeleteSourceReader=()=>{created++;const reader=at('./sale-delete-source-reader').create({databaseURL:'http://127.0.0.1:1/?ns=demo-sale-delete-native-http-lab',accessToken:async()=> 'FICTITIOUS_SOURCE_ONLY',fetchImpl:async(target,options)=>{
  const url=new URL(target),p=url.pathname.slice(1,-5);a(roots.includes(p));a.equal(url.search,'?ns=demo-sale-delete-native-http-lab');a.equal(options.method,'GET');a.equal(options.headers['X-Firebase-ETag'],'true');a.equal(disposed,0,'reader must survive the final checks');
  counts.set(p,(counts.get(p)||0)+1);await f.control.beforeSourceRead?.(p,counts.get(p));
  const value=f.get(p),tag='"'+at('./labor-guard').digest(value)+'"',status=etags&&options.headers['If-None-Match']===tag?304:200;
  events.push({path:p,status,conditional:options.headers['If-None-Match'],bytes:status===304?0:Buffer.byteLength(JSON.stringify(value))});
  return status===304?new Response(null,{status,headers:{etag:tag}}):new Response(JSON.stringify(value),{headers:etags?{etag:tag}:{}});
 }});return{read:p=>reader.read(p),dispose:()=>{disposed++;reader.dispose();}};};
 return{...f,events,counts,lifecycle:()=>({created,disposed})};
}
test('native HTTP Live reader performs one real GET/root/phase, 5 conditional 304s, one PATCH and survives lost ACK',async()=>{
 const f=await fixture();try{const idle=f.metrics();await new Promise(resolve=>setImmediate(resolve));a.deepEqual(f.metrics(),idle);const body=f.body();f.control.loseAck=true;a.equal((await f.request(body)).status,503);a.equal(f.commits.length,1);a.equal(f.events.length,10);a.deepEqual(f.events.map(e=>e.status),[200,200,200,200,200,304,304,304,304,304]);for(const root of roots)a.equal(f.counts.get(root),2);a.deepEqual(f.lifecycle(),{created:1,disposed:1});a.equal((await f.request(body)).status,200);a.equal(f.commits.length,1);a.equal(f.events.length,10);a.deepEqual(f.lifecycle(),{created:1,disposed:1});a.equal(f.get('sv_labor_guard'),null);a.equal(f.get('sv_client_history'),null);a.equal(f.get('sv_sale_financial_dependencies'),null);
  console.log('SALE_DELETE_REQUEST_READER '+JSON.stringify({sourceGets:f.events.length,status200:5,status304:5,responseBytes:f.events.reduce((s,e)=>s+e.bytes,0),commits:f.commits.length,idleReadDelta:0}));
 }finally{await f.close();}
});
test('changed source ETag returns 200 and the native second snapshot vetoes with 409 and zero PATCH',async()=>{
 const f=await fixture();try{const original=f.get('sisventas/ventas/sale');f.control.beforeSourceRead=(p,n)=>{if(p==='sisventas/ventas'&&n===2)f.set('sisventas/ventas/other',{id:'V-FICTITIOUS-OTHER',total:5,items:[]});};const result=await f.request(f.body());a.equal(result.status,409,JSON.stringify(result));a.equal(result.body.code,'SV_SALE_DELETE_BLOCKED');a.equal(f.commits.length,0);a.deepEqual(f.get('sisventas/ventas/sale'),original);a.deepEqual(f.events.filter(e=>e.path==='sisventas/ventas').map(e=>e.status),[200,200]);a.deepEqual(f.lifecycle(),{created:1,disposed:1});a.equal(f.get('sv_labor_guard'),null);}finally{await f.close();}
});
test('native no-ETag transport remains fresh with two unconditional GETs per root',async()=>{
 const f=await fixture({etags:false});try{a.equal((await f.request(f.body())).status,200);a.equal(f.commits.length,1);a.equal(f.events.length,10);a(f.events.every(e=>e.status===200&&e.conditional===undefined));for(const root of roots)a.equal(f.counts.get(root),2);a.deepEqual(f.lifecycle(),{created:1,disposed:1});}finally{await f.close();}
});
test('source failure drains parallel workers, disposes, preserves originals and never commits stale values',async()=>{
 const f=await fixture();try{const original=f.get('sisventas');let active=0,finished=0;f.control.beforeSourceRead=async(p,n)=>{if(n!==2)return;active++;try{await new Promise(resolve=>setImmediate(resolve));if(p==='sisventas/gastos')throw Error('FICTITIOUS_READ_FAILURE');finished++;}finally{active--;}};const r=await f.request(f.body());a.equal(r.status,503);a.equal(r.body.code,'SV_SALE_DELETE_SOURCE_READ');a.equal(f.commits.length,0);a.equal(active,0);a.equal(finished,4);a.deepEqual(f.get('sisventas'),original);a.deepEqual(f.lifecycle(),{created:1,disposed:1});a.equal(f.get('sv_labor_guard'),null);const count=f.events.length;await new Promise(resolve=>setImmediate(resolve));a.equal(f.events.length,count);}finally{await f.close();}
});
