'use strict';
// Explicit local emulator test. No production endpoints, credentials or records.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),net=require('node:net'),cp=require('node:child_process'),Rule=require('../scripts/lib/office-stock-precondition-rules.cjs');
const BASELINE='C:/SisVentas/tmp/runtime-6b6276dd/rules-current-20261125.private.json',SHA='5a5f7b34de6cbba2ae54517029de956b6be605e21143fe4a86c131255052e48f',NS='demo-stock-presence';let base,java,exited,fd;
async function request(path='',method='GET',value,claims){const u=new URL(base+'/'+path+'.json');u.searchParams.set('ns',NS);const headers={'Content-Type':'application/json'};if(claims){const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),now=Math.floor(Date.now()/1000);u.searchParams.set('auth',enc({alg:'none',typ:'JWT'})+'.'+enc({iss:'https://securetoken.google.com/'+NS,aud:NS,sub:'fictional',user_id:'fictional',iat:now,exp:now+300,firebase:{sign_in_provider:'custom'},...claims})+'.');}else headers.Authorization='Bearer owner';return fetch(u,{method,headers,...(value!==undefined?{body:JSON.stringify(value)}:{}),signal:AbortSignal.timeout(15000)});}
async function put(path,value){const r=await request(path,'PUT',value);assert.equal(r.status,200);await r.body?.cancel();}
async function read(path){const r=await request(path);assert.equal(r.status,200);return r.json();}
before(async()=>{assert.equal(process.env.SV_STOCK_PRESENCE_EMULATOR,'1');const out=process.env.SV_STOCK_PRESENCE_OUT;assert(out);fs.mkdirSync(out,{recursive:true});const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));base='http://127.0.0.1:'+port;fd=fs.openSync(out+'/java.private.log','w');java=cp.spawn('C:/SisVentas/tmp/sales-indexed31719/java/jdk-21.0.13+9-jre/bin/java.exe',['-jar','C:/Users/gon_s/.cache/firebase/emulators/firebase-database-emulator-v4.11.2.jar','--host','127.0.0.1','--port',String(port),'--single_project_mode','Error'],{windowsHide:true,stdio:['ignore',fd,fd]});exited=new Promise(r=>java.once('exit',r));let ready=false;for(let i=0;i<100&&!ready;i++){try{const r=await request();ready=r.ok;await r.body?.cancel();}catch{}if(!ready)await new Promise(r=>setTimeout(r,100));}assert(ready);},{timeout:60000});
after(async()=>{try{if(base&&java?.exitCode===null)await put('',null);}finally{if(java&&java.exitCode===null){java.kill();await exited;}if(fd!==undefined)fs.closeSync(fd);console.log('OWN_STOCK_PRESENCE_EMULATOR_CLEANED_AND_STOPPED');}});
async function install(input){const candidate=Rule.prepare(input),r=await request('.settings/rules','PUT',candidate.rules);assert.equal(r.status,200,'Candidate compiles');await r.body?.cancel();return candidate;}
const claims={svOfficeStockVersion:1,svOfficeStockPreconditionVersion:1,svOfficeStockSourcePresent:false,svOfficeStockInventoryKey:'J'};
async function commit(token=claims,general=3){const r=await request('','PATCH',{'sisventas/inventario_operativo/J':{general},'sisventas/receipts/fictitious':{done:true}},token);await r.body?.cancel();return r.status;}
test('current effective baseline compiles with all existing grants narrowed, exact source stays intact',async()=>{const raw=fs.readFileSync(BASELINE);assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),SHA);const input=JSON.parse(raw),candidate=await install(input);assert(candidate.manifest.changed.length>0);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(BASELINE)).digest('hex'),SHA);},{timeout:120000});
for(const level of ['root','collection','wildcard','record'])test('atomic source-presence CAS blocks ancestor/OR bypass: '+level,async()=>{
  const grant='auth != null && (auth.token.svOfficeStockVersion === 1 || auth.token.other === true)',rules={'.read':false,'.write':false,sisventas:{'.write':false,inventario_operativo:{'.write':false,$key:{'.write':grant}},receipts:{'.write':grant}}};
  if(level==='root')rules['.write']=grant;
  if(level==='collection')rules.sisventas['.write']=grant;
  if(level==='wildcard')rules.$domain={'.write':grant};
  await install({rules});
  // The typed source was absent; an independent admin creates the canonical J
  // after the last application read. The native PATCH must not overwrite it.
  await put('',{sisventas:{inventario_operativo:{J:{general:7}}}});
  assert.equal(await commit(),401);assert.equal((await read('sisventas/inventario_operativo/J')).general,7);assert.equal(await read('sisventas/receipts/fictitious'),null);
  await put('',null);assert.equal(await commit(),200);assert.equal((await read('sisventas/inventario_operativo/J')).general,3);
  assert.equal(await commit({...claims,svOfficeStockSourcePresent:true}),200);
  await put('',null);assert.equal(await commit({...claims,svOfficeStockSourcePresent:true}),401);
  assert.equal(await commit({...claims,svOfficeStockSourcePresent:'false'}),401);
  assert.equal(await commit({...claims,svOfficeStockPreconditionVersion:0}),401);
  await put('',null);assert.equal(await commit(claims,0),200);assert.deepEqual(await read('sisventas/inventario_operativo/J'),{general:0});
  // Version0 belongs to existing other writers and keeps their old authority.
  assert.equal(await commit({svOfficeStockVersion:0,other:true}),200);
},{timeout:120000});
