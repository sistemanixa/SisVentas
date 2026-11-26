'use strict';
// Explicit local emulator test. No production endpoints, credentials or records.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),net=require('node:net'),cp=require('node:child_process'),Rule=require('../scripts/lib/office-stock-precondition-rules.cjs');
const BASELINE='C:/SisVentas/tmp/runtime-6b6276dd/rules-current-20261125.private.json',SHA='5a5f7b34de6cbba2ae54517029de956b6be605e21143fe4a86c131255052e48f',NS='demo-sale-delete-reader';let base,java,exited,fd;
async function request(path='',method='GET',value,claims){const u=new URL(base+'/'+path+'.json');u.searchParams.set('ns',NS);const headers={'Content-Type':'application/json'};if(claims){const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);const jwt=enc({alg:'none',typ:'JWT'})+'.'+enc({iss:'https://securetoken.google.com/'+NS,aud:NS,sub:'fictional',user_id:'fictional',iat:now,exp:now+300,firebase:{sign_in_provider:'custom'},...claims})+'.';u.searchParams.set('auth',jwt);}else headers.Authorization='Bearer owner';return fetch(u,{method,headers,...(value!==undefined?{body:JSON.stringify(value)}:{}),signal:AbortSignal.timeout(15000)});}
async function put(path,value){const r=await request(path,'PUT',value);assert.equal(r.status,200);await r.body?.cancel();}
async function read(path){const r=await request(path);assert.equal(r.status,200);return r.json();}
// Long ID JWTs exceed the emulator's HTTP request-line limit. Use its native
// realtime auth+atomic merge protocol, keeping ALL claims and ALL patch paths.
// Never use Bearer here: the emulator treats OAuth bearer as administrative.
async function nativeMerge(patch,uid,claims){
 const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000),jwt=encode({alg:'none',typ:'JWT'})+'.'+encode({iss:'https://securetoken.google.com/'+NS,aud:NS,sub:uid,user_id:uid,iat:now,exp:now+300,firebase:{sign_in_provider:'custom'},...claims})+'.';
 return new Promise((resolve,reject)=>{const socket=new WebSocket(base.replace('http:','ws:')+'/.ws?ns='+NS+'&v=5');let done=false;const timer=setTimeout(()=>finish(null,Error('Local native merge timed out')),20000),finish=(result,error)=>{if(done)return;done=true;clearTimeout(timer);socket.close();if(error)reject(error);else resolve(result);};
  socket.addEventListener('error',()=>finish(null,Error('Local native websocket failed')));
  socket.addEventListener('message',event=>{try{if(event.data==='0')return;const m=JSON.parse(event.data);if(m.t==='c'&&m.d?.t==='h')socket.send(JSON.stringify({t:'d',d:{r:1,a:'auth',b:{cred:jwt}}}));if(m.t==='d'&&m.d?.r===1){if(m.d.b?.s!=='ok')return finish({status:401,message:'auth '+m.d.b?.s});socket.send(JSON.stringify({t:'d',d:{r:2,a:'m',b:{p:'/',d:patch}}}));}if(m.t==='d'&&m.d?.r===2)finish({status:m.d.b?.s==='ok'?200:401,message:m.d.b?.s});}catch(error){finish(null,error);}});
 });
}
before(async()=>{assert.equal(process.env.SV_DELETE_READER_EMULATOR,'1');const out=process.env.SV_DELETE_READER_OUT;assert(out);fs.mkdirSync(out,{recursive:true});const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));base='http://127.0.0.1:'+port;fd=fs.openSync(out+'/java.private.log','w');java=cp.spawn('C:/SisVentas/tmp/sales-indexed31719/java/jdk-21.0.13+9-jre/bin/java.exe',['-jar','C:/Users/gon_s/.cache/firebase/emulators/firebase-database-emulator-v4.11.2.jar','--host','127.0.0.1','--port',String(port),'--single_project_mode','Error','--export_data_access_logs',out+'/access.private.json'],{windowsHide:true,stdio:['ignore',fd,fd]});exited=new Promise(r=>java.once('exit',r));let ready=false;for(let i=0;i<100&&!ready;i++){try{const r=await request();ready=r.ok;await r.body?.cancel();}catch{}if(!ready)await new Promise(r=>setTimeout(r,100));}assert(ready);},{timeout:60000});
after(async()=>{try{if(base&&java?.exitCode===null)await put('',null);}finally{if(java&&java.exitCode===null){java.kill();await exited;}if(fd!==undefined)fs.closeSync(fd);console.log('OWN_DELETE_READER_EMULATOR_CLEANED_AND_STOPPED');}});
async function install(input){const candidate=Rule.prepare(input),r=await request('.settings/rules','PUT',candidate.rules);assert.equal(r.status,200,'Candidate compiles');await r.body?.cancel();return candidate;}
const ROOT=process.env.SV_DELETE_READER_SOURCE||'C:/SisVentas/tmp/finish-rules-20261125/sale-delete-reader-08bba',load=p=>require(ROOT+'/'+p);
test('real RTDB emulator ETag protocol: initial 200, unchanged 304 and changed 200; administrative reads prove protocol only',async()=>{
 const original={fixture:{ventaFbKey:'fiction',monto:7}},calls=[];await put('sisventas/gastos',original);
 const reader=load('cotizador/sale-delete-source-reader').create({databaseURL:base+'/?ns='+NS,accessToken:async()=>'owner',fetchImpl:async(u,o)=>{
  assert.equal(new URL(u).origin,base);assert.equal(o.method,'GET');const r=await fetch(u,o);calls.push({status:r.status,sent:o.headers['If-None-Match'],etag:r.headers.get('etag')});return r;
 }});
 try{
  const first=await reader.read('sisventas/gastos');assert.deepEqual(first,original);first.fixture.monto=999;
  assert.deepEqual(await reader.read('sisventas/gastos'),original);assert.deepEqual(calls.map(c=>c.status),[200,304]);assert.equal(calls[1].sent,calls[0].etag);
  const changed={fixture:{ventaFbKey:'fiction',monto:8}};await put('sisventas/gastos',changed);assert.deepEqual(await reader.read('sisventas/gastos'),changed);assert.deepEqual(calls.map(c=>c.status),[200,304,200]);assert.notEqual(calls[2].etag,calls[0].etag);
 }finally{reader.dispose();}
},{timeout:30000});
test('one full HTTP LIVE cascade with the final reader and read-only commit guard port retains genuine native PATCH claims and one effect',async()=>{
 const Builder=require('../scripts/lib/sale-delete-live-rules.cjs'),candidate=Builder.prepare(fs.readFileSync(BASELINE),{expectedBaselineSha256:SHA}),compiled=await request('.settings/rules','PUT',candidate.rules);assert.equal(compiled.status,200);await compiled.body?.cancel();
 const f=await load('test/helpers/sale-delete-native-http-lab.cjs').create({sourceRoot:ROOT,mode:'live-originals'});try{
  const body=f.body(),before=Object.fromEntries(['sisventas/stock','sisventas/comisiones','sisventas/comprobantesVenta'].map(p=>[p,f.get(p)]));
  const r=await f.request(body);assert.equal(r.status,200,JSON.stringify(r));assert.equal(f.commits.length,1);const c=f.commits[0];assert.equal(c.override.token.svFinancialAction,'ventas.eliminar');assert.equal(c.override.token.svClientHistoryWriterVersion,0);assert.equal(c.override.token.svSaleFinancialWriterVersion,0);assert.equal(c.override.token.svClientAccountsWriterVersion,1);assert.equal(c.patch.sv_labor_guard,null);
  assert(Object.keys(c.patch).every(p=>!['sv_client_history','sv_client_history_config','sv_sale_financial_dependencies'].some(x=>p===x||p.startsWith(x+'/'))));
  await put('',c.before);const native=await nativeMerge(c.patch,c.override.uid,c.override.token);assert.equal(native.status,200,JSON.stringify(native));
  for(const p of ['sisventas/ventas/sale','sisventas/pagos/payment','sisventas/ordenes_trabajo/ot'])assert.equal(await read(p),null);assert.equal(await read('sisventas/presupuestos/budget/estado'),'anulado');
  for(const[p,v]of Object.entries(before))assert.deepEqual(await read(p),v);assert.deepEqual(await read('sv_labor_receipts/'+body.id),f.get('sv_labor_receipts/'+body.id));assert.equal((await f.request(body)).status,200);assert.equal(f.commits.length,1);
 }finally{await f.close();}
},{timeout:120000});
