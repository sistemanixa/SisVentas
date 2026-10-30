'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {createCommercialCollectionReader}=require('../cotizador/commercial-collection-reader');
const root='https://database.invalid/',sales='sisventas/ventas',budgets='sisventas/presupuestos';
const clone=value=>JSON.parse(JSON.stringify(value));
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const example={sale:{total:100.25,items:[{cod:'FICTICIO',qty:2,punit:50.125}],pagos:{payment:{monto:25.15,fecha:'2026-10-20'}},audit:[{accion:'Creada',usuario:'Persona de ejemplo'}]}};
function response(value,etag='"version-1"',status=200){let jsonCalls=0,cancelCalls=0;return {
 ok:status===200,status,headers:{get:name=>name.toLowerCase()==='etag'?etag:null},
 body:{cancel:async()=>{cancelCalls++;}},json:async()=>{jsonCalls++;return clone(value);},
 get jsonCalls(){return jsonCalls;},get cancelCalls(){return cancelCalls;}
};}
function setup(options={}){const calls=[],queue=[];let tokens=0;const reader=createCommercialCollectionReader({databaseURL:root,accessToken:async()=>{tokens++;return 'fictitious-token';},fetchImpl:async(url,config)=>{calls.push({url:String(url),config});const next=queue.shift();if(next instanceof Error)throw next;return typeof next==='function'?next(url,config):next||response(example);},...options});return {reader,calls,queue,get tokens(){return tokens;}};}

test('primera lectura conserva datos completos y envía sólo un GET autenticado a la raíz permitida',async()=>{
 const f=setup(),r=await f.reader.read(sales);assert.deepEqual(r,example);assert.equal(f.calls.length,1);assert.equal(f.tokens,1);
 const {url,config}=f.calls[0];assert.equal(url,root+'sisventas/ventas.json');assert.equal(config.method,'GET');assert.equal(config.headers.Authorization,'Bearer fictitious-token');assert.equal(config.headers['X-Firebase-ETag'],'true');assert.equal(config.headers['If-None-Match'],undefined);assert.equal(config.body,undefined);assert.equal(config.cache,'no-store');assert.equal(config.redirect,'error');assert.ok(config.signal instanceof AbortSignal);
});

test('cada lectura comprueba RTDB y un304 no parsea JSON ni comparte objetos con el consumidor',async()=>{
 const f=setup(),first=await f.reader.read(sales),notModified=response(null,null,304);first.sale.items[0].punit=999;first.sale.pagos.payment.monto=0;delete first.sale.audit;
 f.queue.push(notModified);const second=await f.reader.read(sales);assert.deepEqual(second,example);assert.equal(notModified.jsonCalls,0);assert.equal(notModified.cancelCalls,1);assert.equal(f.calls[1].config.headers['If-None-Match'],'"version-1"');assert.equal(f.tokens,2);
 second.sale.items.length=0;f.queue.push(response(null,null,304));assert.deepEqual(await f.reader.read(sales),example);assert.equal(f.calls.length,3);
});

test('un cambio confirmado devuelve el registro nuevo completo y sustituye su ETag',async()=>{
 const f=setup();await f.reader.read(sales);const changed=clone(example);changed.sale.total=120.75;changed.sale.pagos.payment.monto=45.65;changed.newSale={total:0,items:[]};
 f.queue.push(response(changed,'"version-2"'));assert.deepEqual(await f.reader.read(sales),changed);f.queue.push(response(null,null,304));assert.deepEqual(await f.reader.read(sales),changed);assert.equal(f.calls[2].config.headers['If-None-Match'],'"version-2"');
});

test('las dos colecciones conservan validadores separados, incluso si la base devuelve el mismo ETag',async()=>{
 const f=setup(),quotes={budget:{total:7.35,items:[{qty:1,punit:7.35}]}};await f.reader.read(sales);f.queue.push(response(quotes));assert.deepEqual(await f.reader.read(budgets),quotes);assert.equal(f.calls[1].config.headers['If-None-Match'],undefined);f.queue.push(response(null,null,304));assert.deepEqual(await f.reader.read(sales),example);f.queue.push(response(null,null,304));assert.deepEqual(await f.reader.read(budgets),quotes);
});

test('colección vacía mantiene null y no convierte una eliminación en la versión anterior',async()=>{
 const f=setup();await f.reader.read(sales);f.queue.push(response(null,'"empty"'));assert.equal(await f.reader.read(sales),null);f.queue.push(response(null,null,304));assert.equal(await f.reader.read(sales),null);assert.equal(f.calls[2].config.headers['If-None-Match'],'"empty"');
});

