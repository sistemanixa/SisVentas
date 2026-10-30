'use strict';
// Explicit demo emulator and an externally supplied baseline; never ADC/production.
const {test,before,after,beforeEach}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
const dep=createRequire(process.env.SV_SECURITY_TOOLS+'/package.json'),sdk=dep('firebase/database'),{initializeTestEnvironment,assertFails,assertSucceeds}=dep('@firebase/rules-unit-testing');
const {build}=require('../scripts/lib/sale-create-preflight-rules.cjs'),{build:permissionIndex}=require('../js/core/permission-index');
const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),{createLaborGuard}=require('../cotizador/labor-guard'),{createLaborWriteGateway}=require('../cotizador/labor-write-gateway');
const {functionSource}=require('./helpers/app-functions.cjs');
const ns='demo-conversion-preflight',host='127.0.0.1:9058';let env,initial,baseline;
const person=uid=>({responsableUid:uid,responsableNombre:'Persona '+uid,responsableRol:'administrativo',responsableRevision:1,creadorOriginalUid:uid,creadorOriginalNombre:'Persona '+uid});
const candidate=rules=>require('../scripts/lib/employee-availability-rules.cjs').build(require('../scripts/lib/commercial-owner-query-rules.cjs').build(build(rules)));
before(async()=>{assert.equal(process.env.FIREBASE_DATABASE_EMULATOR_HOST,host);baseline=JSON.parse(fs.readFileSync(process.env.SV_PREFLIGHT_RULES));env=await initializeTestEnvironment({projectId:ns,database:{host:'127.0.0.1',port:9058,rules:JSON.stringify(candidate(baseline))}});});
after(async()=>env?.cleanup());
beforeEach(async()=>{const perms=permissionIndex({administrativo:{bloqueados:[],acciones:{ventas:{crear:true,editar:true}}},tecnico:{bloqueados:['venta','detalle'],acciones:{ventas:{crear:false}}}});initial={sv_labor_config:{schema:1,ready:true},sv_chat_roles:{a:{rol:'administrativo',activo:true},b:{rol:'administrativo',activo:true},tech:{rol:'tecnico',activo:true}},sv_chat_directorio:{a:{nombre:'Persona a'},b:{nombre:'Persona b'}},sv_permisos:perms,sisventas:{presupuestos:{budget:{...person('a'),id:'PP-DEMO',fecha:'2026-10-29',estado:'aprobado_int',audit:[],items:[{cod:'P-DEMO',desc:'Servicio ficticio',qty:2,punit:48,sub:96,esManoDeObra:true,costoUnitarioCompra:20,costoTotalCompra:40}]}},ventas:{other:{...person('b'),total:999}},contadores:{venta:1},pagos:{sentinel:{monto:12}},gastos:{sentinel:{monto:7}}},sv_personal_finance:{private:{secret:'FICTICIO'}}};await env.withSecurityRulesDisabled(c=>sdk.set(sdk.ref(c.database()),initial));});
const client=uid=>uid?env.authenticatedContext(uid).database():env.unauthenticatedContext().database();
const change=patch=>env.withSecurityRulesDisabled(c=>sdk.update(sdk.ref(c.database()),patch));

