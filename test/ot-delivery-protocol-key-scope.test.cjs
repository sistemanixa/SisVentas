'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),Protocol=require('../cotizador/ot-delivery-commit-protocol'),{createLaborRtdbStore}=require('../cotizador/labor-rtdb-store'),{createBackend,apply}=require('./helpers/labor-ui-flow.cjs');
const lease={actorUid:'server',opId:'key-scope-fixture'},actor={uid:'server',mode:'server',operation:'prototype-query'};
for(const path of ['sisventas/gastos/__proto__','sisventas/gastos/constructor','sisventas/gastos/g/prototype','sisventas/ordenes_trabajo_shadow/__proto__'])test('OT protocol leaves valid non-OT key to its own writer: '+path,async()=>{
 let reads=0;const patch=Object.fromEntries([[path,{monto:1}]]),result=await Protocol.claims({patch,lease,actor,read:async()=>{reads++;throw Error('OT read outside its scope');}});assert.equal(result.svOTDeliveryUnchanged,true);assert.equal(reads,0);assert.equal(Object.hasOwn(patch,path),true);assert.equal(Object.getPrototypeOf(patch),Object.prototype);
});
for(const path of ['sisventas/ordenes_trabajo/__proto__','sisventas/ordenes_trabajo/O1/materiales/__proto__','sisventas/ordenes_trabajo/O1/constructor/prototype'])test('OT reserved segment still rejects atomically: '+path,async()=>{
 const patch=Object.fromEntries([['sisventas/gastos/__proto__',{monto:1}],[path,{entregada:1}]]);let reads=0;await assert.rejects(Protocol.claims({patch,lease,actor,read:async()=>{reads++;return null;}}),{code:'SV_OT_DELIVERY_PROTOCOL'});assert.equal(reads,0);assert.equal(Object.hasOwn(Object.prototype,'entregada'),false);
});
test('real guard and REST store persist staged Gasto __proto__ and exact query with own properties only',async()=>{
 const f=createBackend({gastos:{}}),calls=[],prototypeBefore=Object.getOwnPropertyDescriptors(Object.prototype);
 const wire=createLaborRtdbStore({databaseURL:'https://fixture.invalid/',accessToken:async()=>'fixture-only',fetchImpl:async(url,options)=>{
  const u=new URL(url),path=decodeURIComponent(u.pathname).replace(/^\//,'').replace(/\.json$/,'');calls.push({path,method:options.method});
  if(options.method==='GET'){let value=f.get(path);if(u.searchParams.has('orderBy')){const field=JSON.parse(u.searchParams.get('orderBy')),wanted=JSON.parse(u.searchParams.get('equalTo'));value=Object.fromEntries(Object.entries(value||{}).filter(([,r])=>r[field]===wanted));}return new Response(JSON.stringify(value),{status:200});}
  assert.equal(options.method,'PATCH');const patch=JSON.parse(options.body),token=JSON.parse(u.searchParams.get('auth_variable_override')).token;assert.equal(token.svOTDeliveryUnchanged,true);f.commits.push(structuredClone(patch));apply(f.state,patch);return new Response('',{status:200});
 }});
 f.store.commit=wire.commit;f.store.query=wire.query;
 await f.guard.run(actor,async scope=>{await scope.update({'sisventas/gastos/__proto__':{ventaFbKey:'prototype_demo',monto:1}});const rows=await scope.query('sisventas/gastos','ventaFbKey','prototype_demo');assert.equal(Object.hasOwn(rows,'__proto__'),true);assert.equal(rows.__proto__.monto,1);return{done:true};});
 const saved=f.get('sisventas/gastos');assert.equal(Object.hasOwn(saved,'__proto__'),true);assert.equal(saved.__proto__.monto,1);assert.equal(Object.getPrototypeOf(saved),Object.prototype);const queried=await wire.query('sisventas/gastos','ventaFbKey','prototype_demo');assert.equal(Object.hasOwn(queried,'__proto__'),true);assert.equal(queried.__proto__.monto,1);assert.equal(Object.getPrototypeOf(queried),Object.prototype);assert.equal(calls.filter(c=>c.method==='PATCH').length,1);assert.equal(f.commits.length,1);assert.deepEqual(Object.getOwnPropertyDescriptors(Object.prototype),prototypeBefore);assert.equal(({}).monto,undefined);
});