test('304 sin copia asociada falla cerrado sin ofrecer un resultado vacío inventado',async()=>{
 const f=setup();f.queue.push(response(null,null,304));await assert.rejects(f.reader.read(sales),{statusCode:503,code:'SV_COMMERCIAL_COLLECTION_READ'});assert.equal(f.calls.length,1);f.queue.push(response(example));assert.deepEqual(await f.reader.read(sales),example);assert.equal(f.calls[1].config.headers['If-None-Match'],undefined);
});

for(const status of[401,403,404,429,500,503])test('HTTP'+status+' no sirve copia vieja y obliga una lectura nueva tras recuperarse',async()=>{
 const f=setup();await f.reader.read(sales);const rejected=response({error:'fictitious private upstream content'},null,status);f.queue.push(rejected);await assert.rejects(f.reader.read(sales),error=>error.statusCode===503&&error.upstreamStatus===status&&!error.message.includes('private upstream'));
 assert.equal(rejected.jsonCalls,0);assert.equal(f.calls.length,2);assert.ok(rejected.cancelCalls>0);f.queue.push(response(example,'"restored"'));assert.deepEqual(await f.reader.read(sales),example);assert.equal(f.calls[2].config.headers['If-None-Match'],undefined);
});

test('error de red y JSON malformado no ocultan el fallo con datos en memoria',async()=>{
 for(const kind of['network','json']){const f=setup();await f.reader.read(sales);f.queue.push(kind==='network'?Error('fictitious private transport detail'):{ok:true,status:200,headers:{get:()=> '"invalid"'},json:async()=>{throw Error('fictitious private JSON detail');}});await assert.rejects(f.reader.read(sales),error=>error.statusCode===503&&!/private|transport detail|JSON detail/.test(error.message));assert.equal(f.calls.length,2);await f.reader.read(sales);assert.equal(f.calls[2].config.headers['If-None-Match'],undefined);}
});

test('credencial ausente o inválida no inicia solicitudes ni conserva una copia para304',async()=>{
 for(const invalid of['','bad\ncredential','with space',null,undefined,17]){const f=setup({accessToken:async()=>invalid});await assert.rejects(f.reader.read(sales),{statusCode:503});assert.equal(f.calls.length,0);}
 let token='fictitious-token';const f=setup({accessToken:async()=>{if(token==='throw')throw Error('credential-fictitious-private');return token;}});await f.reader.read(sales);token='throw';await assert.rejects(f.reader.read(sales),error=>!error.message.includes('credential-fictitious-private'));assert.equal(f.calls.length,1);token='restored';await f.reader.read(sales);assert.equal(f.calls[1].config.headers['If-None-Match'],undefined);
});

test('sin ETag válido o sobre el límite de bytes devuelve datos actuales sin retener una copia',async()=>{
 for(const etag of[null,'','bad\nheader','bad header','x'.repeat(1025)]){const f=setup();f.queue.push(response(example,etag));assert.deepEqual(await f.reader.read(sales),example);await f.reader.read(sales);assert.equal(f.calls[1].config.headers['If-None-Match'],undefined);}
 const f=setup({maxBytes:9});f.queue.push(response({x:'á'}));assert.deepEqual(await f.reader.read(sales),{x:'á'});await f.reader.read(sales);assert.equal(f.calls[1].config.headers['If-None-Match'],undefined,'Se cuentan diez bytes UTF-8, no nueve caracteres');
 const disabled=setup({maxBytes:0});await disabled.reader.read(sales);await disabled.reader.read(sales);assert.equal(disabled.calls[1].config.headers['If-None-Match'],undefined);
});

test('el límite exacto de bytes admite la copia y un byte menos la desactiva',async()=>{
 const size=Buffer.byteLength(JSON.stringify(example)),exact=setup({maxBytes:size}),smaller=setup({maxBytes:size-1});
 await exact.reader.read(sales);exact.queue.push(response(null,null,304));assert.deepEqual(await exact.reader.read(sales),example);assert.equal(exact.calls[1].config.headers['If-None-Match'],'"version-1"');
 await smaller.reader.read(sales);await smaller.reader.read(sales);assert.equal(smaller.calls[1].config.headers['If-None-Match'],undefined);
});

test('una respuesta grande elimina la copia previa para no conservar un validador antiguo',async()=>{
 const f=setup({maxBytes:400});await f.reader.read(sales);const changed={sale:{notes:'x'.repeat(401)}};f.queue.push(response(changed,'"large"'));assert.deepEqual(await f.reader.read(sales),changed);await f.reader.read(sales);assert.equal(f.calls[2].config.headers['If-None-Match'],undefined);
});

