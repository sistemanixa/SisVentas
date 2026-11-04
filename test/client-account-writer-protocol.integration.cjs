'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{createLaborGuard}=require('../cotizador/labor-guard'),{createLaborRtdbStore}=require('../cotizador/labor-rtdb-store');
const Policy=require('../cotizador/labor-fence-policy'),Protocol=require('../scripts/lib/commercial-writer-protocol-rules.cjs'),AccountsRules=require('../scripts/lib/client-account-rules.cjs');
const host=process.env.FIREBASE_DATABASE_EMULATOR_HOST,ns='demo-accounts-writer-isolated',base='http://'+host,encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const sale={id:'V-ACCOUNTS-FICTION',fecha:'2026-11-04',clienteFbKey:'c',responsableUid:'u',subtotal:100,total:100,descuento:0,iva:0,conIva:false,items:[{cod:'P',qty:1,punit:100,disc:0,sub:100,costoUnitarioCompra:20,costoTotalCompra:20}]};
const nextSale={...sale,subtotal:200,total:200,items:[{...sale.items[0],punit:200,sub:200}]},actor={uid:'sv-labor-service',mode:'server',operation:'accounts-writer-fixture'};
test('reserved Accounts capability gates actual RTDB acquisition and commit independently of H7',{skip:!/^127\.0\.0\.1:\d+$/.test(host||''),timeout:60000},async()=>{
 async function rest(method,path,value){const r=await fetch(base+'/'+path+'.json?ns='+ns,{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});assert.equal(r.ok,true,method+' '+path+' '+r.status);return r.json();}
 const requests=[];
 async function transport(url,init){const target=new URL(url);assert.equal(target.origin,base);assert.equal(target.searchParams.get('ns'),ns);const override=target.searchParams.get('auth_variable_override');const record={method:init.method,path:target.pathname,claims:override?JSON.parse(override).token:null};requests.push(record);
  if(!override)return fetch(target,init);const auth=JSON.parse(override),now=Math.floor(Date.now()/1000),headers={...init.headers};delete headers.Authorization;target.searchParams.delete('auth_variable_override');target.searchParams.set('auth',encode({alg:'none',typ:'JWT'})+'.'+encode({iss:'https://securetoken.google.com/'+ns,aud:ns,sub:auth.uid,user_id:auth.uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom'},...auth.token})+'.');return fetch(target,{...init,headers});
 }
 const baseline={rules:{'.read':false,'.write':false,...Policy.metadataRules(),sisventas:{ventas:{'.write':Policy.financialRule(2,'false')}},sv_commercial_pages_config:{'.read':"auth != null && root.child('sv_access_resets').child(auth.uid).child('required').val() !== true && auth.token.svPasswordChangeRequired !== true"},sv_commercial_pages:{'.read':false,'.write':Policy.fence(1,Policy.serverActor)}}};
 await rest('PUT','.settings/rules',AccountsRules.prepare(Protocol.prepare(baseline)));
 const backend=await createCoordinatedBackend({ventas:{s:sale}}),prepared=structuredClone(backend.state);delete prepared.sv_client_history;delete prepared.sv_client_history_config;prepared.sv_labor_config.writerSchema=2;
 const store=createLaborRtdbStore({databaseURL:base+'/?ns='+ns,accessToken:async()=>'owner',fetchImpl:transport}),guard=(pages,accounts)=>createLaborGuard({store,commercialPages:pages,clientAccounts:accounts,clientHistory:false,delay:async()=>{}});
 for(const [pages,accounts]of [[true,false],[false,true]]){
  await rest('PUT','',prepared);requests.length=0;let work=0;
  await assert.rejects(guard(pages,accounts).run(actor,async scope=>{work++;await scope.update({'sisventas/ventas/s':nextSale});return {ok:true};}));
  assert.equal(work,0);assert.equal((await rest('GET','sisventas/ventas/s')).total,100);assert.equal(await rest('GET','sv_client_accounts/v1/totals/all/balanceCents'),10000);
  assert.equal(requests[0].claims.svLaborWriterSchema,2);assert.equal(requests[0].claims.svClientAccountsWriterVersion,0);assert(!requests.some(r=>r.method==='PATCH'));assert(requests.filter(r=>r.method==='GET').every(r=>r.path==='/sv_labor_guard.json'));
 }
 // Both independent installation markers stay closed even without coverage.
 for(const marker of [{sv_client_accounts:{v1:{partial:true}}},{sv_client_accounts_config:{ready:true}},{sv_client_accounts_config:{writerMode:'coordinated-v1'}}]){
  const state=structuredClone(prepared);delete state.sv_client_accounts;delete state.sv_client_accounts_config;Object.assign(state,marker);await rest('PUT','',state);let work=0;await assert.rejects(guard(true,false).run(actor,async()=>{work++;}));assert.equal(work,0);
 }
 await rest('PUT','',prepared);requests.length=0;
 await guard(true,true).run(actor,async scope=>{await scope.update({'sisventas/ventas/s':nextSale});return {ok:true};});
 assert.equal((await rest('GET','sisventas/ventas/s')).total,200);assert.equal(await rest('GET','sv_client_accounts/v1/totals/all/balanceCents'),20000);assert.equal((await rest('GET','sv_client_accounts/v1/coverage/all')).revision,2);assert.equal(requests.filter(r=>r.method==='PATCH').length,1);assert(requests.filter(r=>r.method==='PUT'||r.method==='PATCH').every(r=>r.claims.svClientAccountsWriterVersion===1));
 // A real guarded callback that began before installation cannot commit after it.
 const legacy=structuredClone(prepared);delete legacy.sv_client_accounts;delete legacy.sv_client_accounts_config;await rest('PUT','',legacy);let work=0;
 await assert.rejects(guard(true,false).run(actor,async scope=>{work++;await rest('PATCH','',{sv_client_accounts:prepared.sv_client_accounts,sv_client_accounts_config:prepared.sv_client_accounts_config});await scope.update({'sisventas/ventas/s':nextSale});return {ok:true};}));assert.equal(work,1);assert.equal((await rest('GET','sisventas/ventas/s')).total,100);assert.equal(await rest('GET','sv_client_accounts/v1/totals/all/balanceCents'),10000);assert.equal(await rest('GET','sv_labor_guard'),null);
 // Incoming claims and actor fields do not override the guard's capability.
 await rest('PUT','',prepared);requests.length=0;work=0;
 await assert.rejects(guard(true,false).run({...actor,claims:{svClientAccountsWriterVersion:1},clientAccountsWriterVersion:1,input:{svClientAccountsWriterVersion:1}},async()=>{work++;}));assert.equal(work,0);assert.equal(requests[0].claims.svClientAccountsWriterVersion,0);
 const lease={fence:'accounts-forged-fence',opId:'accounts-forged-operation',digest:'a'.repeat(64),actorUid:'u',mode:'user',expiresAt:Date.now()+30000};await assert.rejects(store.commit({'sv_labor_guard':null},lease,{uid:'u',mode:'user',claims:{uid:'u',svClientAccountsWriterVersion:1}}));assert.equal(requests.at(-1).claims.svClientAccountsWriterVersion,0);
 // No Accounts installation preserves the current legacy deployment path.
 await rest('PUT','',legacy);await guard(true,false).run(actor,async scope=>{await scope.update({'sisventas/ventas/s':nextSale});return {ok:true};});assert.equal((await rest('GET','sisventas/ventas/s')).total,200);assert.equal(await rest('GET','sv_labor_guard'),null);
});
