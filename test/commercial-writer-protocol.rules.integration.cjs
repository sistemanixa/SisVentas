'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{createLaborGuard}=require('../cotizador/labor-guard'),{createLaborRtdbStore}=require('../cotizador/labor-rtdb-store');
const host=process.env.FIREBASE_DATABASE_EMULATOR_HOST,base='http://'+host,ns='demo-commercial-protocol-isolated';
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function restrictedFetch(url,init){
 const target=new URL(url);assert.equal(target.origin,base);assert.equal(target.searchParams.get('ns'),ns);
 const override=target.searchParams.get('auth_variable_override');if(!override)return fetch(target,init);
 const actor=JSON.parse(override),now=Math.floor(Date.now()/1000),headers={...init.headers};delete headers.Authorization;target.searchParams.delete('auth_variable_override');
 target.searchParams.set('auth',encode({alg:'none',typ:'JWT'})+'.'+encode({iss:'https://securetoken.google.com/'+ns,aud:ns,sub:actor.uid,user_id:actor.uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom'},...actor.token})+'.');
 return fetch(target,{...init,headers});
}
async function rest(method,path,value){const response=await fetch(base+'/'+path+'.json?ns='+ns,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});if(!response.ok)throw Error(method+' '+path+' HTTP '+response.status);return response.json();}

test('cut protocol rejects legacy preflight before work and a current writer missing H7 before commit',{skip:!/^127\.0\.0\.1:\d+$/.test(process.env.FIREBASE_DATABASE_EMULATOR_HOST||'')||!process.env.SV_RULES_TEST_FILE,timeout:60000},async()=>{
 const baseline=JSON.parse(fs.readFileSync(process.env.SV_RULES_TEST_FILE,'utf8')),candidate=require('../scripts/lib/commercial-write-cut-rules.cjs').prepare(baseline),backend=await createCoordinatedBackend({ventas:{s:{id:'V-FICTION',clienteFbKey:'c',responsableUid:'u',total:100,subtotal:100}}});backend.state.sv_permisos={admin:{indiceVersion:2,indiceRevision:1,indiceModulos:{venta:true,detalle:true,cuentacorriente:true}}};backend.state.sv_labor_config.writerSchema=2;await rest('PUT','.settings/rules',candidate);await rest('PUT','',backend.state);
 const oldFetch=(url,init)=>{const target=new URL(url),override=target.searchParams.get('auth_variable_override');if(override){const value=JSON.parse(override);delete value.token.svLaborWriterSchema;delete value.token.svClientHistoryWriterVersion;target.searchParams.set('auth_variable_override',JSON.stringify(value));}return restrictedFetch(target,init);};
 let work=0;const legacyStore=createLaborRtdbStore({databaseURL:base+'/?ns='+ns,accessToken:async()=>'owner',fetchImpl:oldFetch}),legacyGuard=createLaborGuard({store:legacyStore,delay:async()=>{}});
 await assert.rejects(legacyGuard.run({uid:'sv-labor-service',mode:'server',operation:'fiscal-preflight'},async()=>{work++;return {ok:true};}));assert.equal(work,0,'old fiscal must never reach external-dispatch preparation');assert.equal(await rest('GET','sv_labor_guard'),null);
 const currentStore=createLaborRtdbStore({databaseURL:base+'/?ns='+ns,accessToken:async()=>'owner',fetchImpl:restrictedFetch}),misconfigured=createLaborGuard({store:currentStore,commercialPages:true,clientAccounts:true,clientHistory:false,delay:async()=>{}});
 await assert.rejects(misconfigured.run({uid:'sv-labor-service',mode:'server',operation:'fixture-missing-h7'},async scope=>{await scope.update({'sisventas/ventas/s/observaciones':'Must not persist'});return {ok:true};}));assert.equal(await rest('GET','sisventas/ventas/s/observaciones'),null);assert.equal(await rest('GET','sv_client_history/v1/state/records'),1);assert.equal(await rest('GET','sv_labor_guard'),null);
 const before=await rest('GET','sisventas/ventas/s');
 await rest('DELETE','sv_labor_config/writerSchema');
 await assert.rejects(legacyGuard.run({uid:'sv-labor-service',mode:'server',operation:'legacy-after-config-loss'},async()=>{work++;return {ok:true};}));
 assert.equal(work,0);assert.deepEqual(await rest('GET','sisventas/ventas/s'),before);
 const state=await rest('GET','');delete state.sv_client_history;delete state.sv_client_accounts;delete state.sv_client_accounts_config;delete state.sv_labor_config.writerSchema;await rest('PUT','',state);
 const lease={fence:'legacy-before-cut-fence',opId:'legacy-before-cut-operation',digest:'a'.repeat(64),actorUid:'sv-labor-service',mode:'server',expiresAt:Date.now()+30000};
 await legacyStore.acquire(lease);
 await rest('PUT','sv_labor_config/writerSchema',2);
 const patch={'sisventas/ventas/s/observaciones':'must not persist','sv_labor_guard':null,['sv_labor_receipts/'+lease.opId]:{fence:lease.fence,digest:lease.digest,actorUid:lease.actorUid,result:{ok:true}}};
 await assert.rejects(legacyStore.commit(patch,lease,{mode:'server',uid:'sv-labor-service'}));
 assert.equal(await rest('GET','sisventas/ventas/s/observaciones'),null);
 await legacyStore.abort(lease);assert.equal(await rest('GET','sv_labor_guard'),null);

});
