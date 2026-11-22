'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),vm=require('node:vm');
const {createCoordinatedBackend}=require('./helpers/coordinated-backend.cjs'),{apply}=require('./helpers/labor-ui-flow.cjs'),{digest}=require('../cotizador/labor-guard');
test('actual local HTTP uncertain delete and identical retry commit exactly once without stock adjustment',async()=>{
 const original={id:'OT-SYNTHETIC',clienteFbKey:'c',responsableUid:'u',materiales:[]},backend=await createCoordinatedBackend({ordenes_trabajo:{ot:original},inventario_operativo:{sentinel:{general:8,reservado:2,consumido:1}},pagos:{sentinel:{monto:50}},comisiones:{sentinel:{monto:5}}});
 apply(backend.state,{'sv_permisos/admin':{indiceVersion:2,indiceModulos:{ordentrabajo:true},acciones:{ot:{eliminar:true}}}});backend.store.otDeleteFenceReady=true;
 const adapter=require('../cotizador/ot-delete-http-adapter').createOTDeleteHttpAdapter({enabled:true,guard:backend.guard,store:backend.store,authorize:async()=>({uid:'u',claims:{uid:'u'}})});
 let loseAck=true,calls=0;const source=fs.readFileSync(require.resolve('../cotizador/index.js'),'utf8'),start=source.indexOf('http.createServer(')+'http.createServer('.length,end=source.indexOf('\n});',start)+2;
 const scope={URL,commercialAdmissionPaused:false,cors(){},send(res,status,body){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));},readBody:async(req,limit)=>{let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>limit)throw Object.assign(Error('Body too large'),{statusCode:413});}return JSON.parse(text);},otDeleteService:{handle:async(req,body)=>{calls++;const result=await adapter.handle(req,body);if(loseAck){loseAck=false;throw Object.assign(Error('PRIVATE_TRANSPORT_DIAGNOSTIC'),{statusCode:503,code:'SV_LABOR_UNCERTAIN'});}return result;}}};
 vm.createContext(scope);const handler=vm.runInContext('('+source.slice(start,end)+')',scope),server=http.createServer(handler);let url;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port+'/operaciones/ot/eliminar';const body={id:'synthetic-delete-ack',otKey:'ot',expectedHash:digest(original)},before=backend.get('sisventas');
  const post=()=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const uncertain=await post(),reply=await uncertain.json();assert.equal(uncertain.status,503);assert.match(reply.mensaje,/Consultá la operación/);assert.doesNotMatch(JSON.stringify(reply),/PRIVATE_TRANSPORT_DIAGNOSTIC/);assert.equal(reply.committed,undefined);assert.equal(reply.svLaborAttempted,undefined);assert.equal(backend.commits.length,1);
  const replay=await post(),confirmed=await replay.json();assert.equal(replay.status,200);assert.equal(confirmed.committed,true);assert.equal(confirmed.otKey,'ot');assert.equal(calls,2);assert.equal(backend.commits.length,1);assert.equal(backend.get('sisventas/ordenes_trabajo/ot'),null);
  for(const domain of ['inventario_operativo','ventas','pagos','comisiones'])assert.deepEqual(backend.get('sisventas/'+domain),before[domain]??null);
 }finally{await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}
});
