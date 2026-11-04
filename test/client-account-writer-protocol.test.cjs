'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Protocol=require('../cotizador/client-account-writer-protocol'),Rules=require('../scripts/lib/commercial-writer-protocol-rules.cjs'),Policy=require('../cotizador/labor-fence-policy');
const {createLaborGuard}=require('../cotizador/labor-guard'),{createLaborRtdbStore}=require('../cotizador/labor-rtdb-store');
test('Docker includes Accounts protocol and the fiscal stager discovers its literal dependency',()=>{
 const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..'),{requires}=require('../scripts/stage-guarded-invoice-function.cjs');
 const docker=fs.readFileSync(path.join(root,'cotizador/Dockerfile'),'utf8'),source=fs.readFileSync(path.join(root,'cotizador/labor-rtdb-store.js'),'utf8');assert(docker.split(/\r?\n/).some(line=>line.startsWith('COPY ')&&line.split(/\s+/).includes('client-account-writer-protocol.js')));assert(requires(source,'labor-rtdb-store.js').includes('./client-account-writer-protocol'));
});
test('Accounts capability remains sticky through installed records and coordinated configuration',()=>{
 const rules=Rules.prepare({rules:{'.write':false,...Policy.metadataRules()}}).rules;
 for(const expression of [rules.sv_labor_guard['.write'],rules.sv_labor_receipts.$op['.write'],rules.sv_labor_indexes['.write']]){assert(expression.includes(Protocol.gate));assert(expression.includes("root.child('sv_client_accounts/v1').exists()"));assert(expression.includes('coordinated-v1'));}
 assert(rules.sv_labor_guard['.write'].endsWith(" || auth.token.mode === 'abort')"));assert.deepEqual(Protocol.reservedClaims(undefined),{svClientAccountsWriterVersion:0});assert.deepEqual(Protocol.reservedClaims(1),{svClientAccountsWriterVersion:1});
});
for(const [pages,accounts]of [[true,false],[false,true],[true,true],[false,false]])test('real store reserves Accounts capability from internal Pages='+pages+' Accounts='+accounts+' without extra Accounts GET',async()=>{
 const calls=[],store=createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=>'fixture',fetchImpl:async(url,options)=>{calls.push({method:options.method,path:new URL(url).pathname,token:JSON.parse(new URL(url).searchParams.get('auth_variable_override')||'null')?.token});return new Response(new URL(url).pathname==='/sv_labor_config.json'?JSON.stringify({ready:true,schema:1}):'null');}}),guard=createLaborGuard({store,commercialPages:pages,clientAccounts:accounts,delay:async()=>{}});
 const run=()=>guard.run({uid:'sv-labor-service',mode:'server',clientAccountsWriterVersion:1,claims:{svClientAccountsWriterVersion:1},input:{svClientAccountsWriterVersion:1}},async()=>({ok:true}));
 if(accounts&&!pages)await assert.rejects(run(),{code:'SV_CLIENT_ACCOUNTS_INCOMPLETE'});else await run();
 const expected=pages&&accounts?1:0;assert.equal(calls[0].token.svClientAccountsWriterVersion,expected);if(!(accounts&&!pages))assert.equal(calls.at(-1).token.svClientAccountsWriterVersion,expected);assert(!calls.some(call=>call.method==='GET'&&call.path.startsWith('/sv_client_accounts')));
});
test('incoming user Auth claims cannot mint Accounts maintenance authority in store commit',async()=>{
 let token;const store=createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=>'fixture',fetchImpl:async(url)=>{token=JSON.parse(new URL(url).searchParams.get('auth_variable_override')).token;return new Response('null');}});
 await store.commit({}, {fence:'fictional-fence',opId:'fictional-operation',actorUid:'u',digest:'a'.repeat(64)}, {uid:'u',mode:'user',claims:{uid:'u',svClientAccountsWriterVersion:1}});assert.equal(token.svClientAccountsWriterVersion,0);
});
