'use strict';
// HTTP loopback ficticio; no Firebase, credenciales ni solicitudes remotas.
const http=require('node:http'),vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const baseline='37e1cbab93eb73b429f1997a28544a22436e4a95';
async function measure(source){
 const calls=[];let bytes=0;
 const users=Array.from({length:60},(_,i)=>({fbKey:'fixture-'+i,uid:'fixture-'+i,nombre:'Persona ficticia '+i,rol:'tecnico'}));
 const server=http.createServer((req,res)=>{
  assert.equal(req.headers.authorization,'Bearer FIXTURE_ONLY');
  assert.ok(['/usuarios/directorio','/usuarios/administracion'].includes(req.url));calls.push(req.url);
  const admin=req.url.endsWith('/administracion'),body=JSON.stringify({ok:true,users:users.map(u=>admin?{...u,mail:u.uid+'@example.test'}:u)});
  bytes+=Buffer.byteLength(body);setTimeout(()=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(body);},15);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const events=new EventTarget(),root={SV_USER_DIRECTORY_V2:true,fbAuth:{currentUser:{uid:'fixture-0',getIdToken:async()=> 'FIXTURE_ONLY'}},currentUserUid:'fixture-0',currentRole:'admin',SISVENTAS_FUNCTIONS:{cotizadorProveedor:'http://127.0.0.1:'+server.address().port}};
  vm.runInNewContext(source,{window:root,document:events,fetch,AbortSignal,console});
  const start=performance.now();let delivered;
  const ready=new Promise(resolve=>{delivered=resolve;});
  const stop=root.SVUserDirectory.onValue(s=>delivered(s));
  const results=await Promise.all([ready,root.SVUserDirectory.read(),root.SVUserDirectory.read(),root.SVUserDirectory.adminProfile('fixture-0'),root.SVUserDirectory.adminProfile('fixture-1')]);
  assert.equal(Object.keys(results[0].val()).length,60);assert.equal(results[1].val()['fixture-0'].mail,undefined);
  assert.equal(results[3].mail,'fixture-0@example.test');
  const elapsedMs=Number((performance.now()-start).toFixed(2)),count=calls.length;
  await new Promise(resolve=>setTimeout(resolve,40));assert.equal(calls.length,count);
  stop();root.SVUserDirectory.stop();
  return {calls:count,responseBodyBytes:bytes,elapsedMs,idleWindowMs:40,idleExtraCalls:calls.length-count,paths:calls};
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
(async()=>{
 const before=await measure(execFileSync('git',['show',baseline+':js/core/user-directory.js'],{encoding:'utf8'}));
 const after=await measure(fs.readFileSync('js/core/user-directory.js','utf8'));
 assert.equal(before.calls,5);assert.equal(after.calls,2);assert.ok(after.responseBodyBytes<before.responseBodyBytes);
 console.log(JSON.stringify({baseline,before,after,limits:'Loopback ficticio, demora configurada 15ms; bytes JSON sin cabeceras; no mide producción ni RTDB.'},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