test('preparación directa real usa reglas vigentes y no escribe ni llama Cotizador',async()=>{
 const source=fs.readFileSync('js/core/commercial-ownership.js','utf8');
 function setup(uid){let calls=0;const c={currentUserUid:uid,currentRole:'administrativo',PERMISOS_ROLES:initial.sv_permisos,fbAuth:{currentUser:{uid}},fbDB:client(uid),fbRef:sdk.ref,fbGet:sdk.get,pptoData:[{fbKey:'budget',responsableUid:'a'}],ventasList:[{fbKey:'other',responsableUid:'a'}],navigator:{onLine:true},document:{addEventListener(){}},addEventListener(){},fetch:async()=>{calls++;throw Error('No se admite fallback al servidor');}};c.window=c;vm.runInNewContext(source,c);return{c,api:c.SVCommercialOwnership,calls:()=>calls};}
 const own=setup('a');let before;await env.withSecurityRulesDisabled(async c=>{before=(await sdk.get(sdk.ref(c.database()))).val();});
 const prepared=await own.api.prepare('presupuestos','budget');assert.equal(prepared.record.items[0].costoTotalCompra,40);assert.equal(own.calls(),0);
 await assert.rejects(own.api.prepare('ventas','other'));assert.equal(own.calls(),0);
 await env.withSecurityRulesDisabled(async c=>assert.deepEqual((await sdk.get(sdk.ref(c.database()))).val(),before));
 const revokedModules=Object.fromEntries(Object.keys(initial.sv_permisos.administrativo.indiceModulos).map(k=>['sv_permisos/administrativo/indiceModulos/'+k,false]));
 for(const patch of [{'sv_chat_roles/a/activo':false},{'sv_access_resets/a/required':true},revokedModules]){
  await env.withSecurityRulesDisabled(c=>sdk.set(sdk.ref(c.database()),initial));await change(patch);
  await assert.rejects(setup('a').api.prepare('presupuestos','budget'),undefined,JSON.stringify(patch));
 }
});
test('creation null read succeeds; existing foreign sales, collections and private accounts stay denied',async()=>{
 await assertSucceeds(sdk.get(sdk.ref(client('a'),'sisventas/ventas/new')));
 for(const path of ['sisventas/ventas/other','sisventas/ventas','sv_personal_finance/private'])await assertFails(sdk.get(sdk.ref(client('a'),path)));
 for(const who of [null,'tech'])await assertFails(sdk.get(sdk.ref(client(who),'sisventas/ventas/new')));
});
test('no create permission, module, active session or access version means no preflight',async()=>{
 for(const patch of [{'sv_permisos/administrativo/acciones/ventas/crear':false},{'sv_permisos/administrativo/indiceModulos/venta':false},{'sv_chat_roles/a/activo':false},{'sv_access_resets/a/required':true}]){
  await env.withSecurityRulesDisabled(c=>sdk.set(sdk.ref(c.database()),initial));await change(patch);await assertFails(sdk.get(sdk.ref(client('a'),'sisventas/ventas/new')));
 }
});
test('actual conversion, protected server gateway and CAS preserve costs and links; retry never duplicates',async()=>{
 const store=createLaborRtdbStore({databaseURL:'http://'+host+'/?ns='+ns,accessToken:async()=>'owner'}),db={ref:path=>({get:async()=>({val:()=>store.read(path)})})};
 // val() must return a resolved value, as the real Admin SDK does.
 db.ref=path=>({get:async()=>{const value=await store.read(path);return {val:()=>value};}});
 const guard=createLaborGuard({store}),gateway=createLaborWriteGateway({db,store,guard,enabled:true}),user={uid:'a'};
 const c={window:null,document:{addEventListener(){}},currentUser:'Persona a',currentUserUid:'a',currentUserEmail:'',currentRole:'administrativo',PERMISOS_ROLES:initial.sv_permisos,fbAuth:{currentUser:user},fbDB:client('a'),crypto:require('node:crypto').webcrypto,TextEncoder,AbortSignal,FB_PATHS:{ventas:'sisventas/ventas',presupuestos:'sisventas/presupuestos'},ventasList:[],escapeHTML:s=>s,_maxNumeroVentaLocal:()=>1};c.window=c;
 c.fetch=async(_url,options)=>{try{const value=await gateway.write({uid:'a',claims:{uid:'a'}},JSON.parse(options.body));return {ok:true,status:200,json:async()=>value};}catch(e){return {ok:false,status:e.statusCode||500,json:async()=>({message:e.message,code:e.code})};}};
 c.SVLaborWrites=require('../js/core/labor-writes').create(c);c.SVLaborWrites.install({sdk,endpoint:'http://fictional.invalid/write',headers:async()=>({})});
 c.fbRef=sdk.ref;c.fbGet=sdk.get;c.pptoData=[{...initial.sisventas.presupuestos.budget,fbKey:'budget'}];
 vm.createContext(c);vm.runInContext(fs.readFileSync('js/core/commercial-ownership.js','utf8'),c);
 // Como onValue en el arranque real: fijar sesión antes de entregar la lista.
 c.SVCommercialOwnership.contextChanged();c.pptoData=[{...initial.sisventas.presupuestos.budget,fbKey:'budget'}];
 c.SVSaleCosts=require('../js/core/sale-costs.v1').create(c);c.SVBudgetConversionCosts=require('../js/core/budget-conversion-costs.v1')(c);c.SVSaleWriter=require('../js/core/sale-writer.v1').create(c);
 vm.runInContext(fs.readFileSync('js/modules/commercial-document-controls.js','utf8'),c);for(const name of ['_resultadoConversionPresupuestoExistente','_svCargaOperacion__convertirPresupuestoEnVentaAtomico'])vm.runInContext(functionSource(name),c);
 const p={...initial.sisventas.presupuestos.budget,fbKey:'budget'},base={cliente:'Cliente ficticio',clienteFbKey:'customer',fecha:'2026-10-29',estadoPago:'pendiente',conIva:true,subtotal:96,iva:20.16,total:116.16,items:structuredClone(p.items)},audit={fecha:'2026-10-29',usuario:'Persona a',accion:'Aceptación ficticia'};
 const result=await c._svCargaOperacion__convertirPresupuestoEnVentaAtomico(p,base,audit);assert.equal(result.ventaFbKey,'ppto_budget');
 const saved=await store.read('sisventas');assert.equal(saved.ventas.ppto_budget.total,116.16);assert.equal(saved.ventas.ppto_budget.items[0].costoTotalCompra,40);assert.equal(saved.presupuestos.budget.ventaFbKey,'ppto_budget');assert.equal(saved.presupuestos.budget.estado,'convertido');assert.deepEqual(saved.pagos,initial.sisventas.pagos);assert.deepEqual(saved.gastos,initial.sisventas.gastos);assert.deepEqual(saved.ventas.other,initial.sisventas.ventas.other);
 const again=await c._svCargaOperacion__convertirPresupuestoEnVentaAtomico(p,base,audit);assert.equal(again.reutilizada,true);assert.deepEqual(await store.read('sisventas'),saved);
 await assertFails(sdk.get(sdk.ref(client('b'),'sisventas/ventas/ppto_budget')));
});
test('a sale created after the null snapshot is never overwritten',async()=>{
 const {digest}=require('../cotizador/labor-guard'),store=createLaborRtdbStore({databaseURL:'http://'+host+'/?ns='+ns,accessToken:async()=>'owner'}),db={ref:path=>({get:async()=>{const value=await store.read(path);return {val:()=>value};}})},guard=createLaborGuard({store}),gateway=createLaborWriteGateway({db,store,guard,enabled:true});
 const path='sisventas/ventas/race',original={...person('a'),total:77};await change({[path]:original});
 await assert.rejects(gateway.write({uid:'a',claims:{uid:'a'}},{id:'fictional_race_01',kind:'atomic',path:'',value:{[path]:{...original,total:99}},expectedHashes:{[path]:digest(null)}}),e=>e.code==='SV_CAS_CONFLICT');
 assert.deepEqual(await store.read(path),original);
});

