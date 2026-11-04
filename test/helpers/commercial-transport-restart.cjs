'use strict';
const http=require('node:http'),assert=require('node:assert/strict'),{start}=require('../fixtures/commercial-full-app.cjs');
const Admission=require('../../cotizador/commercial-admission'),{digest}=require('../../cotizador/labor-guard');
// The backend, guard and storage object never restart. Only this loopback HTTP
// listener is closed/recreated on the same port; this is not a process restart.
let sdkSequence=0;
async function create({sdkRulesHost,startFixture=start,createListener=http.createServer}={}){
 const inner=await startFixture({currentPrices:true});let listener=null;
 try{
 const state=inner.backend.state,origin=new URL(inner.url),attempts=[],checks=[];let port=null,paused=false,loseAck=false,epoch=0;
 const sdkChecks=[];let sdk=null;
 if(sdkRulesHost){
  assert.match(sdkRulesHost,/^127\.0\.0\.1:\d+$/);const base='http://'+sdkRulesHost,ns='demo-draft-sdk-'+process.pid+'-'+(++sdkSequence),Pause=require('../../scripts/lib/sdk-admission-pause-rules.cjs'),encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const url=path=>base+'/'+path+'.json?ns='+ns;
  const owner=async(method,path,value)=>{const response=await fetch(url(path),{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:value===undefined?undefined:JSON.stringify(value)});assert(response.ok);return response.json();};
  const rules={rules:{'.read':false,'.write':false,...Object.fromEntries(Pause.roots.map(name=>[name,{'.read':false,'.write':false}])),sv_labor_config:{'.read':false,'.write':'auth != null && auth.token.svLaborService === true'}}};rules.rules.sisventas.contadores={$counter:{'.read':"auth != null && auth.uid === 'u'",'.write':"auth != null && auth.uid === 'u'",'.validate':'newData.isNumber() && newData.val() > 0'}};
  await owner('PUT','.settings/rules',Pause.prepare(rules));await owner('PUT','',{sv_labor_config:{schema:1,ready:true,sdkAdmissionPaused:false}});
  sdk={namespace:ns,pause:async value=>{await owner('PUT','sv_labor_config/sdkAdmissionPaused',value);inner.backend.state.sv_labor_config.sdkAdmissionPaused=value;},read:()=>owner('GET','sisventas/contadores/venta'),async counter(command){assert(['sisventas/contadores/venta','sisventas/contadores/presupuesto'].includes(command.path));const before=await fetch(url(command.path),{headers:{Authorization:'Bearer owner','X-Firebase-ETag':'true'}}),value=await before.json();assert.equal(value,command.actual);const now=Math.floor(Date.now()/1000),token=encode({alg:'none',typ:'JWT'})+'.'+encode({iss:'https://securetoken.google.com/'+ns,aud:ns,sub:'u',user_id:'u',uid:'u',iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom'}})+'.',target=new URL(url(command.path));target.searchParams.set('auth',token);const response=await fetch(target,{method:'PUT',headers:{'Content-Type':'application/json','if-match':before.headers.get('etag')},body:JSON.stringify(command.next)});const errorText=await response.text();sdkChecks.push({epoch,status:response.status,actual:command.actual,next:command.next,paused:await owner('GET','sv_labor_config/sdkAdmissionPaused'),error:response.ok?null:errorText});return response.status;}};
 }
 const reply=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'private, no-store',Connection:'close'});res.end(JSON.stringify(body));};
 async function body(req){const chunks=[];let count=0;for await(const chunk of req){count+=chunk.length;if(count>1000000)throw Error('Fixture body limit');chunks.push(chunk);}return Buffer.concat(chunks);}
 async function handle(req,res){
  const pathname=new URL(req.url,'http://fixture').pathname;let bytes;
  try{
   if(req.method==='POST'){bytes=await body(req);if(pathname==='/laboral/escritura'){const command=JSON.parse(bytes);attempts.push({epoch,id:command.id,digest:digest(command),blocked:Admission.isPaused(paused?'true':undefined)});}}
   if(req.method==='POST'&&pathname==='/fixture-counter'&&sdk){const status=await sdk.counter(JSON.parse(bytes));if(status!==200)return reply(res,status,{ok:false,code:'FIXTURE_SDK_RULES_DENIED'});}
   // fixture-counter models the separate Firebase SDK transaction, not a
   // Cotizador route. Forward it unchanged instead of widening admission.
   if(Admission.isPaused(paused?'true':undefined)&&req.method==='POST'&&pathname!=='/fixture-counter'&&!Admission.allowsPausedRead(pathname)){
    if(pathname==='/laboral/operacion'){const value=JSON.parse(bytes),result=await Admission.resolveReadOnly({gateway:inner.backend.gateway,read:path=>inner.backend.store.read(path),req:{method:'POST',url:pathname,headers:req.headers},body:value});checks.push({epoch,id:value.id,digest:value.digest,status:result.status,paused:true});return reply(res,200,result);}
    return reply(res,503,{ok:false,code:'SV_COMMERCIAL_ADMISSION_PAUSED',retryable:true,mensaje:'Guardados temporalmente pausados. Conservá el formulario y reintentá.'});
   }
   const upstream=http.request({hostname:'127.0.0.1',port:origin.port,path:req.url,method:req.method,headers:{...req.headers,host:origin.host,connection:'close'}},response=>{
    const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>{const data=Buffer.concat(chunks);if(pathname==='/laboral/operacion'&&req.method==='POST'){const command=JSON.parse(bytes),result=JSON.parse(data);checks.push({epoch,id:command.id,digest:command.digest,status:result.status,paused:false});}
     if(pathname==='/laboral/escritura'&&response.statusCode===200&&loseAck){loseAck=false;res.destroy();return;}
     res.writeHead(response.statusCode,{...response.headers,connection:'close'});res.end(data);
    });
   });upstream.on('error',()=>{if(!res.headersSent)reply(res,503,{ok:false,code:'FIXTURE_TRANSPORT_UNAVAILABLE'});else res.destroy();});if(bytes)upstream.write(bytes);upstream.end();
  }catch(error){reply(res,error.statusCode||503,{ok:false,code:error.code||'FIXTURE_REQUEST_ERROR',mensaje:error.message});}
 }
 async function restart(){assert.equal(inner.backend.state,state);assert.equal(listener,null);listener=createListener(handle);await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(port||0,'127.0.0.1',resolve);});port=listener.address().port;epoch++;}
 async function stop(){if(!listener)return;const current=listener;listener=null;const closed=new Promise(resolve=>current.close(resolve));current.closeIdleConnections?.();await closed;}
 await restart();
 return {backend:inner.backend,state,url:'http://127.0.0.1:'+port,attempts,checks,sdkChecks,sdkNamespace:sdk?.namespace||null,listenersClosed:()=>listener===null&&!inner.server.listening,setSdkPaused:value=>{assert(sdk);return sdk.pause(value);},readSdkCounter:()=>{assert(sdk);return sdk.read();},pause:value=>{paused=value;},loseNextAck:()=>{loseAck=true;},stop,restart,epoch:()=>epoch,async close(){await stop();await new Promise(resolve=>inner.server.close(resolve));assert.equal(inner.backend.state,state);}};
 }catch(error){
  // No caller owns this partially-created fixture yet. Close only the two
  // listeners allocated here, even if validation, SDK setup or listen failed.
  for(const owned of [listener,inner.server])if(owned)await new Promise(resolve=>{try{owned.close(()=>resolve());owned.closeAllConnections?.();}catch(_){resolve();}});
  throw error;
 }
}
module.exports={create};
