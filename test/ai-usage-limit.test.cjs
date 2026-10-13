const test=require('node:test'),assert=require('node:assert/strict'),{reserve}=require('../cloud-functions/asistente/usage-limit.cjs');
function db(){let data;return {admin:{database:()=>({ref:path=>{assert.equal(path,'sv_server_ai_usage');return {transaction:async update=>{const next=update(data?structuredClone(data):null);if(next)data=next;return {committed:!!next};}}}})},read:()=>data};}
test('Cuota por identidad bloquea exceso, preserva otras cuentas y renueva ventanas',async()=>{const d=db(),env={AI_USER_WINDOW_LIMIT:2};await reserve({...d,uid:'a',now:1,env});await reserve({...d,uid:'a',now:2,env});await assert.rejects(reserve({...d,uid:'a',now:3,env}),{statusCode:429});await reserve({...d,uid:'b',now:4,env});await reserve({...d,uid:'a',now:600001,env});assert.equal(d.read().users.a.dayCount,3);});
test('Cuota global se comparte entre usuarios y el día nuevo retira contadores anteriores',async()=>{const d=db(),env={AI_GLOBAL_DAY_LIMIT:2};await reserve({...d,uid:'a',now:1,env});await reserve({...d,uid:'b',now:2,env});await assert.rejects(reserve({...d,uid:'c',now:600001,env}),{statusCode:429});await reserve({...d,uid:'c',now:86400001,env});assert.deepEqual(Object.keys(d.read().users),['c']);});
test('Falla de reserva impide llamar al proveedor',async()=>{const admin={database:()=>({ref:()=>({transaction:async()=>({committed:false})})})};await assert.rejects(reserve({admin,uid:'a'}),{statusCode:503});});

test('El manejador real reserva consumo antes de consultar IA y devuelve 429',async()=>{
 const vm=require('vm'),EventEmitter=require('events');let handler,providerCalls=0,reserved=0;
 const source=require('fs').readFileSync(require('path').join(__dirname,'../cloud-functions/asistente/index.js'),'utf8');
 const context={require:name=>name==='http'?{createServer:fn=>{handler=fn;return {listen:()=>{}};}}:name==='https'?{request:()=>{providerCalls++;throw Error('Proveedor no esperado');}}:name==='./admin.cjs'?{}:name==='./service-auth.cjs'?{authorize:async()=>({uid:'a'})}:name==='./usage-limit.cjs'?{reserve:async()=>{reserved++;const e=Error('Límite');e.statusCode=429;e.retryAfter=60;throw e;}}:null,process:{env:{}},Buffer,console};vm.runInNewContext(source,context);
 const req=new EventEmitter();req.method='POST';req.url='/';req.headers={};req.resume=()=>{};
 let complete;const done=new Promise(r=>complete=r),res={headers:{},setHeader:k=>{},writeHead:code=>{res.status=code;},end:body=>{res.body=body;complete();}};
 await handler(req,res);req.emit('data',Buffer.from(JSON.stringify({messages:[{role:'user',content:'Hola'}]})));req.emit('end');await done;assert.equal(res.status,429);assert.equal(reserved,1);assert.equal(providerCalls,0);
});