test('queries indexadas reales incluyen históricos propios sin descargar ventas ajenas',async()=>{
 await change({'sv_usuarios/a':{uid:'a',nombre:'Persona a',rol:'administrativo',activo:true},'sv_usuarios/b':{uid:'b',nombre:'Persona b',rol:'administrativo',activo:true},'sisventas/ventas/mine':{...person('a'),total:50},'sisventas/ventas/legacy':{usuario:'Persona a',total:25}});
 const calls=[],store=createLaborRtdbStore({databaseURL:'http://'+host+'/?ns='+ns,accessToken:async()=>'owner'});
 const db={ref:path=>({get:async()=>{calls.push({path,full:true});return{val:()=>null,value:await store.read(path)};},orderByChild:field=>({equalTo:value=>({get:async()=>{calls.push({path,field,value});const data=await store.query(path,field,value);return{val:()=>data};}})})})};
 // Una val() síncrona como el SDK, sin resolver Promises desde la proyección.
 const ref=db.ref;db.ref=path=>{const r=ref(path);r.get=async()=>{calls.push({path,full:true});const data=await store.read(path);return{val:()=>data};};return r;};
 const api=require('../cotizador/commercial-ownership').createCommercialOwnership({db,auth:{verifyIdToken:async uid=>({uid})},enabled:true,scopedReads:true,queryReader:async(path,field,value)=>{calls.push({path,field,value});return store.query(path,field,value);}});
 const rows=(await api.list(await api.authorize({headers:{authorization:'Bearer a'}},'ventas'))).records;
 assert.deepEqual(Object.keys(rows).sort(),['legacy','mine']);assert.equal(calls.some(c=>c.path==='sisventas/ventas'&&c.full),false);assert.deepEqual(calls.filter(c=>c.path==='sisventas/ventas').map(c=>c.value),['a',null]);
});