test('solicitudes simultáneas no se fusionan y una respuesta vieja no reemplaza una versión nueva',async()=>{
 const f=setup();await f.reader.read(sales);const old=deferred(),fresh=deferred();f.queue.push(()=>old.promise,()=>fresh.promise);const a=f.reader.read(sales),b=f.reader.read(sales);await turn();assert.equal(f.calls.length,3);
 const changed={newSale:{total:17.25}};fresh.resolve(response(changed,'"fresh"'));assert.deepEqual(await b,changed);old.resolve(response(example,'"old"'));assert.deepEqual(await a,example);f.queue.push(response(null,null,304));assert.deepEqual(await f.reader.read(sales),changed);assert.equal(f.calls[3].config.headers['If-None-Match'],'"fresh"');
});

test('304 usa la copia correspondiente a su propio validador y no pisa otra lectura más nueva',async()=>{
 const f=setup();await f.reader.read(sales);const old=deferred(),fresh=deferred();f.queue.push(()=>old.promise,()=>fresh.promise);const a=f.reader.read(sales),b=f.reader.read(sales);await turn();const changed={newSale:{total:99.35}};fresh.resolve(response(changed,'"fresh"'));await b;const notModified=response(null,null,304);old.resolve(notModified);assert.deepEqual(await a,example);assert.equal(notModified.jsonCalls,0);f.queue.push(response(null,null,304));assert.deepEqual(await f.reader.read(sales),changed);assert.equal(f.calls[3].config.headers['If-None-Match'],'"fresh"');
});

test('un error anterior no expulsa una lectura posterior y un error nuevo impide reponer una respuesta vieja',async()=>{
 for(const oldFails of[true,false]){const f=setup();await f.reader.read(sales);const old=deferred(),fresh=deferred();f.queue.push(()=>old.promise,()=>fresh.promise);const a=f.reader.read(sales),b=f.reader.read(sales);const aRejected=oldFails?assert.rejects(a,{statusCode:503}):null;const bRejected=!oldFails?assert.rejects(b,{statusCode:503}):null;await turn();
  if(oldFails){fresh.resolve(response({newSale:{total:25}},'"fresh"'));await b;old.reject(Error('old-network-failure'));await aRejected;f.queue.push(response(null,null,304));assert.deepEqual(await f.reader.read(sales),{newSale:{total:25}});assert.equal(f.calls[3].config.headers['If-None-Match'],'"fresh"');}
  else{fresh.reject(Error('new-network-failure'));await bRejected;old.resolve(response(example,'"old"'));await a;await f.reader.read(sales);assert.equal(f.calls[3].config.headers['If-None-Match'],undefined);}
 }
});

test('rechaza rutas fuera de las dos raíces antes de obtener credenciales o consultar',async()=>{
 const f=setup();for(const path of['','sisventas','/sisventas/ventas','sisventas/ventas/one','sisventas/ventas/../presupuestos','sisventas/ventas.json','sisventas/pagos','sv_usuarios','sv_permisos','https://other.invalid/sisventas/ventas',null,{},['sisventas/ventas']])await assert.rejects(f.reader.read(path),/Colección comercial no permitida/);assert.equal(f.tokens,0);assert.equal(f.calls.length,0);
});

test('rechaza configuración ambigua y credenciales en URL; sólo HTTP de loopback es válido',()=>{
 const opts={accessToken:async()=> 'fictitious-token',fetchImpl:async()=>response(example)};
 for(const databaseURL of['invalid','http://external.invalid/','ftp://external.invalid/','https://name:pass@external.invalid/','https://external.invalid/other/','https://external.invalid/?auth=anything','https://external.invalid/#fragment'])assert.throws(()=>createCommercialCollectionReader({...opts,databaseURL}),/Configuración/);
 for(const databaseURL of['https://external.invalid','http://127.0.0.1:9000/','http://localhost:9000/','http://[::1]:9000/'])assert.ok(createCommercialCollectionReader({...opts,databaseURL}));
 for(const options of[{maxBytes:-1},{maxBytes:Infinity},{maxBytes:1.2},{requestMs:0},{requestMs:-1},{requestMs:Infinity},{requestMs:1.5},{accessToken:null},{fetchImpl:null}])assert.throws(()=>createCommercialCollectionReader({...opts,databaseURL:root,...options}),/Configuración/);
});

test('crear el lector y dejarlo en reposo no consulta ni inicia trabajos automáticos',async()=>{
 const f=setup();await turn();await turn();assert.equal(f.calls.length,0);assert.equal(f.tokens,0);await f.reader.read(sales);await turn();await turn();assert.equal(f.calls.length,1);assert.equal(f.tokens,1);assert.deepEqual(Object.keys(f.reader),['read']);
});

