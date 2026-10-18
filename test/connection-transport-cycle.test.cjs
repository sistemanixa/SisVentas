'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),vm=require('node:vm');
const {create}=require('../js/core/connection-monitor');
async function until(condition){const limit=Date.now()+4000;while(!condition()){if(Date.now()>limit)throw Error('La lectura no se recuperó en el plazo de prueba');await new Promise(r=>setTimeout(r,5));}}

test('dos cortes reales de transporte loopback conservan datos y recuperan Ventas/Presupuestos con304 y luego cambios',async()=>{
 let version=1,reads=0,ready=0,restored=0,callbacks=0,errors=0;const records={};
 const server=http.createServer((req,res)=>{
  res.setHeader('Connection','close');
  if(req.url==='/probe'){res.writeHead(401);res.end();return;}
  assert.ok(/^\/comerciales\/(ventas|presupuestos)$/.test(req.url));reads++;
  const etag='"fixture-'+version+'"';res.setHeader('ETag',etag);
  if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,records:{ejemplo:{id:'FICTICIO',revision:version}}}));
 });
 const listen=port=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>{server.removeListener('error',reject);resolve();});});
 const close=()=>new Promise(resolve=>server.close(resolve));
 await listen(0);const port=server.address().port,base='http://127.0.0.1:'+port,events=new EventTarget(),document=new EventTarget();document.hidden=false;document.getElementById=()=>null;
 const user={uid:'fixture',getIdToken:async()=>'FICTICIO'};
 const root={navigator:{onLine:true},fbAuth:{currentUser:user},currentUserUid:user.uid,currentRole:'admin',SISVENTAS_FUNCTIONS:{cotizadorProveedor:base},addEventListener:events.addEventListener.bind(events),SVDataReadiness:{beginSource(){return {ready(){ready++;},error(){},cancel(){}};}}};
 const monitor=create({online:()=>true,probe:async()=>(await fetch(base+'/probe',{signal:AbortSignal.timeout(1000),cache:'no-store'})).status,lost:()=>events.dispatchEvent(new Event('sisventas:connection-lost')),restored:()=>{restored++;events.dispatchEvent(new Event('sisventas:connection-restored'));}});root.SVConnectionMonitor=monitor;
 vm.runInNewContext(fs.readFileSync('js/core/commercial-ownership.js','utf8'),{window:root,document,fetch,AbortController,AbortSignal,queueMicrotask,setInterval:()=>1,clearInterval(){},console:{warn(){}}});
 try{
  await monitor.check();assert.equal(monitor.view(true).label,'Sincronizado');
  for(const domain of ['ventas','presupuestos'])root.SVCommercialOwnership.onValue(domain,snapshot=>{records[domain]=snapshot.val();callbacks++;},()=>errors++);
  await until(()=>ready===2);assert.equal(callbacks,2);assert.equal(reads,2);
  for(let cycle=1;cycle<=2;cycle++){
   const before=JSON.stringify(records),readCount=reads,callbackCount=callbacks,readyCount=ready;
   await close();await monitor.check();assert.equal(monitor.view(true).label,'Sin conexión');assert.equal(monitor.canSync(),false);
   await Promise.all(['ventas','presupuestos'].map(d=>root.SVCommercialOwnership.refresh(d)));assert.equal(reads,readCount);assert.equal(JSON.stringify(records),before);assert.equal(callbacks,callbackCount);
   if(cycle===2)version=2;
   await listen(port);await monitor.check();await until(()=>ready===readyCount+2);
   assert.equal(restored,cycle);assert.equal(reads,readCount+2);assert.equal(errors,0);assert.equal(monitor.view(true).label,'Sincronizado');
   if(cycle===1){assert.equal(callbacks,callbackCount);assert.equal(JSON.stringify(records),before);}else{assert.equal(callbacks,callbackCount+2);for(const domain of ['ventas','presupuestos'])assert.equal(records[domain].ejemplo.revision,2);}
  }
 }finally{root.SVCommercialOwnership.stop();monitor.stop();if(server.listening)await close();}
});