test('dos instancias con el mismo intento confirman una sola escritura real',async()=>{
 const {digest}=require('../cotizador/labor-guard'),baseStore=createLaborRtdbStore({databaseURL:'http://'+host+'/?ns='+ns,accessToken:async()=>'owner'}),path='sisventas/ventas/race',original={...person('a'),id:'V-DEMO',total:77};await change({[path]:original});
 const id='parallel-client-attempt',receipt='sv_labor_receipts/'+id;let firstReads=0,release,commits=0;const both=new Promise(r=>release=r);
 const store={...baseStore,read:async p=>{if(p===receipt&&firstReads<2){firstReads++;if(firstReads===2)release();await both;return null;}return baseStore.read(p);},commit:async(patch,...args)=>{if(Object.keys(patch).some(p=>p===path||p.startsWith(path+'/')))commits++;return baseStore.commit(patch,...args);}};
 const db={ref:p=>({get:async()=>{const value=await baseStore.read(p);return{val:()=>value};}})},body={id,kind:'atomic',path:'',value:{[path]:{...original,observaciones:'Nota ficticia'}},expectedHashes:{[path]:digest(original)}};
 const gateways=[1,2].map(()=>createLaborWriteGateway({db,store,guard:createLaborGuard({store}),enabled:true}));
 const results=await Promise.all(gateways.map(g=>g.write({uid:'a',claims:{uid:'a'}},body)));
 assert.ok(results.every(r=>r.committed===true));assert.equal(commits,1);assert.equal((await baseStore.read(path)).observaciones,'Nota ficticia');assert.equal((await baseStore.read('sisventas/pagos/sentinel')).monto,12);
});

test('REST sin índice real falla cerrado sin descargar la colección como alternativa',async()=>{
 const ready=candidate(baseline),missing=structuredClone(ready);
 missing.rules.sisventas.ventas['.indexOn']=missing.rules.sisventas.ventas['.indexOn'].filter(field=>field!=='responsableUid');
 const install=async rules=>{const res=await fetch('http://'+host+'/.settings/rules.json?ns='+ns,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(rules)});assert.equal(res.status,200);await res.body.cancel();};
 await change({'sv_usuarios/a':{uid:'a',nombre:'Persona a',rol:'administrativo',activo:true},'sisventas/ventas/mine':{...person('a'),total:10}});
 const calls=[],store=createLaborRtdbStore({databaseURL:'http://'+host+'/?ns='+ns,accessToken:async()=>'owner'}),db={ref:p=>({get:async()=>{calls.push({path:p,full:true});const v=await store.read(p);return{val:()=>v};}})};
 const api=require('../cotizador/commercial-ownership').createCommercialOwnership({db,auth:{verifyIdToken:async uid=>({uid})},enabled:true,scopedReads:true,queryReader:async(path,field,value)=>{calls.push({path,field,value});return store.query(path,field,value);}});
 try{await install(missing);const actor=await api.authorize({headers:{authorization:'Bearer a'}},'ventas');await assert.rejects(api.list(actor),e=>e.statusCode===503);assert.equal(calls.some(c=>c.path==='sisventas/ventas'&&c.full),false);}
 finally{await install(ready);}
});

