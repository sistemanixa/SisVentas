'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {decide,suspend,services,database}=require('../cloud-functions/cost-guard/policy.cjs');
const config={billingAccountId:'FAKE-ACCOUNT',budgetId:'FAKE-BUDGET',now:new Date('2026-11-18T15:00:00Z')};
const message=fields=>({attributes:{billingAccountId:config.billingAccountId,budgetId:config.budgetId,schemaVersion:'1.0'},data:Buffer.from(JSON.stringify({currencyCode:'USD',budgetAmountType:'SPECIFIED_AMOUNT',budgetAmount:60,costAmount:60,costIntervalStart:'2026-11-01T07:00:00Z',...fields})).toString('base64')});
test('corte mensual fijo:59.99 no actúa;60 o más pide suspensión',()=>{assert.equal(decide(message({costAmount:59.99}),config).pause,false);for(const costAmount of [60,100])assert.equal(decide(message({costAmount}),config).pause,true);});
test('octubre queda operativo, no actúa por un período anterior, futuro o mensaje ajeno',()=>{
 assert.equal(decide(message({costIntervalStart:'2026-10-01T07:00:00Z',costAmount:100}),{...config,now:new Date('2026-10-18T15:00:00Z')}).pause,false);
 for(const costIntervalStart of ['2026-10-01T07:00:00Z','2026-12-01T08:00:00Z','inválido'])assert.equal(decide(message({costIntervalStart}),config).pause,false);
 const wrong=message({});wrong.attributes.budgetId='OTHER';assert.equal(decide(wrong,config).pause,false);
});
test('un aviso previsto no corta si el costo real sigue bajo el umbral; datos inválidos no ejecutan',()=>{
 assert.equal(decide(message({costAmount:20,forecastThresholdExceeded:1}),config).pause,false);
 for(const fields of [{currencyCode:'ARS'},{costAmount:'100'},{costAmount:-1},{budgetAmount:30},{budgetAmountType:'LAST_MONTH_COST'}])assert.equal(decide(message(fields),config).pause,false);
 assert.equal(decide({attributes:message({}).attributes,data:'not-json'},config).pause,false);assert.throws(()=>decide(message({})),/Configurar/);
});
test('suspensión usa únicamente deshabilitar base y escalar servicios a cero, sin borrar, ni desvincular facturación',async()=>{
 const calls=[],logs=[],paused=new Set();await suspend({logger:entry=>logs.push(entry),request:async options=>{calls.push(options);const resource=options.url.split('?')[0];if(options.method==='PATCH'){paused.add(resource);return {data:{}};}return {data:options.url.includes('firebasedatabase')?{state:options.method==='POST'?'DISABLED':'ACTIVE'}:paused.has(resource)?{scaling:{manualInstanceCount:0,scalingMode:'MANUAL'},traffic:[{revision:'current',percent:100}]}:{traffic:[{type:'TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION',revision:'current',percent:100},{revision:'old',tag:'test-access',percent:0}],env:[{name:'DO_NOT_LOG',value:'FAKE_SECRET'}]}};}});
 assert.equal(calls.filter(c=>c.method==='POST').length,1);assert.ok(calls.find(c=>c.url.endsWith(database+':disable')));
 const patches=calls.filter(c=>c.method==='PATCH');assert.equal(patches.length,services.length);
 for(const call of patches){assert.equal(call.data.scaling.manualInstanceCount,0);assert.equal(call.data.traffic.length,1);assert.equal(call.data.traffic[0].tag,undefined);}
 assert.doesNotMatch(JSON.stringify(calls),/billingAccounts|DELETE/);assert.doesNotMatch(JSON.stringify(logs),/FAKE_SECRET|DO_NOT_LOG/);
});
test('repetir un corte confirmado no vuelve a modificar recursos; un fallo de un servidor no omite los demás',async()=>{
 let changes=0;await suspend({request:async options=>{if(options.method!=='GET')changes++;return {data:options.url.includes('firebasedatabase')?{state:'DISABLED'}:{scaling:{scalingMode:'MANUAL',manualInstanceCount:0},traffic:[]}};}});assert.equal(changes,0);
 const visited=[];await assert.rejects(suspend({request:async options=>{if(options.method==='GET'){visited.push(options.url);if(options.url.includes('/cotizador'))throw Error('Fallo ficticio');}return {data:options.url.includes('firebasedatabase')?{state:'DISABLED'}:{traffic:[{percent:100,revision:'r'}]}};}}),/cotizador/);assert.equal(new Set(visited.filter(url=>url.includes('run.googleapis.com'))).size,4);
});
test('espera operaciones remotas y comprueba la escala antes de anunciar la suspensión',async()=>{
 const paused=new Set(),operations=new Map();let waits=0;
 await suspend({sleep:async()=>{waits++;},request:async options=>{
  const url=options.url.split('?')[0];if(url.includes('firebasedatabase'))return {data:{state:'DISABLED'}};
  if(url.includes('/operations/')){const count=(operations.get(url)||0)+1;operations.set(url,count);return {data:{name:url.replace('https://run.googleapis.com/v2/',''),done:count===2}};}
  if(options.method==='PATCH'){paused.add(url);return {data:{name:'projects/nixa-sisventas/locations/southamerica-east1/operations/'+url.split('/').at(-1),done:false}};}
  return {data:paused.has(url)?{scaling:{scalingMode:'MANUAL',manualInstanceCount:0},traffic:[{percent:100,revision:'r'}]}:{traffic:[{percent:100,revision:'r'}]}};
 }});assert.equal(waits,8);assert.equal(operations.size,4);
});
test('no confirma corte si la base no confirma su estado; fecha inicial de noviembre usa mes de facturación',async()=>{
 await assert.rejects(suspend({request:async()=>({data:{state:'ACTIVE'}})}),/No se confirmó la suspensión de la base/);
 assert.equal(decide(message({}),{...config,now:new Date('2026-11-01T06:59:00Z')}).pause,false);
 assert.equal(decide(message({}),{...config,now:new Date('2026-11-01T07:01:00Z')}).pause,true);
});
