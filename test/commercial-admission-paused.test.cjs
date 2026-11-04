'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Admission=require('../cotizador/commercial-admission'),{createLaborWriteGateway}=require('../cotizador/labor-write-gateway'),{createPrivateFinance}=require('../cotizador/private-finance');
const path=require('node:path'),{createRequire}=require('node:module');
const source=fs.readFileSync(require.resolve('../cotizador/index.js'),'utf8'),start=source.indexOf('http.createServer(')+'http.createServer('.length,end=source.indexOf('\n});',start)+2;
function fixture(flag,{receipt=null,enabled=true,active=true}={}){
 const calls={body:0,events:0,commits:0,privateSave:0,reads:[],business:0,auth:0};
 const auth={verifyIdToken:async(token,checkRevoked)=>{calls.auth++;assert.equal(checkRevoked,true);if(['expired','revoked'].includes(token))throw Error('invalid session');return {uid:token};}};
 const read=async path=>{calls.reads.push(path);if(path.startsWith('sv_chat_roles/'))return {activo:active,rol:'admin'};if(path.startsWith('sv_labor_receipts/'))return receipt;return null;};
 const db={ref:path=>({get:async()=>({val:()=>read(path)})})};
 // val is synchronous in the real SDK; this fake must return the resolved value.
 db.ref=path=>({get:async()=>{const value=await read(path);return {val:()=>value};}});
 const gateway=createLaborWriteGateway({auth,db,enabled,store:{},guard:{affects:()=>true,run:async()=>{calls.commits++;assert.fail('paused receipt lookup must never enter guard');}}});
 const privateFinance=createPrivateFinance({auth,db,enabled:true,ownerUid:'owner'});
 privateFinance.save=async()=>{calls.privateSave++;return {saved:true};};
 const service={handle:async()=>{calls.business++;return {statusCode:200,body:{ok:true}};}};
 const context={URL,commercialAdmission:Admission,commercialAdmissionPaused:Admission.isPaused(flag),laborWriteGateway:gateway,laborRuntime:{store:{read}},privateFinance,
  cors(req,res){res.setHeader('Access-Control-Allow-Origin','https://fixture.invalid');},send(res,status,body){res.status=status;res.body=body;},readBody:async req=>{calls.body++;return req.body;},
  commissionEvent:{handle:async()=>{calls.events++;return {status:'completed'};},probe:async()=>{calls.events++;return {status:'probe_received'};}},
  saleDeleteService:service,otDeleteService:service,purchaseDeleteService:service,
  commercialOwnership:{authorize:async()=>({}),list:async()=>({records:[]})},sendCommercial:async(req,res,body)=>{res.status=200;res.body=body;}};
 vm.createContext(context);const handler=vm.runInContext('('+source.slice(start,end)+')',context);
 async function request(url,{method='POST',token='owner',body={},headers={}}={}){const response={headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status){this.status=status;},end(){}};await handler({method,url,headers:{...(token?{authorization:'Bearer '+token}:{}),...headers},body,resume(){}},response);return response;}
 return {calls,request};
}
const lookup={id:'fixture-command',digest:'a'.repeat(64)};
test('absent and exact false preserve existing command and event dispatch',async()=>{for(const flag of [undefined,'false']){const f=fixture(flag);assert.equal((await f.request('/comerciales/ventas/eliminar')).status,200);assert.equal((await f.request('/internal/commission-event')).status,200);assert.equal(f.calls.business,1);assert.equal(f.calls.events,1);}});
test('invalid flag values fail closed instead of opening admission',async()=>{for(const flag of ['true','','FALSE','0',' true ',null,false]){const f=fixture(flag);assert.equal((await f.request('/comerciales/ventas/eliminar')).status,503);assert.equal(f.calls.business,0);assert.equal(f.calls.body,0);}});
test('common paused gate blocks mutations and POST reads before handlers or body parsing',async()=>{for(const url of ['/roles/guardar','/usuarios/guardar','/usuarios/acceso/temporal','/usuarios/acceso/correo','/usuarios/acceso/completar','/comerciales/ventas/eliminar','/comerciales/ventas/reasignar','/compras/ordenes/eliminar','/clientes/guardar','/laboral/escritura','/laboral/solicitar-gasto','/comisiones/redistribuir','/cuentas/preparar','/clientes/historial/','/chat/mensaje','/internal/commission-event','/internal/commission-event-probe','/unknown']){const f=fixture('true'),r=await f.request(url,{body:{SV_COMMERCIAL_ADMISSION_PAUSED:false,paused:false}});assert.equal(r.status,503,url);assert.equal(r.body.retryable,true);assert.equal(r.body.code,'SV_COMMERCIAL_ADMISSION_PAUSED');assert.equal(r.headers['Retry-After'],'5');assert.equal(f.calls.body+f.calls.events+f.calls.commits+f.calls.business+f.calls.auth,0);}});
test('OPTIONS keeps CORS and GET commercial listing remains unchanged while paused',async()=>{const f=fixture('true');for(const url of ['/internal/commission-event','/privado/finanzas/guardar','/roles/guardar']){const r=await f.request(url,{method:'OPTIONS'});assert.equal(r.status,204);assert.equal(r.headers['Access-Control-Allow-Origin'],'https://fixture.invalid');}assert.equal((await f.request('/comerciales/ventas',{method:'GET'})).status,200);assert.equal(f.calls.body+f.calls.events,0);});
test('private domain precedes admission but retains actual strict authorization',async()=>{const f=fixture('true');const allowed=await f.request('/privado/finanzas/guardar');assert.equal(allowed.status,200);assert.equal(f.calls.privateSave,1);for(const [token,headers,status]of [[null,{},401],['expired',{},401],['other',{},403],['owner',{'x-sisventas-view-as':'other'},403]]){const r=await f.request('/privado/finanzas/guardar',{token,headers,body:{uid:'owner'}});assert.equal(r.status,status);}assert.equal(f.calls.privateSave,1);const inactive=fixture('true',{active:false});assert.equal((await inactive.request('/privado/finanzas/guardar')).status,403);assert.equal(inactive.calls.privateSave,0);});
test('paused receipt recovery reads authenticated matching receipt with zero commits',async()=>{for(const [receipt,status]of [[{actorUid:'owner',digest:lookup.digest,result:{ok:true,committed:true}},'confirmed'],[{actorUid:'owner',digest:lookup.digest,result:{ok:false,committed:false}},'rejected'],[null,'pending'],[{actorUid:'owner',digest:lookup.digest,result:{}},'pending']]){const f=fixture('true',{receipt}),r=await f.request('/laboral/operacion',{body:lookup});assert.equal(r.status,200);assert.equal(r.body.status,status);assert.equal(f.calls.commits,0);assert.equal(f.calls.reads.filter(p=>p==='sv_labor_receipts/'+lookup.id).length,1);}});
test('paused recovery denies foreign receipt, mismatched digest, session, view-as and malformed bodies without commits',async()=>{for(const [options,request,status]of [[{receipt:{actorUid:'other',digest:lookup.digest}}, {body:lookup},409],[{receipt:{actorUid:'owner',digest:'b'.repeat(64)}},{body:lookup},409],[{}, {token:null,body:lookup},401],[{}, {token:'expired',body:lookup},401],[{active:false},{body:lookup},403],[{enabled:false},{body:lookup},503],[{}, {body:{...lookup,uid:'other'}},400],[{}, {body:{id:'bad',digest:lookup.digest}},400],[{}, {body:lookup},403]]){const f=fixture('true',options),url=status===403&&options.active!==false?'/laboral/operacion?verComo=other':'/laboral/operacion';assert.equal((await f.request(url,request)).status,status);assert.equal(f.calls.commits,0);}});
test('recovery exception is an exact path; trailing slash remains paused',async()=>{const f=fixture('true');for(const path of ['/laboral/operacion/','/laboral/operacion/other'])assert.equal((await f.request(path,{body:lookup})).status,503);assert.equal(f.calls.body,0);});
test('lookup denies revoked authentication before reading receipts and never returns payload or amounts',async()=>{
 const f=fixture('true',{receipt:{actorUid:'owner',digest:lookup.digest,result:{ok:true,committed:true,total:123456,privatePayload:'fictional confidential result'}}});
 const denied=await f.request('/laboral/operacion',{token:'revoked',body:lookup});assert.equal(denied.status,401);assert.equal(f.calls.reads.length,0);
 const response=await f.request('/laboral/operacion',{body:lookup});assert.deepEqual(Object.keys(response.body).sort(),['ok','status']);assert.equal(JSON.stringify(response.body),'{"ok":true,"status":"confirmed"}');assert.equal(f.calls.commits,0);
});
test('server-authorized view-as context is denied before any private receipt read',async()=>{
 for(const context of [{viewing:true},{_viewAs:true},{realUid:'another-user'}]){
  let reads=0;await assert.rejects(Admission.resolveReadOnly({gateway:{authorize:async()=>({uid:'owner',claims:{uid:'owner'},...context})},read:async()=>{reads++;assert.fail('No private read');},req:{},body:lookup}),{statusCode:403});assert.equal(reads,0);
 }
});
test('equal real UID is allowed only from the authorized actor and body cannot supply context',async()=>{
 let reads=0;const options={gateway:{authorize:async()=>({uid:'owner',claims:{uid:'owner'},realUid:'owner'})},read:async()=>{reads++;return null;},req:{},body:lookup};
 assert.equal((await Admission.resolveReadOnly(options)).status,'pending');assert.equal(reads,1);
 await assert.rejects(Admission.resolveReadOnly({...options,body:{...lookup,actor:{uid:'owner'}}}),{statusCode:400});assert.equal(reads,1);
});
test('real module bootstrap binds mandatory admission from revision flag and Docker includes helper',async()=>{
 const ownRequire=createRequire(path.resolve('cotizador/index.js'));
 for(const flag of ['true','invalid',undefined,'false']){
  let handler;const db={ref(){assert.fail('No database access during admission test');}};
  function requireForTest(name){if(name==='http')return {createServer:fn=>{handler=fn;return {listen:()=>assert.fail('No listener')};}};if(name==='firebase-admin')return {apps:[{}],database:()=>db,app:()=>({options:{credential:{getAccessToken:async()=>assert.fail('No credentials')}}})};return ownRequire(name);}
  const env=flag===undefined?{}:{SV_COMMERCIAL_ADMISSION_PAUSED:flag};
  const context={require:requireForTest,module:{exports:{}},process:{env},console:{log(){},warn(){},error(){}},Buffer,URL,URLSearchParams,AbortSignal,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,fetch:()=>assert.fail('No network')};
  vm.runInNewContext(source,context);
  let status,body;const response={setHeader(){},writeHead(code){status=code;},end(value){body=value;}};
  await handler({method:'POST',url:'/roles/guardar',headers:{},on(){assert.fail('No body parse');}},response);
  if(flag==='true'||flag==='invalid'){assert.equal(status,503);assert.equal(JSON.parse(body).code,'SV_COMMERCIAL_ADMISSION_PAUSED');}
  else {assert.equal(status,401);assert.notEqual(JSON.parse(body).code,'SV_COMMERCIAL_ADMISSION_PAUSED');}
 }
 const docker=fs.readFileSync(require.resolve('../cotizador/Dockerfile'),'utf8');assert.match(docker,/^COPY commercial-admission\.js \.\//m);
});