test('HTTP laboral real: GET no escribe, vínculo propio CAS, privacidad y disponibilidad puntual',async()=>{
 const http=require('node:http'),admin=createRequire(require('node:path').resolve('cotizador/package.json'))('firebase-admin');
 const app=admin.initializeApp({projectId:ns,databaseURL:'https://'+ns+'.firebaseio.com',credential:{getAccessToken:async()=>({access_token:'owner',expires_in:3600})}},'directory-audit-demo');
 let server;
 try{
  await change({'sv_usuarios/profile-a':{uid:'a',rol:'administrativo',activo:true,empleadoFbKey:'e'},'sisventas/empleados/e':{nombre:'Persona ficticia',dni:'DNI-FICTICIO',cargoId:'c'},'sisventas/empleados/other':{nombre:'Otra persona',dni:'NO EXPONER',sueldo:999},'sisventas/config/cargos/c':{nombre:'Cargo ficticio',valorHora:100},'sisventas/vacaciones/past':{empleadoId:'e',desde:'2020-01-01',hasta:'2020-01-10'},'sisventas/vacaciones/current':{empleadoId:'e',desde:'2026-10-10',hasta:'2026-10-20',obs:'PRIVADO'},'sisventas/vacaciones/future':{empleadoId:'e',desde:'2030-01-01',hasta:'2030-01-10'}});
  const store=createLaborRtdbStore({databaseURL:'http://'+host+'/?ns='+ns,accessToken:async()=>'owner'}),db=app.database(),auth={verifyIdToken:async uid=>({uid})},directory=require('../cotizador/employee-directory').createEmployeeDirectory({db,auth,queryReader:store.query}),availability=require('../cotizador/employee-availability').createEmployeeAvailability({db,auth,queryFrom:store.queryFrom});
  const source=fs.readFileSync('cotizador/index.js','utf8');function extract(name){const start=source.search(new RegExp('^function '+name+'\\(','m')),ends=/^\}/gm;ends.lastIndex=start;for(let m;(m=ends.exec(source));){const code=source.slice(start,m.index+1);try{new vm.Script(code);return code;}catch{}}throw Error('Missing helper');}
  const wire={JSON};vm.runInNewContext(extract('readBody')+'\n'+extract('send')+'\nthis.readBody=readBody;this.send=send;',wire);
  const start=source.indexOf("  if(req.method==='GET' && pathname==='/laboral/disponibilidad')"),end=source.indexOf("  if(req.method==='POST' && pathname==='/laboral/solicitar-gasto')",start);assert.ok(start>0&&end>start);
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor,route=new AsyncFunction('req','res','pathname','requestUrl','employeeAvailability','employeeDirectory','readBody','send',source.slice(start,end));
  server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');route(req,res,url.pathname,url,availability,directory,wire.readBody,wire.send).catch(e=>{res.writeHead(500);res.end(JSON.stringify({message:e.message}));});});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const request=async(path,method='GET',body,uid='a')=>{const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{Authorization:'Bearer '+uid,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,data:await response.json()};};
  const before=(await sdk.get(sdk.ref(client('a'),'sv_empleado_uid/a'))).val();assert.equal(before,null);
  const first=await request('/laboral/directorio');assert.equal(first.status,409);assert.equal(first.data.code,'SV_EMPLOYEE_BINDING_REQUIRED');assert.equal(await store.read('sv_empleado_uid/a'),null);
  assert.equal((await request('/laboral/vinculo-propio','POST',{uid:'b'})).status,400);assert.equal((await request('/laboral/vinculo-propio?verComo=b','POST',{})).status,403);
  const prepared=await Promise.all([request('/laboral/vinculo-propio','POST',{}),request('/laboral/vinculo-propio','POST',{})]);assert.ok(prepared.every(r=>r.status===200));assert.equal(prepared.filter(r=>r.data.created).length,1);
  assert.deepEqual(await store.read('sv_empleado_uid/a'),{perfilFbKey:'profile-a'});const result=await request('/laboral/directorio');assert.equal(result.status,200);assert.equal(result.data.empleados.e.dni,'DNI-FICTICIO');assert.equal(result.data.empleados.other.dni,undefined);
  const periods=await request('/laboral/disponibilidad?fecha=2026-10-15','GET',undefined,'tech');assert.equal(periods.status,200);assert.equal(periods.data.fecha,'2026-10-15');assert.equal(periods.data.periodos.length,1);assert.equal(periods.data.periodos[0].obs,undefined);
  assert.equal((await request('/laboral/disponibilidad?fecha=2026-02-30')).status,400);await change({'sv_access_resets/a':{required:true}});assert.equal((await request('/laboral/vinculo-propio','POST',{})).status,403);
  assert.equal((await store.read('sisventas/pagos/sentinel')).monto,12);assert.equal((await store.read('sisventas/gastos/sentinel')).monto,7);assert.equal(await store.read('sv_empleado_uid/b'),null);
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await app.delete();}
});
