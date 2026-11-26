'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {createLaborGuard,digest}=require('../cotizador/labor-guard'),{createLaborRuntime}=require('../cotizador/labor-runtime');

test('sale activity routing is an explicit complete runtime opt-in and its readiness cannot be overwritten',()=>{
 const store={read:async()=>null,acquire:async()=>{},commit:async()=>{},abort:async()=>{}},flags={store,clientAccounts:true,commercialPages:true,clientHistory:true,saleFinancialDependencies:true};
 const ordinary=createLaborGuard(flags),active=createLaborGuard({...flags,saleDeleteActivity:true});
 for(const domain of ['agenda','ordenes','listas_materiales','remitos','equipos','tickets','ordenesTrabajo'])assert.equal(active.affects('sisventas/'+domain+'/r'),true);
 assert.equal(ordinary.affects('sisventas/agenda/r'),false);assert.equal(active.affects('sisventas/productos/r'),false);
 assert.throws(()=>createLaborGuard({...flags,clientAccounts:false,saleDeleteActivity:true}),/proyecciones coordinadas/);
 const runtime=createLaborRuntime({db:{},databaseURL:'http://127.0.0.1:1',accessToken:async()=>'',enabled:true,...Object.fromEntries(Object.entries(flags).filter(([name])=>name!=='store')),saleDeleteActivity:true});
 assert.equal(runtime.guard.saleDeleteActivity,true);assert.equal(runtime.store.saleDeleteActivityFenceReady,true);
 assert.throws(()=>{runtime.store.saleDeleteActivityFenceReady=false;},TypeError);
});
test('circuito acotado no puede arrancar con el observador periódico habilitado',()=>{
 const source=fs.readFileSync(require.resolve('../cotizador/index.js'),'utf8'),start=source.indexOf('const laborScopedEnabled='),end=source.indexOf('const laborRuntime=',start),policy=source.slice(start,end);assert.ok(start>=0&&end>start);
 assert.throws(()=>vm.runInNewContext(policy,{process:{env:{LABOR_SCOPED_ENABLED:'true',COMMISSION_OBSERVER_ENABLED:'true'}}}),/observador periódico apagado/);
 for(const flags of [{LABOR_SCOPED_ENABLED:'true',COMMISSION_OBSERVER_ENABLED:'false'},{LABOR_SCOPED_ENABLED:'false',COMMISSION_OBSERVER_ENABLED:'true'}])assert.doesNotThrow(()=>vm.runInNewContext(policy,{process:{env:flags}}));
});
test('modo de revisión conserva circuito y lecturas: no cae a root ni confirma escrituras financieras',async()=>{
 assert.throws(()=>createLaborRuntime({readOnly:true,enabled:false}),/conservar el circuito/);
 const calls=[],store={read:async path=>{calls.push('read:'+path);return path==='sv_labor_config'?{ready:true,schema:1}:null;},acquire:async()=>calls.push('acquire'),commit:async()=>calls.push('commit'),abort:async()=>calls.push('abort')};
 const guard=createLaborGuard({store,readOnly:true});for(const mode of ['user','server','command','bootstrap'])await assert.rejects(guard.run({uid:'u',mode,operation:'write'},()=>assert.fail('No iniciar el plan')),e=>e.code==='SV_LABOR_READ_ONLY');assert.equal(calls.length,0);
 const result=await guard.run({uid:'u',mode:'user',operation:'resolve',opId:'resolve-operation',transportDigest:digest('fixture')},async()=>({ok:false,committed:false}));assert.equal(result.committed,false);assert.ok(calls.includes('commit'));
});
