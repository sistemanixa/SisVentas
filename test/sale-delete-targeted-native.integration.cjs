'use strict';
// Explicit local emulator test. No production endpoints, credentials or records.
const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path'),net=require('node:net'),cp=require('node:child_process');
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
const ROOT=process.env.SV_SALE_DELETE_TARGET_SOURCE||path.resolve(__dirname,'..'),load=p=>require(ROOT+'/'+p),Builder=require('../scripts/lib/sale-delete-targeted-current-rules.cjs');
let f,capture,commandBody;
test('full HTTP genuine delete capture commits complete native cascade and replays one receipt, preserving unrelated originals',async()=>{
 const candidate=Builder.prepare(fs.readFileSync(BASELINE),{expectedBaselineSha256:SHA});
 const compiled=await request('.settings/rules','PUT',candidate.rules);assert.equal(compiled.status,200);await compiled.body?.cancel();
 f=await load('test/helpers/sale-delete-native-http-lab.cjs').create({sourceRoot:ROOT,mode:'targeted'});commandBody=f.body();
 const sdkActor=await f.gateway.authorize({method:'POST',headers:{authorization:'Bearer FICTITIOUS_DELETE_LAB'}});await f.runtime.store.readAsUser('sisventas/ventas/sale',sdkActor);
 const preserved=Object.fromEntries(['sisventas/stock','sisventas/comisiones','sisventas/comprobantesVenta'].map(k=>[k,f.get(k)])),beforeBudget=f.get('sisventas/presupuestos/budget');
 const reply=await f.request(commandBody);assert.equal(reply.status,200,JSON.stringify(reply));assert.equal(f.commits.length,1);capture=f.commits[0];
 assert.equal(capture.override.token.svFinancialAction,'ventas.eliminar');assert.equal(capture.override.token.svSaleDeleteRelationsWriterVersion,1);assert.equal(capture.override.token.svClientAccountsWriterVersion,1);for(const family of ['SaleFinancial','ClientHistory'])assert.equal(capture.override.token['sv'+family+'WriterVersion'],0);
 assert.equal(capture.patch.sv_labor_guard,null);assert(capture.patch['sv_labor_receipts/'+commandBody.id]);
 fs.writeFileSync(process.env.SV_SALE_DELETE_OUT+'/capture.private.json',JSON.stringify({candidate:candidate.rules,capture}));
 await put('',capture.before);const nativeBefore=Object.fromEntries(await Promise.all(Object.keys(preserved).map(async k=>[k,await read(k)])));
 const result=await nativeMerge(capture.patch,capture.override.uid,capture.override.token);assert.equal(result.status,200,JSON.stringify(result));
 for(const k of ['sisventas/ventas/sale','sisventas/pagos/payment','sisventas/ordenes_trabajo/ot','sv_commercial_pages/v1/records/sales/sale'])assert.equal(await read(k),null,k);
 assert.equal(await read('sisventas/presupuestos/budget/estado'),'anulado');assert.deepEqual(await read('sisventas/presupuestos/budget/items'),beforeBudget.items);
 for(const[k,v]of Object.entries(nativeBefore))assert.deepEqual(await read(k),v);
 assert.equal(await read('sv_client_accounts/v1/totals/all/balanceCents'),0);for(const p of ['sv_client_history','sv_client_history_config','sv_sale_financial_dependencies'])assert.equal(await read(p),null);
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
test('OT cascade leaf rejects foreign/missing technical FK, altered receipt, retained sale, revoked OT action and adulterated writer claims',async()=>{
 assert(capture);
 const cases=[
  ['foreign FK',c=>c.before.sisventas.ordenes_trabajo.ot.ventaFbKey='foreign'],
  ['legacy missing FK',c=>delete c.before.sisventas.ordenes_trabajo.ot.ventaFbKey],
  ['receipt foreign sale',c=>c.patch['sv_labor_receipts/'+commandBody.id].result.ventaKey='foreign'],
  ['sale retained',c=>delete c.patch['sisventas/ventas/sale']],
  ['OT retained with summary removed',c=>delete c.patch['sisventas/ordenes_trabajo/ot']],
  ['foreign summary key',c=>{delete c.patch['sisventas/listados_resumen/ordenes_trabajo/ot'];c.before.sisventas.listados_resumen.ordenes_trabajo.other={id:'OT-FOREIGN'};c.patch['sisventas/listados_resumen/ordenes_trabajo/other']=null;}],
  ['OT action false',c=>c.before.sv_permisos.admin.acciones.ot.eliminar=false],
  ['OT module false',c=>c.before.sv_permisos.admin.indiceModulos.ordentrabajo=false],
  ...['ClientHistory','SaleFinancial'].map(family=>['forged nonzero '+family,c=>c.override.token['sv'+family+'WriterVersion']=1]),['missing Accounts',c=>c.override.token.svClientAccountsWriterVersion=0],
  ['different action',c=>c.override.token.svFinancialAction='cobranzas.registrar']
 ];
 for(const[name,change]of cases){const c=structuredClone(capture);change(c);await put('',c.before);const r=await nativeMerge(c.patch,c.override.uid,c.override.token);assert.equal(r.status,401,name);assert.deepEqual(await read('sisventas/ordenes_trabajo/ot'),c.before.sisventas.ordenes_trabajo.ot,name+' leaves original intact');}
},{timeout:60000});
test('targeted index rejects old H3 idle SDK without an atomic writer',async()=>{
 assert(capture);const state=structuredClone(capture.before);state.sv_labor_guard=null;state.sv_permisos.admin.indiceModulos.soporte=true;state.sv_record_list_config={schema:1,ready:true};
 const Lists=load('cotizador/record-list-model'),record={clienteFbKey:'client',problema:'Prueba ficticia',estado:'abierto'},patch=Lists.plan('sisventas/reclamos/standalone',null,record,'fiction-h3-sdk-original');
 const user=f.calls.find(c=>c.method==='GET'&&c.override?.uid==='u'&&!c.override.token.svLaborService);assert(user);
 await put('',state);const r=await nativeMerge(patch,user.override.uid,user.override.token);assert.equal(r.status,401,JSON.stringify(r));assert.equal(await read('sisventas/reclamos/standalone'),null);assert.equal(await read('sv_client_history'),null);
});
test('unchanged native baseline denies SDK writes to all five financial sources during the delete lease',async()=>{
 assert(capture);const user=f.calls.find(c=>c.method==='GET'&&c.override?.uid==='u'&&!c.override.token.svLaborService);assert(user);
 const mutations={'sisventas/ventas/late':{id:'V-PHANTOM',total:7},'sisventas/gastos/late':{ventaFbKey:'sale',tipoPagable:'comision',monto:7},'sisventas/ctaemp/e/late':{ventaFbKey:'sale',monto:7},'sisventas/comisiones_generacion/late':{ventaFbKey:'sale',monto:7},'sv_commission_generation/sale':{estado:'pending',saleKey:'sale'}};
 for(const[p,v]of Object.entries(mutations)){await put('',capture.before);const r=await nativeMerge({[p]:v},user.override.uid,user.override.token);assert.equal(r.status,401,p);assert.equal(await read(p),null,p);assert.deepEqual(await read('sisventas/ventas/sale'),capture.before.sisventas.ventas.sale);}
});
after(async()=>{if(f)await f.close();});
test('targeted native commit rejects namespace appearance after final reads and namespace additions in the atomic patch',async()=>{
 assert(capture);for(const p of ['sv_client_history','sv_client_history_config','sv_sale_financial_dependencies'])for(const phase of ['PRE','POST']){
  const c=structuredClone(capture);if(phase==='PRE')c.before[p]={partial:true};else c.patch[p]={partial:true};await put('',c.before);
  const r=await nativeMerge(c.patch,c.override.uid,c.override.token);assert.equal(r.status,401,p+' '+phase);assert.deepEqual(await read('sisventas/ventas/sale'),c.before.sisventas.ventas.sale);assert.equal(await read('sv_labor_receipts/'+commandBody.id),null);
 }
},{timeout:60000});
test('targeted genuine financial model blocks commission dependencies and invalid source shapes before any business PATCH',async()=>{
 for(const input of [{gastos:{commission:{ventaFbKey:'sale',tipoPagable:'comision',monto:7,estado:'aprobado'}}}]){
  const g=await load('test/helpers/sale-delete-native-http-lab.cjs').create({sourceRoot:ROOT,mode:'targeted',input});try{const before=g.get('sisventas'),reply=await g.request(g.body());assert.equal(reply.body.ok,false);assert([409,503].includes(reply.status),JSON.stringify(reply));assert.equal(g.commits.length,0);assert.deepEqual(g.get('sisventas'),before);}finally{await g.close();}
 }
});
test('targeted preparation rejects malformed complete employee originals before a command can exist',async()=>{
 await assert.rejects(()=>load('test/helpers/sale-delete-native-http-lab.cjs').create({sourceRoot:ROOT,mode:'targeted',input:{ctaemp:{invalid:false}}}),error=>error.code==='SV_SALE_DELETE_TARGET_INDEX');
});
test('genuine typed administrative preparation installs only metadata with a native Guard-derived writer claim',async()=>{
 const g=await load('test/helpers/sale-delete-native-http-lab.cjs').create({sourceRoot:ROOT,mode:'targeted'});
 try{
  g.set('sv_sale_delete_relations',null);const permissions=g.get('sv_permisos/admin');permissions.indiceModulos.configuracion=true;permissions.acciones.mantenimiento={migrar:true};g.set('sv_permisos/admin',permissions);
  const actor=await g.gateway.authorize({method:'POST',headers:{authorization:'Bearer FICTITIOUS_DELETE_LAB'}}),before=g.get('sisventas'),Guard=load('cotizador/labor-guard'),Prep=load('cotizador/sale-delete-target-preparation');
  const result=await g.runtime.guard.run({...actor,mode:'user',role:'admin',permissionRevision:permissions.indiceRevision,permissionDigest:Guard.digest(permissions),opId:'targeted-native-prepare-operation',financialAction:'ventas.eliminar.preparar',input:{}},scope=>Prep.prepare({scope,store:g.runtime.store}));
  assert.equal(result.prepared,true);assert.equal(g.commits.length,1);assert.deepEqual(g.get('sisventas'),before);const c=g.commits[0];assert.equal(c.override.token.svSaleDeleteRelationsWriterVersion,1);assert.equal(c.override.token.svFinancialAction,'ventas.eliminar.preparar');assert.equal(c.before.sv_sale_delete_relations,undefined);assert(!Object.keys(c.patch).some(p=>p.startsWith('sisventas/')));
  await put('',c.before);assert.equal((await nativeMerge(c.patch,c.override.uid,c.override.token)).status,200);assert.equal(await read('sv_sale_delete_relations/config/ready'),true);assert.deepEqual(await read('sisventas'),load('cotizador/payment-membership-index').normalizeRtdb(before));
  for(const mutate of [x=>x.override.token.svSaleDeleteRelationsWriterVersion=0,x=>x.override.token.svFinancialAction='ventas.eliminar',x=>x.before.sv_chat_roles.u.rol='administrativo',x=>x.before.sv_permisos.admin.acciones.mantenimiento.migrar=false,x=>x.before.sv_sale_delete_relations={partial:true}]){const n=structuredClone(c);mutate(n);await put('',n.before);assert.equal((await nativeMerge(n.patch,n.override.uid,n.override.token)).status,401);assert.deepEqual(await read('sisventas'),load('cotizador/payment-membership-index').normalizeRtdb(before));}
 }finally{await g.close();}
},{timeout:60000});
test('genuine ordinary sale writer maintains source and targeted metadata in one native commit',async()=>{
 const g=await load('test/helpers/sale-delete-native-http-lab.cjs').create({sourceRoot:ROOT,mode:'targeted'});
 try{
  const Guard=load('cotizador/labor-guard'),M=load('cotizador/sale-delete-target-index'),actor=await g.gateway.authorize({method:'POST',headers:{authorization:'Bearer FICTITIOUS_DELETE_LAB'}}),old=g.get('sisventas/ventas/sale');
  await g.gateway.write(actor,{id:'targeted-native-sale-update',kind:'compare',path:'sisventas/ventas/sale',expectedHash:Guard.digest(old),value:{...old,observaciones:'Cambio ficticio'}});
  assert.equal(g.commits.length,1);const c=g.commits[0];assert.equal(c.override.token.svSaleDeleteRelationsWriterVersion,1);assert.equal(c.patch[M.ROOT+'/coverage'].revision,c.before.sv_sale_delete_relations.v1.coverage.revision+1);
  await put('',c.before);assert.equal((await nativeMerge(c.patch,c.override.uid,c.override.token)).status,200);assert.equal(await read('sisventas/ventas/sale/observaciones'),'Cambio ficticio');M.validateRecord('sisventas/ventas/sale',await read('sisventas/ventas/sale'),await read(M.recordPath('sisventas/ventas/sale')));
  for(const mutate of [x=>x.override.token.svSaleDeleteRelationsWriterVersion=0,x=>delete x.patch[M.ROOT+'/coverage'],x=>x.before.sv_sale_delete_relations={partial:true}]){const n=structuredClone(c);mutate(n);await put('',n.before);assert.equal((await nativeMerge(n.patch,n.override.uid,n.override.token)).status,401);assert.deepEqual(await read('sisventas/ventas/sale'),old);}
 }finally{await g.close();}
},{timeout:60000});
