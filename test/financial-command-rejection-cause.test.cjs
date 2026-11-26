'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {create:createCommands}=require('../js/core/financial-commands');
const {create:createRecovery}=require('../js/core/labor-write-recovery');
const reply=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(body),body:{async cancel(){}}});
async function until(check){const deadline=performance.now()+2000;while(!check()){assert(performance.now()<deadline,'Expected recovery state');await new Promise(setImmediate);}}
function fixture({status=401,code,message='La sesión venció; volvé a ingresar',commit=false,transport=false}={}){
 const storage=new Map(),calls=[],receipts=new Map();let attempts=0,effects=0;
 const root={currentUserUid:'u',currentRole:'admin',fbAuth:{currentUser:{uid:'u'}},PERMISOS_ROLES:{admin:{indiceRevision:1}},crypto:{subtle:crypto.webcrypto.subtle,randomUUID:()=> '00000000-0000-4000-8000-000000000001'},navigator:{onLine:true},SISVENTAS_FUNCTIONS:{cotizadorProveedor:'https://fixture.invalid'},SVServiceAuth:{headers:async h=>h},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  async fetch(url,options){const body=JSON.parse(options.body);calls.push({url,body});
   if(url.endsWith('/laboral/capacidades'))return reply({ok:true,payments:{enabled:true,version:1},adminExpense:{enabled:true,version:1},saleDelete:{enabled:true,version:1}});
   if(url.endsWith('/laboral/operacion'))return reply({ok:true,status:receipts.has(body.id)?'confirmed':'rejected'});
   assert(url.endsWith('/comerciales/ventas/eliminar'));attempts++;
   if(attempts===1){if(commit){effects++;receipts.set(body.id,structuredClone(body));}if(transport)throw Object.assign(Error(message),{name:'TimeoutError'});return reply({ok:false,mensaje:message,...(code?{code}:{})},status);}
   assert.deepEqual(body,receipts.get(body.id),'Confirmed hydration replays the exact operation');return reply({ok:true,committed:true,ventaKey:body.ventaKey});
  }
 };
 root.SVLaborWriteRecovery=createRecovery(root);root.SVFinancialCommands=createCommands(root);
 return {root,calls,storage,get effects(){return effects;},get attempts(){return attempts;}};
}
const sale=()=>({fbKey:'sale-fixture',id:'V-FICTICIA',total:7});
for(const status of [401,403,503])test('uncertain untyped HTTP '+status+' keeps the original cause only after rejected receipt',async()=>{
 const f=fixture({status}),run=f.root.SVFinancialCommands.deleteSale('sale-fixture',sale());let done=false;run.finally(()=>{done=true;}).catch(()=>{});
 const rejected=assert.rejects(run,error=>error.message==='La sesión venció; volvé a ingresar'&&error.code==='SV_LABOR_REJECTED'&&error.cause.statusCode===status&&error.cause.code==='SV_LABOR_COMMIT_UNCONFIRMED');
 await until(()=>f.root.SVLaborWriteRecovery.state());assert.equal(done,false);assert.equal(f.attempts,1);assert.equal(f.calls.filter(c=>c.url.endsWith('/laboral/operacion')).length,0);
 const metadata=JSON.parse(f.storage.get(f.root.SVLaborWriteRecovery.STORAGE_KEY));assert.deepEqual(Object.keys(metadata[0]).sort(),['digest','id','uid']);assert(!JSON.stringify(metadata).includes('sesión'));
 assert.deepEqual(await f.root.SVLaborWriteRecovery.check(),{status:'rejected'});await rejected;assert.equal(f.effects,0);assert.equal(f.attempts,1);assert.equal(f.storage.size,0);
});
test('postcommit auth failure remains uncertain and confirmed receipt preserves exactly one effect',async()=>{
 const f=fixture({status:401,commit:true}),run=f.root.SVFinancialCommands.deleteSale('sale-fixture',sale());await until(()=>f.root.SVLaborWriteRecovery.state());assert.equal(f.effects,1);assert.equal(f.attempts,1);
 assert.deepEqual(await f.root.SVLaborWriteRecovery.check(),{status:'confirmed'});assert.deepEqual(await run,{ventaKey:'sale-fixture'});assert.equal(f.effects,1);assert.equal(f.attempts,2);assert.equal(f.storage.size,0);
});
test('transport timeout is not retried and its original cause survives a definitive rejection',async()=>{
 const f=fixture({transport:true,message:'Tiempo de espera agotado'}),run=f.root.SVFinancialCommands.deleteSale('sale-fixture',sale()),rejected=assert.rejects(run,error=>error.code==='SV_LABOR_REJECTED'&&error.message==='Tiempo de espera agotado'&&error.cause.name==='TimeoutError');
 await until(()=>f.root.SVLaborWriteRecovery.state());assert.equal(f.attempts,1);await f.root.SVLaborWriteRecovery.check();await rejected;assert.equal(f.attempts,1);assert.equal(f.effects,0);
});
test('explicit precommit denial remains definitive without operation consultation',async()=>{
 const f=fixture({status:403,code:'SV_SALE_DELETE_AUTH',message:'Sin permiso'});
 await assert.rejects(f.root.SVFinancialCommands.deleteSale('sale-fixture',sale()),{code:'SV_SALE_DELETE_AUTH',message:'Sin permiso'});assert.equal(f.root.SVLaborWriteRecovery.state(),null);assert.equal(f.attempts,1);assert.equal(f.storage.size,0);assert.equal(f.calls.filter(c=>c.url.endsWith('/laboral/operacion')).length,0);
});
test('reload persists no original error and conservatively uses the explicit receipt result',async()=>{
 const f=fixture(),run=f.root.SVFinancialCommands.deleteSale('sale-fixture',sale()),rejected=assert.rejects(run,{code:'SV_LABOR_SESSION'});await until(()=>f.root.SVLaborWriteRecovery.state());f.root.SVLaborWriteRecovery.clear();await rejected;
 const restored=createRecovery(f.root);assert(restored.restore());assert.deepEqual(await restored.check(),{status:'rejected'});assert.equal(restored.state(),null);assert.equal(f.storage.size,0);assert.equal(f.attempts,1);
});