test('integración HTTP loopback usa If-None-Match, conserva importes y detecta cambios en la siguiente acción',async t=>{
 const received=[];let version='"one"',data=clone(example),bytes=0;
 const server=http.createServer((req,res)=>{received.push({url:req.url,headers:req.headers});if(req.headers.authorization!=='Bearer fictitious-http-token'){res.writeHead(401).end();return;}if(req.headers['if-none-match']===version){res.writeHead(304,{ETag:version}).end();return;}const body=JSON.stringify(data);bytes+=Buffer.byteLength(body);res.writeHead(200,{'Content-Type':'application/json',ETag:version});res.end(body);});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
 const reader=createCommercialCollectionReader({databaseURL:'http://127.0.0.1:'+server.address().port+'/',accessToken:async()=> 'fictitious-http-token'});
 assert.deepEqual(await reader.read(sales),example);const initialBytes=bytes;assert.deepEqual(await reader.read(sales),example);assert.equal(bytes,initialBytes);assert.equal(received.length,2);assert.equal(received[1].headers['if-none-match'],'"one"');assert.equal(received[0].headers['x-firebase-etag'],'true');assert.equal(received[0].url,'/sisventas/ventas.json');
 data.sale.pagos.payment.monto=30.45;version='"two"';assert.deepEqual(await reader.read(sales),data);assert.ok(bytes>initialBytes);assert.equal(received.length,3);await turn();assert.equal(received.length,3);
});

test('timeout de un GET falla cerrado y no reutiliza la copia anterior',async t=>{
 let delay=false;const server=http.createServer((_req,res)=>{if(delay)return;res.writeHead(200,{'Content-Type':'application/json',ETag:'"initial"'}).end(JSON.stringify(example));});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
 const calls=[],reader=createCommercialCollectionReader({databaseURL:'http://127.0.0.1:'+server.address().port+'/',accessToken:async()=> 'fictitious-http-token',requestMs:1000,fetchImpl:(url,config)=>{calls.push(config);return fetch(url,config);}});
 await reader.read(sales);delay=true;await assert.rejects(reader.read(sales),{statusCode:503});assert.equal(calls.length,2);delay=false;await reader.read(sales);assert.equal(calls[2].headers['If-None-Match'],undefined);
});
test('historial grande conserva validador con copia comprimida acotada y entrega copias aisladas',async()=>{const large={sale:{items:Array.from({length:400},(_,i)=>({cod:'P-'+i,description:'Material ficticio repetido para comprobar almacenamiento limitado',qty:2,costo:40.35})),total:123.45}},f=setup({maxBytes:4096,compressOverflow:true,maxExpandedBytes:100000});assert.ok(Buffer.byteLength(JSON.stringify(large))>4096);f.queue.push(response(large,'"large"'));assert.deepEqual(await f.reader.read(sales),large);f.queue.push(response(null,null,304));const cached=await f.reader.read(sales);assert.equal(f.calls[1].config.headers['If-None-Match'],'"large"');assert.deepEqual(cached,large);cached.sale.items[0].costo=0;f.queue.push(response(null,null,304));assert.equal((await f.reader.read(sales)).sale.items[0].costo,40.35);});
test('compresión no excede sus límites, no conserva un JSON ampliado mayor al máximo y no tapa fallos',async()=>{const large={sale:{notes:'x'.repeat(10000)}},f=setup({maxBytes:100,compressOverflow:true,maxExpandedBytes:1000});f.queue.push(response(large));await f.reader.read(sales);await f.reader.read(sales);assert.equal(f.calls[1].config.headers['If-None-Match'],undefined);const tight=setup({maxBytes:1,compressOverflow:true});tight.queue.push(response(large));await tight.reader.read(sales);await tight.reader.read(sales);assert.equal(tight.calls[1].config.headers['If-None-Match'],undefined);const offline=setup({maxBytes:100,compressOverflow:true});offline.queue.push(response(large));await offline.reader.read(sales);offline.queue.push(Error('Offline'));await assert.rejects(offline.reader.read(sales),e=>e.statusCode===503);offline.queue.push(response(large));await offline.reader.read(sales);assert.equal(offline.calls[2].config.headers['If-None-Match'],undefined);});
test('configuración de compresión inválida no habilita retención ilimitada',()=>{for(const change of [{compressOverflow:'true'},{maxExpandedBytes:0},{maxExpandedBytes:Infinity},{maxExpandedBytes:65*1024*1024}])assert.throws(()=>setup(change),/Configuración/);});
