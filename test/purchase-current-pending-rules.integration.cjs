'use strict';
// Explicit local emulator test. No production endpoints, credentials or records.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),net=require('node:net'),cp=require('node:child_process'),Rule=require('../scripts/lib/office-stock-precondition-rules.cjs');
const BASELINE='C:/SisVentas/tmp/runtime-6b6276dd/rules-current-20261125.private.json',SHA='5a5f7b34de6cbba2ae54517029de956b6be605e21143fe4a86c131255052e48f',NS='demo-stock-presence';let base,java,exited,fd;
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
before(async()=>{assert.equal(process.env.SV_STOCK_PRESENCE_EMULATOR,'1');const out=process.env.SV_STOCK_PRESENCE_OUT;assert(out);fs.mkdirSync(out,{recursive:true});const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));base='http://127.0.0.1:'+port;fd=fs.openSync(out+'/java.private.log','w');java=cp.spawn('C:/SisVentas/tmp/sales-indexed31719/java/jdk-21.0.13+9-jre/bin/java.exe',['-jar','C:/Users/gon_s/.cache/firebase/emulators/firebase-database-emulator-v4.11.2.jar','--host','127.0.0.1','--port',String(port),'--single_project_mode','Error','--export_data_access_logs',out+'/access.private.json'],{windowsHide:true,stdio:['ignore',fd,fd]});exited=new Promise(r=>java.once('exit',r));let ready=false;for(let i=0;i<100&&!ready;i++){try{const r=await request();ready=r.ok;await r.body?.cancel();}catch{}if(!ready)await new Promise(r=>setTimeout(r,100));}assert(ready);},{timeout:60000});
after(async()=>{try{if(base&&java?.exitCode===null)await put('',null);}finally{if(java&&java.exitCode===null){java.kill();await exited;}if(fd!==undefined)fs.closeSync(fd);console.log('OWN_STOCK_PRESENCE_EMULATOR_CLEANED_AND_STOPPED');}});
async function install(input){const candidate=Rule.prepare(input),r=await request('.settings/rules','PUT',candidate.rules);assert.equal(r.status,200,'Candidate compiles');await r.body?.cancel();return candidate;}
const ROOT=process.env.SV_CURRENT_PENDING_SOURCE||'C:/SisVentas/tmp/finish-rules-20261125/current-pending-source',load=p=>require(ROOT+'/'+p),FROZEN='531ac358bfa88b5d53598092f45ce7c48fe9f95b';
const ORDER={estado:'recepcion_parcial',origen:'manual',numero:'FICTION',proveedorKey:'provider',proveedor:'Proveedor ficticio',moneda:'ARS',items:[{productoKey:'product',cantidadOrdenada:3,cantidadRecibida:1,cantidadCostoReal:1,costoRealAcumulado:3.125,costoUnitario:4.125,precioPublico:9.987654}],total:12.375,monto:12.375,pagos:{historical:{keep:true}},audit:[{historical:true}],unknown:{preserve:true}};
let f,command,body,options,commits=[],patches=[];
test('frozen package: genuine current-pending command and complete native atomic PATCH',async()=>{
 const tracked=cp.execFileSync('git',['show',FROZEN+':cotizador/purchase-current-pending-command.js'],{encoding:'buffer'});assert.equal(fs.readFileSync(ROOT+'/cotizador/purchase-current-pending-command.js','utf8').replace(/\r\n/g,'\n'),tracked.toString('utf8').replace(/\r\n/g,'\n'));
 f=await load('test/helpers/inventory-native-application-fixture.cjs').create({sourceRoot:ROOT,uiRoot:ROOT,baselineRulesPath:BASELINE,baselineDigest:SHA,sourceSeed:{sisventas:{ordenes:{classic:ORDER},inventario_operativo:{legacy:{enCompra:2}}}}});
 const {digest}=load('cotizador/labor-guard'),candidate=load('scripts/lib/inventory-current-rules.cjs').prepare(fs.readFileSync(BASELINE),{activationPins:Object.fromEntries(['schema','generation','baselineDigest','contractDigest','codePins','indexQueryCoverageVersion'].map(k=>[k,f.document[k]]))});
 assert.equal(crypto.createHash('sha256').update(JSON.stringify(candidate.rules)).digest('hex'),f.document.rulesDigest);
 const compiled=await request('.settings/rules','PUT',candidate.rules);assert.equal(compiled.status,200);await compiled.body?.cancel();
 const tops=['sisventas','sv_labor_config','sv_labor_guard','sv_labor_receipts','sv_chat_roles','sv_permisos','sv_access_resets','sv_stock_reference_config','sv_office_stock_order_config','sv_office_stock_order_fence','sv_office_stock_order','sv_purchase_numbering','sv_operational_read_config'];
 const store=load('cotizador/labor-rtdb-store').createLaborRtdbStore({databaseURL:'http://127.0.0.1:1/?ns=fiction-only',accessToken:async()=>'FIXTURE_ONLY',now:()=>f.now,fetchImpl:async(url,options)=>{
  const u=new URL(url);assert.equal(u.origin,'http://127.0.0.1:1');const p=decodeURIComponent(u.pathname).slice(1,-5);let value=null;
  if(options.method==='GET'){assert(p);value=f.get(p);if(u.searchParams.has('orderBy'))value=load('test/helpers/stock-reference-query-fixture.cjs').queryRows(value,Object.fromEntries([...u.searchParams].filter(([k])=>!['ns','auth_variable_override'].includes(k)).map(([k,v])=>[k,JSON.parse(v)])));}
  else if(options.method==='PATCH'){const patch=JSON.parse(options.body),override=JSON.parse(u.searchParams.get('auth_variable_override'));commits.push({patch,override,state:Object.fromEntries(tops.map(k=>[k,f.get(k)]))});patches.push(patch);for(const[k,v]of Object.entries(patch))f.set(k,v);}
  else if(options.method==='PUT')f.set(p,JSON.parse(options.body));else if(options.method==='DELETE')f.set(p,null);else assert.fail(options.method);
  return{ok:true,status:200,body:{cancel:async()=>{}},json:async()=>structuredClone(value)};
 }});
 const guard=load('cotizador/labor-guard').createLaborGuard({store,now:()=>f.now,operationalSummaries:true,delay:async()=>{}});
 options={enabled:true,authorize:async()=>f.identity,store,guard,mappedAdmission:f.cohort.mappedAdmission,queryPage:store.queryPage,now:()=>f.now,assertAdmission:f.cohort.assertAdmission};command=load('cotizador/purchase-current-pending-command').create(options);
 body={id:'fiction-current-pending-native',orderKey:'classic',expectedHash:digest(ORDER)};
 const preserved=Object.fromEntries(['sisventas/inventario_operativo','sisventas/ventas','sisventas/listas_materiales','sv_purchase_numbering'].map(k=>[k,f.get(k)]));
 const ack=await command.execute({},body);assert.equal(commits.length,1);assert.equal(ack.reconciliation,'current-pending');
 const c=commits[0];for(const family of ['PurchaseSourceCost','OfficeStock','OfficeStockOrder','StockLink','PurchaseNumbering'])assert.equal(c.override.token['sv'+family+'Version']??0,0);
 for(const[k,v]of Object.entries(preserved))assert.deepEqual(f.get(k),v);
 const summary=f.get('sisventas/compras_resumen/ordenes/classic');assert(summary);assert.equal(summary.inventarioCompra,undefined);
 assert(Object.keys(c.patch).every(k=>k.startsWith('sisventas/ordenes/classic')||k.startsWith('sisventas/compras_resumen/ordenes/classic')||k.startsWith('sv_labor_receipts/')||k==='sv_labor_guard'&&c.patch[k]===null),'Only order, curated summary, real receipt and guard release');
 await put('',c.state);const nativeBefore=Object.fromEntries(await Promise.all(Object.keys(preserved).map(async k=>[k,await read(k)])));const result=await nativeMerge(c.patch,c.override.uid,c.override.token);assert.equal(result.status,200,JSON.stringify(result));
 const expected=f.get('sisventas/ordenes/classic');for(const p of [expected.inventarioCompra.baseline,expected.inventarioCompra]){const k=p===expected.inventarioCompra?'references':'rows';assert.deepEqual(Object.keys(p[k]),['0']);p[k]=[p[k]['0']];}assert.deepEqual(await read('sisventas/ordenes/classic'),expected);
 for(const[k,v]of Object.entries(nativeBefore))assert.deepEqual(await read(k),v);
 assert.deepEqual(await command.execute({},body),ack);assert.equal(commits.length,1);
},{timeout:120000});
for(const [name,path,value]of [['editar','sv_permisos/admin/acciones/ordenes/editar',false],['migrar','sv_permisos/admin/acciones/mantenimiento/migrar',false],['role','sv_chat_roles/fake/rol','administrativo']])test('server rejects fresh '+name+' before a business PATCH',async()=>{
 assert(f);const old=f.get(path),n=commits.length;f.set(path,value);try{await assert.rejects(command.execute({}, {...body,id:body.id+'-'+name}),e=>e.statusCode===403);assert.equal(commits.length,n);}finally{f.set(path,old);}
});
test('server rejects a new order appearing after coverage EOF and before commit',async()=>{
 assert(f);const old=f.get('sisventas/ordenes/classic'),n=commits.length;f.set('sisventas/ordenes/classic',ORDER);
 const fresh=load('cotizador/purchase-current-pending-command').create({...options,assertAdmission:async args=>{await f.cohort.assertAdmission(args);if(args.phase==='commit')f.set('sisventas/ordenes/phantom',{estado:'borrador',items:[{productoKey:'product',cantidadOrdenada:1,cantidadRecibida:0,costoUnitario:1}]});}});
 try{await assert.rejects(fresh.execute({}, {...body,id:body.id+'-phantom'}),e=>e.statusCode===409);assert.equal(commits.length,n);}finally{f.set('sisventas/ordenes/phantom',null);f.set('sisventas/ordenes/classic',old);}
});
for(const [name,change]of [['permission revision',s=>s.sv_permisos.admin.indiceRevision++],['role',s=>s.sv_chat_roles.fake.rol='administrativo']])test('native Rules reject complete captured PATCH after '+name+' changes',async()=>{
 assert.equal(commits.length,1);const c=commits[0],state=structuredClone(c.state);change(state);await put('',state);const r=await nativeMerge(c.patch,c.override.uid,c.override.token);assert.equal(r.status,401);assert.deepEqual(await read('sisventas/ordenes/classic'),ORDER);
});
after(()=>f?.cleanup());
