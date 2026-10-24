'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module'),{EventEmitter}=require('node:events');
const P=require('../cotizador/commission-public-response'),{memoryDB}=require('./helpers/private-finance-fixtures.cjs');
const CANARY='PRIVATE_FINANCIAL_CANARY';
function poison(status='lista'){
 const secret={base:{ganancia:CANARY,costo:CANARY},costos:[{pct:CANARY}],descripcion:CANARY};
 return {ok:CANARY,status,motivo:CANARY,ventaId:'V-FICTICIA',ventaFbKey:'sale',cliente:{ganancia:CANARY},digest:'a'.repeat(64),reutilizada:true,total:991,cobrado:991,base:secret,gananciaBase:991,costoTotal:991,
  participantes:[{empleadoFbKey:'employee',nombre:'Persona ficticia',monto:12.345000000000002,pct:99,pctOriginal:100,gananciaBase:991,extra:secret},null,{empleadoFbKey:{value:CANARY},nombre:CANARY,monto:9}],
  faltantes:[{indice:2,codigo:'P-FICTICIO',descripcion:CANARY,cantidad:991,gananciaBase:991,extra:secret}],extra:secret};
}
const forbidden=new Set(['base','ganancia','gananciaBase','costo','costoTotal','costos','costoOriginal','margen','pct','pctOriginal','porcentaje','descripcion','extra','total','cobrado']);
function noPrivate(value){if(value&&typeof value==='object')for(const[key,child]of Object.entries(value)){assert.ok(!forbidden.has(key),key);noPrivate(child);}assert.ok(!JSON.stringify(value).includes(CANARY));}
test('allowlist omits nested secrets, preserves amount exactly and never changes source',()=>{
 const value=poison(),before=JSON.stringify(value),got=P.response(value);noPrivate(got);
 assert.deepEqual(got,{status:'lista',motivo:'Revisá el estado de la comisión.',ventaId:'V-FICTICIA',ventaFbKey:'sale',reutilizada:true,digest:'a'.repeat(64),participantes:[{empleadoFbKey:'employee',nombre:'Persona ficticia',monto:12.345000000000002}],faltantes:[{indice:2,codigo:'P-FICTICIO'}]});
 assert.equal(JSON.stringify(value),before);
});
for(const status of ['lista','generada','existente','revision','no_aplica','pendiente_cobro','historica','procesando','pendiente_confirmacion'])test('safe response retains operation status '+status,()=>{const got=P.response(poison(status));assert.equal(got.status,status);assert.equal(got.reutilizada,true);assert.equal(got.participantes[0].monto,12.345000000000002);noPrivate(got);});
test('missing original data keeps item code and neutral useful diagnosis without costs or item free text',()=>{
 const got=P.response({status:'revision',motivo:'Faltan costos originales; no se usa el catálogo actual',faltantes:[{codigo:'P-LEGACY',indice:0,descripcion:CANARY,costo:1}]});
 assert.equal(got.motivo,'Falta verificar información original de los ítems indicados');assert.deepEqual(got.faltantes,[{indice:0,codigo:'P-LEGACY'}]);noPrivate(got);
});
test('unknown statuses, false fields, malformed identities and invalid amounts cannot expand response',()=>{
 for(const value of [null,[],{status:CANARY,base:{secret:CANARY}},{status:'revision',digest:CANARY,reutilizada:CANARY,participantes:[{empleadoFbKey:'e',monto:Infinity,pct:3},{empleadoFbKey:'e2',monto:NaN},{empleadoFbKey:'e3',monto:-1}]}]){
  const got=P.response(value);noPrivate(got);assert.equal(got.status,'revision');assert.equal(got.digest,undefined);
 }
 const got=P.response({status:'generada',participantes:[{empleadoFbKey:'e',nombre:{secret:CANARY},monto:0}]});assert.deepEqual(got.participantes,[{empleadoFbKey:'e',monto:0}]);
});
test('neutral future description uses structured sale/client only and never formula or note fields',()=>{
 assert.equal(P.description('#V-FICTICIA','Cliente ficticio'),'Comisión venta #V-FICTICIA · Cliente ficticio');
 assert.equal(P.description('V-FICTICIA','Cliente ficticio',{pct:99,gananciaBase:CANARY,nota:CANARY}),'Comisión venta #V-FICTICIA · Cliente ficticio');
 assert.equal(P.description({secret:CANARY},{secret:CANARY}),'Comisión venta sin identificar');
});
test('safe error keeps exact busy marker and status-relevant categories without arbitrary financial text',()=>{
 const busy='La comisión se está generando en otra sesión. Reintentá';assert.equal(P.errorMessage({statusCode:409,message:busy}),busy);
 for(const statusCode of [400,401,403,404,409,500,503])assert.ok(!P.errorMessage({statusCode,message:CANARY+' ganancia $991'}).includes(CANARY));
});
function handlerFixture(role='vendedor',result=poison()){
 const db=memoryDB({}),calls=[];let handler,fail=null;
 const ownRequire=createRequire(path.resolve('cotizador/index.js'));
 const service={authorize:async()=>{calls.push('authorize');if(fail)throw fail;return {uid:'fixture-user',role};},inspect:async(actor,id)=>{calls.push(['inspect',actor.role,id]);return result;},generate:async(actor,body)=>{calls.push(['generate',actor.role,body]);return result;},systemGenerate:()=>assert.fail('No system generation'),retryPending:()=>assert.fail('No retry'),start:()=>assert.fail('No observer')};
 function requireFixture(name){
  if(name==='firebase-admin')return {apps:[{}],database:()=>db,app:()=>({options:{credential:{getAccessToken:async()=>assert.fail('No credentials')}}})};
  if(name==='http')return {createServer:fn=>{handler=fn;return {listen:()=>assert.fail('No sockets')};}};
  if(name==='./commission-generation')return {createCommissionGeneration:()=>service};
  return ownRequire(name);
 }
 const context={require:requireFixture,module:{exports:{}},process:{env:{}},console:{log(){},warn(){},error(){}},Buffer,URL,URLSearchParams,AbortSignal,AbortController,setTimeout,clearTimeout,setInterval:()=>assert.fail('No clocks'),clearInterval,fetch:()=>assert.fail('No network')};
 vm.runInNewContext(fs.readFileSync('cotizador/index.js','utf8'),context);
 async function request(action,method='POST'){
  const req=new EventEmitter();req.method=method;req.url='/comisiones/generacion/'+action;req.headers={authorization:'Bearer FICTITIOUS'};req.destroy=()=>{};let status,data;const headers={};
  const res={setHeader:(key,value)=>headers[key]=value,writeHead:(code)=>status=code,end:value=>data=JSON.parse(value)};
  const pending=handler(req,res);setImmediate(()=>{req.emit('data',Buffer.from(JSON.stringify({ventaFbKey:'sale'})));req.emit('end');});await pending;return {status,data,headers};
 }
 return {request,calls,result,error(value){fail=value;}};
}
for(const role of ['admin','administrativo','vendedor','tecnico_vendedor','tecnico'])for(const action of ['revisar','generar'])test('actual HTTP route '+action+' redacts for '+role+' after authorization',async()=>{
 const f=handlerFixture(role),before=JSON.stringify(f.result),got=await f.request(action);assert.equal(got.status,200);assert.equal(got.data.ok,true);noPrivate(got.data);assert.equal(got.headers['Cache-Control'],'private, no-store');assert.equal(got.data.participantes[0].monto,f.result.participantes[0].monto);assert.equal(JSON.stringify(f.result),before);assert.equal(f.calls[0],'authorize');assert.equal(f.calls[1][0],action==='revisar'?'inspect':'generate');assert.equal(f.calls[1][1],role);
});
test('actual generation HTTP errors preserve 409 busy distinction and hide unknown error payload',async()=>{
 const f=handlerFixture();f.error(Object.assign(Error(CANARY+' ganancia $991'),{statusCode:409}));let got=await f.request('generar');assert.equal(got.status,409);assert.equal(got.data.ok,false);assert.ok(!JSON.stringify(got).includes(CANARY));
 const busy='La comisión se está generando en otra sesión. Reintentá';f.error(Object.assign(Error(busy),{statusCode:409}));got=await f.request('revisar');assert.equal(got.data.mensaje,busy);
});
test('actual HTTP method guard does not call authorization or generation',async()=>{const f=handlerFixture();const got=await f.request('generar','GET');assert.equal(got.status,405);assert.deepEqual(f.calls,[]);});
test('new runtime helper is part of Docker package',()=>{assert.match(fs.readFileSync('cotizador/Dockerfile','utf8'),/COPY commission-calculations\.js commission-operations\.js commission-public-response\.js \.\//);});
