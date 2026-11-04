'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Pause=require('../scripts/lib/sdk-admission-pause-rules.cjs'),Full=require('../scripts/lib/commercial-write-cut-rules.cjs'),Permissions=require('../js/core/permission-index');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs'),Financial=require('../cotizador/sale-financial-dependencies-model');
const base='http://127.0.0.1:9046',ns='demo-sdk-admission-pause',encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
async function restrictedFetch(url,init={}){
 const u=new URL(url);assert.equal(u.origin,base);assert.equal(u.searchParams.get('ns'),ns);const headers={...init.headers},override=u.searchParams.get('auth_variable_override');
 if(override){const actor=JSON.parse(override),now=Math.floor(Date.now()/1000);delete headers.Authorization;u.searchParams.delete('auth_variable_override');u.searchParams.set('auth',encode({alg:'none',typ:'JWT'})+'.'+encode({iss:'https://securetoken.google.com/'+ns,aud:ns,sub:actor.uid,user_id:actor.uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom'},...actor.token})+'.');}
 return fetch(u,{...init,headers});
}
async function admin(method,path,value){const r=await restrictedFetch(base+'/'+path+'.json?ns='+ns,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})});if(!r.ok)throw Error(method+' '+path+' '+r.status+' '+(await r.text()).slice(0,400));return r.json();}
async function sdk(method,path,value,uid='admin',claims={}){const u=new URL(base+'/'+path+'.json?ns='+ns);u.searchParams.set('auth_variable_override',JSON.stringify({uid,token:{uid,...claims}}));const r=await restrictedFetch(u,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});await r.text();return r.status;}
const sale={id:'V-PAUSE-FICTICIA',responsableUid:'admin',responsableNombre:'Persona admin',responsableRol:'admin',responsableRevision:1,creadorOriginalUid:'admin',creadorOriginalNombre:'Persona admin',creadaPor:'Persona admin',creadoPor:'Persona admin',usuario:'Persona admin',fecha:'2026-11-04',ts:10,creadoEn:10,total:100,subtotal:100,clienteFbKey:'c',items:[{cod:'DEMO',qty:1,punit:100,costoUnitarioCompra:20}]};
const customer={id:'C-FICTICIO',nombre:'Cliente ficticio',domicilios:{d:{direccion:'Lugar ficticio'}}};
const paths=[['sisventas/ventas/target',sale],['sisventas/pagos/target',{ventaFbKey:'s',ventaId:sale.id,monto:10,fecha:'2026-11-04',medio:'Transferencia'}],['sisventas/presupuestos/target',{...sale,id:'PP-FICTICIO',estado:'borrador'}],['sisventas/clientes/target',customer],['sv_usuarios/target',{uid:'target',nombre:'Persona target',rol:'vendedor',activo:true}],['sv_chat_roles/target',{activo:true,rol:'vendedor'}],['sv_permisos/vendedor',null],['sisventas/clientes_unificados/group',{principalLegacyFbKey:'c',legacyFbKeys:['c']}],['sisventas/clientes_unificados_indice/c',{clienteKey:'group'}]];
async function fixture(installed,pause){
 const sources={ventas:{s:sale},clientes:{c:customer},presupuestos:{},pagos:{},gastos:{},ctaemp:{},comisiones_generacion:{},sv_commission_generation:{}},f=await createCoordinatedBackend(sources);
 apply(f.state,(await Financial.prepare(sources,{generation:'pause-financial'})).patch);const s=f.state;
 s.sv_chat_roles={admin:{activo:true,rol:'admin'},staff:{activo:true,rol:'administrativo'},denied:{activo:false,rol:'admin'}};
 s.sv_usuarios={admin:{uid:'admin',nombre:'Persona admin',rol:'admin',activo:true},staff:{uid:'staff',nombre:'Persona staff',rol:'administrativo',activo:true}};s.sv_chat_directorio={admin:{nombre:'Persona admin'},staff:{nombre:'Persona staff'}};
 s.sv_permisos=Permissions.build({admin:{bloqueados:[]},administrativo:{bloqueados:[]}});s.sv_labor_config={schema:1,writerSchema:2,ready:true,...(pause===undefined?{}:{sdkAdmissionPaused:pause})};
 if(!installed)for(const k of ['sv_commercial_pages','sv_commercial_pages_config','sv_client_accounts','sv_client_accounts_config','sv_client_history','sv_client_history_config','sv_sale_financial_dependencies'])delete s[k];return s;
}
test('SDK pause survives baseline composition, blocks SDK only and preserves real fiscal recovery',{skip:process.env.FIREBASE_DATABASE_EMULATOR_HOST!=='127.0.0.1:9046'||!process.env.SV_RULES_TEST_FILE,timeout:60000},async t=>{
 const baseline=JSON.parse(fs.readFileSync(process.env.SV_RULES_TEST_FILE,'utf8')),pausedBaseline=Pause.prepare(baseline),full=Full.prepare(pausedBaseline);
 assert.deepEqual(full,Full.prepare(baseline));assert.deepEqual(Pause.strip(pausedBaseline),baseline);
 const altered=structuredClone(pausedBaseline);altered.rules.sv_usuarios['.write']+=' || true';assert.throws(()=>Full.prepare(altered),/Envelope/);
 for(const installed of [false,true]){
  await admin('PUT','.settings/rules',installed?full:pausedBaseline);
  for(const pause of [undefined,false,true,0,'false',false])for(const [path,value]of paths)for(const operation of ['create','update']){
   const state=await fixture(installed,pause);await admin('PUT','',state);let payload=value;
   if(path==='sv_permisos/vendedor'){
    const before=Permissions.build({vendedor:{bloqueados:[]}}).vendedor;
    if(operation==='update'){await admin('PUT',path,before);payload=Permissions.build({vendedor:{...before,acciones:{ventas:{crear:false}}}}).vendedor;}else payload=before;
   }else if(operation==='update'){await admin('PUT',path,value);payload={...value,...(path==='sv_chat_roles/target'?{activo:false}:path.includes('unificados')?{actualizadoEn:100}:{descripcion:'Actualización ficticia'})};}
   const originallyAllowed=!path.startsWith('sisventas/ventas/')&&!path.startsWith('sisventas/pagos/')&&(!installed||!path.startsWith('sisventas/'));
   const expected=originallyAllowed&&(pause===undefined||pause===false)?200:401;
   assert.equal(await sdk('PUT',path,payload),expected,[installed,pause,path,operation].join('/'));
  }
  for(const pause of [false,true,false]){
   await admin('PUT','',await fixture(installed,pause));
   for(const field of ['ultimoAcceso','ultimoAccesoEn'])assert.equal(await sdk('PUT','sv_usuarios/staff/'+field,Date.now(),'staff'),pause?401:200,field);
   assert.equal(await sdk('PATCH','',{'sv_usuarios/target':{uid:'target',nombre:'Persona target',rol:'vendedor',activo:true},'sv_chat_roles/target':{activo:true,rol:'vendedor'}}),pause?401:200,'root multipath');
   assert.equal(await sdk('PUT','sv_usuarios/target',{uid:'target',nombre:'No autorizado'},'denied'),401,'inactive permission is never elevated');
   assert.equal(await sdk('PUT','sv_labor_config/sdkAdmissionPaused',false),401,'admin SDK cannot operate the pause');
   assert.equal(await sdk('PUT','sv_labor_config/sdkAdmissionPaused','false'),401,'metadata cannot be invalidated by SDK');
  }
 }
 t.diagnostic('216 canonical create/update checks plus nested, multipath, permissions and metadata controls passed');
 await admin('PUT','.settings/rules',full);
 const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),{createLaborGuard}=require('../cotizador/labor-guard'),{createFiscalLaborBridge}=require('../cloud-functions/emitir-factura/labor-bridge.cjs');
 await admin('PUT','',await fixture(true,true));
 const configStore=createLaborRtdbStore({databaseURL:base+'/?ns='+ns,accessToken:async()=>'owner',fetchImpl:restrictedFetch}),configGuard=createLaborGuard({store:configStore,commercialPages:true,clientAccounts:true,clientHistory:true,saleFinancialDependencies:true,operationalSummaries:true,delay:async()=>{}});
 for(const value of [false,true]){await configGuard.run({uid:'sv-labor-service',mode:'bootstrap',operation:'sdk-pause-config',input:{value}},async scope=>{await scope.update({'sv_labor_config/sdkAdmissionPaused':value});return {ok:true};});assert.equal(await admin('GET','sv_labor_config/sdkAdmissionPaused'),value);}
 await assert.rejects(configGuard.run({uid:'sv-labor-service',mode:'bootstrap',operation:'sdk-pause-invalid-config',input:{}},async scope=>{await scope.update({'sv_labor_config/sdkAdmissionPaused':'false'});return {ok:true};}));
 assert.equal(await admin('GET','sv_labor_config/sdkAdmissionPaused'),true);
 for(const ready of [true,false]){
  const state=await fixture(true,true),id='a'.repeat(64),result={cae:'CAE-FICTICIO',fecha:'04/11/2026'};
  state.sv_labor_config.ready=ready;state.sv_fiscal_emissions={[id]:{operationId:id,ventaKey:'s',clase:'factura',uid:'admin',usuario:'Persona admin',facturaAnteriorCae:'',estado:'autorizada',resultado:result}};
  await admin('PUT','',state);
  const store=createLaborRtdbStore({databaseURL:base+'/?ns='+ns,accessToken:async()=>'owner',fetchImpl:restrictedFetch}),guard=createLaborGuard({store,commercialPages:true,clientAccounts:true,clientHistory:true,saleFinancialDependencies:true,operationalSummaries:true,delay:async()=>{}}),db={ref:path=>({get:async()=>{const value=await admin('GET',path);return {val:()=>value};}})};
  let authorized=0;const bridge=createFiscalLaborBridge({db,guard}),response=await bridge.resume(id,async()=>{authorized++;});assert.equal(authorized,1);
  assert.equal(response.persistenciaPendiente,!ready);assert.equal((await admin('GET','sv_fiscal_emissions/'+id)).resultado.cae,result.cae);
  assert.equal(await admin('GET','sisventas/ventas/s/factura/cae'),ready?result.cae:null);
  assert.equal(await admin('GET','sv_labor_guard'),null);
  assert.equal(await sdk('PUT','sv_usuarios/target',{uid:'target'}),401,'SDK remains blocked throughout recovery');
  const before=await admin('GET','sisventas/ventas/s');
  assert.equal(await sdk('PUT','sisventas/ventas/s',{...before,observaciones:'Forgery'},'sv-labor-service',{svLaborService:true,svLaborWriterSchema:2}),401,'reserved claim alone cannot bypass original fence');
 }
 t.diagnostic('real bridge.resume/guard/store attached durable result with ready=true; ready=false kept result pending without reemission');
});
