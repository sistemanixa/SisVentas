'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Protocol=require('../cotizador/sale-financial-dependencies-protocol'),Model=require('../cotizador/sale-financial-dependencies-model');
const {createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),{createLaborGuard,child,parts,put}=require('../cotizador/labor-guard');
function fixture(installed){
 let state={sv_labor_config:{schema:1,ready:true}},work=0,mutations=0;const attempts=[];
 if(installed)state=put(state,parts(Model.ROOT+'/coverage'),{schema:1,ready:true});
 const fetchImpl=async(target,options)=>{
  const url=new URL(target),path=url.pathname.replace(/^\//,'').replace(/\.json$/,''),actor=JSON.parse(url.searchParams.get('auth_variable_override')||'null');
  if(options.method==='GET')return new Response(JSON.stringify(child(state,parts(path))));
  attempts.push({method:options.method,path,claims:actor?.token});
  if(options.method==='PUT'&&path==='sv_labor_guard'&&!Protocol.allowsInstalledWriter(child(state,parts(Model.ROOT))!=null,actor?.token))return new Response('null',{status:403});
  if(options.method==='PUT'){state=put(state,parts(path),JSON.parse(options.body));mutations++;}
  if(options.method==='PATCH'){for(const [entry,value]of Object.entries(JSON.parse(options.body)))state=put(state,parts(entry),value);mutations++;}
  return new Response('null');
 };
 const store=createLaborRtdbStore({databaseURL:'https://fixture.invalid',accessToken:async()=> 'fictional',fetchImpl}),guard=createLaborGuard({store,clientHistory:true,clientAccounts:true,commercialPages:true,delay:async()=>{}});
 return {guard,attempts,mutations:()=>mutations,work:()=>work,run:()=>guard.run({uid:'sv-labor-service',mode:'server',operation:'old-proto2-h7-runtime'},async()=>{work++;return {ok:true};})};
}
test('protocol-2 H7-capable current runtime without financial writer is rejected before callback when index installed',async()=>{const f=fixture(true);await assert.rejects(f.run());assert.equal(f.work(),0);assert.equal(f.mutations(),0);assert.equal(f.attempts.length,1);assert.equal(f.attempts[0].claims.svLaborWriterSchema,2);assert.equal(f.attempts[0].claims.svClientHistoryWriterVersion,1);assert.notEqual(f.attempts[0].claims[Protocol.CLAIM],1);});
test('absence of prepared index leaves existing protocol-2 operation unchanged',async()=>{const f=fixture(false);assert.deepEqual(await f.run(),{ok:true});assert.equal(f.work(),1);assert.equal(f.mutations(),2);});
test('reserved claim comes only from internal capability, not incoming Auth claims',()=>{const token={svSaleFinancialWriterVersion:1,...Protocol.reservedClaims(undefined)};assert.equal(token.svSaleFinancialWriterVersion,0);assert.equal(Protocol.allowsInstalledWriter(true,token),false);assert.equal(Protocol.reservedClaims(1).svSaleFinancialWriterVersion,1);});
test('partial index or missing coverage remains sticky through technical root existence',()=>{assert(Protocol.installed.includes(Model.ROOT));assert(!Protocol.installed.includes('/coverage'));assert.match(Protocol.gate,/svSaleFinancialWriterVersion === 1/);});
