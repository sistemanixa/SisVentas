'use strict';
// Explicit local emulator test. No production endpoints, credentials or records.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),net=require('node:net'),cp=require('node:child_process'),Rule=require('../scripts/lib/office-stock-precondition-rules.cjs');
const BASELINE='C:/SisVentas/tmp/runtime-6b6276dd/rules-current-20261125.private.json',SHA='5a5f7b34de6cbba2ae54517029de956b6be605e21143fe4a86c131255052e48f',NS='demo-sale-delete-current';let base,java,exited,fd;
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
before(async()=>{assert.equal(process.env.SV_SALE_DELETE_EMULATOR,'1');const out=process.env.SV_SALE_DELETE_OUT;assert(out);fs.mkdirSync(out,{recursive:true});const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));base='http://127.0.0.1:'+port;fd=fs.openSync(out+'/java.private.log','w');java=cp.spawn('C:/SisVentas/tmp/sales-indexed31719/java/jdk-21.0.13+9-jre/bin/java.exe',['-jar','C:/Users/gon_s/.cache/firebase/emulators/firebase-database-emulator-v4.11.2.jar','--host','127.0.0.1','--port',String(port),'--single_project_mode','Error','--export_data_access_logs',out+'/access.private.json'],{windowsHide:true,stdio:['ignore',fd,fd]});exited=new Promise(r=>java.once('exit',r));let ready=false;for(let i=0;i<100&&!ready;i++){try{const r=await request();ready=r.ok;await r.body?.cancel();}catch{}if(!ready)await new Promise(r=>setTimeout(r,100));}assert(ready);},{timeout:60000});
after(async()=>{try{if(base&&java?.exitCode===null)await put('',null);}finally{if(java&&java.exitCode===null){java.kill();await exited;}if(fd!==undefined)fs.closeSync(fd);console.log('OWN_SALE_DELETE_EMULATOR_CLEANED_AND_STOPPED');}});
async function install(input){const candidate=Rule.prepare(input),r=await request('.settings/rules','PUT',candidate.rules);assert.equal(r.status,200,'Candidate compiles');await r.body?.cancel();return candidate;}
const ROOT=process.env.SV_SALE_DELETE_SOURCE||'C:/SisVentas/tmp/finish-rules-20261125/sale-delete-71f7',load=p=>require(ROOT+'/'+p),Builder=require('../scripts/lib/sale-delete-current-rules.cjs');
let f,capture,commandBody;
test('full HTTP genuine delete capture commits complete native cascade and replays one receipt, preserving unrelated originals',async()=>{
 const candidate=Builder.prepare(fs.readFileSync(BASELINE),{expectedBaselineSha256:SHA});
 const compiled=await request('.settings/rules','PUT',candidate.rules);assert.equal(compiled.status,200);await compiled.body?.cancel();
 f=await load('test/helpers/sale-delete-native-http-lab.cjs').create({sourceRoot:ROOT});commandBody=f.body();
 const sdkActor=await f.gateway.authorize({method:'POST',headers:{authorization:'Bearer FICTITIOUS_DELETE_LAB'}});await f.runtime.store.readAsUser('sisventas/ventas/sale',sdkActor);
 const preserved=Object.fromEntries(['sisventas/stock','sisventas/comisiones','sisventas/comprobantesVenta'].map(k=>[k,f.get(k)])),beforeBudget=f.get('sisventas/presupuestos/budget');
 const reply=await f.request(commandBody);assert.equal(reply.status,200,JSON.stringify(reply));assert.equal(f.commits.length,1);capture=f.commits[0];
 assert.equal(capture.override.token.svFinancialAction,'ventas.eliminar');for(const family of ['SaleFinancial','ClientAccounts','ClientHistory'])assert.equal(capture.override.token['sv'+family+'WriterVersion'],1);
 assert.equal(capture.patch.sv_labor_guard,null);assert(capture.patch['sv_labor_receipts/'+commandBody.id]);
 fs.writeFileSync(process.env.SV_SALE_DELETE_OUT+'/capture.private.json',JSON.stringify({candidate:candidate.rules,capture}));
 await put('',capture.before);const nativeBefore=Object.fromEntries(await Promise.all(Object.keys(preserved).map(async k=>[k,await read(k)])));
 const result=await nativeMerge(capture.patch,capture.override.uid,capture.override.token);assert.equal(result.status,200,JSON.stringify(result));
 for(const k of ['sisventas/ventas/sale','sisventas/pagos/payment','sisventas/ordenes_trabajo/ot','sv_commercial_pages/v1/records/sales/sale'])assert.equal(await read(k),null,k);
 assert.equal(await read('sisventas/presupuestos/budget/estado'),'anulado');assert.deepEqual(await read('sisventas/presupuestos/budget/items'),beforeBudget.items);
 for(const[k,v]of Object.entries(nativeBefore))assert.deepEqual(await read(k),v);
 assert.equal(await read('sv_client_accounts/v1/totals/all/balanceCents'),0);assert.equal(await read('sv_client_history/v1/state/records'),1);
 assert.deepEqual(await read('sv_labor_receipts/'+commandBody.id),f.get('sv_labor_receipts/'+commandBody.id));
 assert.equal((await f.request(commandBody)).status,200);assert.equal(f.commits.length,1);
 const replay=await nativeMerge(capture.patch,capture.override.uid,capture.override.token);assert.equal(replay.status,401,'A native committed receipt cannot be written again');
},{timeout:120000});
for(const[name,mutate]of [
 ['role',s=>s.sv_chat_roles.u.rol='administrativo'],
 ['revision',s=>s.sv_permisos.admin.indiceRevision++],
 ['delete action',s=>s.sv_permisos.admin.acciones.ventas.eliminar=false],
 ['reset',s=>s.sv_access_resets.u={required:true,version:'changed'}]
])test('native current actor precondition rejects late '+name+' with the complete genuine PATCH',async()=>{
 assert(capture);const state=structuredClone(capture.before);mutate(state);await put('',state);const r=await nativeMerge(capture.patch,capture.override.uid,capture.override.token);assert.equal(r.status,401);assert.deepEqual(await read('sisventas/ventas/sale'),capture.before.sisventas.ventas.sale);assert.equal(await read('sv_labor_receipts/'+commandBody.id),null);
});
test('SDK activity phantom is denied during the native delete lease with real captured user-read claims',async()=>{
 assert(capture);await put('',capture.before);const userRead=f.calls.find(c=>c.method==='GET'&&c.override?.uid==='u'&&!c.override.token.svLaborService);assert(userRead,'Actual native Store readAsUser claims required');
 const result=await nativeMerge({'sisventas/agenda/late':{ventaFbKey:'sale',descripcion:'Ficticio'}},userRead.override.uid,userRead.override.token);assert.equal(result.status,401);assert.equal(await read('sisventas/agenda/late'),null);
});
test('standalone H3 original-authorized user gateway write commits native coordinated history without granting generic server authority',async()=>{
 const g=await load('test/helpers/sale-delete-native-http-lab.cjs').create({sourceRoot:ROOT});try{
  const Lists=load('cotizador/record-list-model');for(const domain of Lists.domains)for(const[key,row]of Object.entries(g.get('sisventas/'+domain)||{}))g.set('sisventas/listados_resumen/'+domain+'/'+key,Lists.summary(domain,row));g.set('sv_record_list_config',{schema:1,ready:true});
  const cfg=g.get('sv_permisos/admin');cfg.indiceModulos.soporte=true;g.set('sv_permisos/admin',cfg);
  const actor=await g.gateway.authorize({method:'POST',headers:{authorization:'Bearer FICTITIOUS_DELETE_LAB'}}),record={clienteFbKey:'client',problema:'Prueba ficticia',estado:'abierto'};
  await g.gateway.write(actor,{id:'fiction-h3-native-write',kind:'atomic',path:'',value:{'sisventas/reclamos/standalone':record},expectedHashes:{'sisventas/reclamos/standalone':load('cotizador/labor-guard').digest(null)}});
  assert.equal(g.commits.length,1);const c=g.commits[0];assert.equal(c.override.token.svClientHistoryWriterVersion,1);await put('',c.before);
  fs.writeFileSync(process.env.SV_SALE_DELETE_OUT+'/h3-capture.private.json',JSON.stringify(c));
  const r=await nativeMerge(c.patch,c.override.uid,c.override.token);assert.equal(r.status,200,JSON.stringify(r));assert.equal(await read('sisventas/reclamos/standalone/problema'),'Prueba ficticia');
 }finally{await g.close();}
},{timeout:60000});
after(async()=>{if(f)await f.close();});
