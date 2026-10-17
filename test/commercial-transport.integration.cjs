'use strict';
// Integración HTTP real en loopback; no usa Firebase ni credenciales reales.
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{gunzipSync,brotliDecompressSync}=require('node:zlib');
const {sendCommercial}=require('../cotizador/commercial-response'),{fixture}=require('./helpers/commercial-ownership-fixtures.cjs');
const fs=require('node:fs'),vm=require('node:vm');
const serverSource=fs.readFileSync(require.resolve('../cotizador/index.js'),'utf8');
const corsContext={process:{env:{}}};
vm.runInNewContext(serverSource.slice(serverSource.indexOf('const ALLOW_ORIGIN ='),serverSource.indexOf('const REQUIRE_FIREBASE_AUTH ='))+serverSource.slice(serverSource.indexOf('function origenCorsPermitido('),serverSource.indexOf('const DOMINIOS_IMAGEN_PRODUCTO')),corsContext);
async function setup(t){const f=fixture(),server=http.createServer(async(req,res)=>{try{const actor=await f.api.authorize(req,'ventas');await sendCommercial(req,res,{ok:true,...await f.api.list(actor)});}catch(e){res.writeHead(e.statusCode||500,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false}));}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const port=server.address().port;
 const request=(extra={},uid='admin')=>new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port,path:'/',headers:{...(uid?{Authorization:'Bearer '+uid}:{}),...extra}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);});return {...f,request};}
test('respuesta sin cambios entrega 304 sin cuerpo; cambiar un registro entrega la representación nueva',async t=>{const s=await setup(t),first=await s.request();assert.equal(first.status,200);assert.match(first.headers.etag,/^W\/"/);const next=await s.request({'If-None-Match':first.headers.etag});assert.equal(next.status,304);assert.equal(next.body.length,0);s.db.root.sisventas.ventas.one.total=101;const changed=await s.request({'If-None-Match':first.headers.etag});assert.equal(changed.status,200);assert.notEqual(changed.headers.etag,first.headers.etag);assert.equal(JSON.parse(changed.body).records.one.total,101);});
test('compresión conserva exactamente registros/valores y respeta la negociación de gzip',async t=>{const s=await setup(t);s.db.root.sisventas.ventas.one.descripcion='Producto ficticio para transporte. '.repeat(5000);const plain=await s.request({'Accept-Encoding':'gzip;q=0'}),packed=await s.request({'Accept-Encoding':'gzip;q=0.8'});assert.equal(plain.headers['content-encoding'],undefined);assert.equal(packed.headers['content-encoding'],'gzip');assert.deepEqual(gunzipSync(packed.body),plain.body);assert.ok(packed.body.length<plain.body.length/4);assert.equal(packed.headers.etag,plain.headers.etag);assert.equal(packed.headers['cache-control'],'private, no-store');assert.match(packed.headers.vary,/Authorization/);assert.match(packed.headers.vary,/Accept-Encoding/);assert.equal(packed.headers['access-control-expose-headers'],'ETag');});
test('un validador del administrador no entrega registros ajenos y no evita revalidar autorización',async t=>{const s=await setup(t),first=await s.request(),own=await s.request({'If-None-Match':first.headers.etag},'b');assert.equal(own.status,200);assert.deepEqual(Object.keys(JSON.parse(own.body).records),['other']);s.db.root.sv_chat_roles.admin.activo=false;assert.equal((await s.request({'If-None-Match':first.headers.etag})).status,403);assert.equal((await s.request({'If-None-Match':first.headers.etag},'')).status,401);});
test('HTTP negocia Brotli, conserva el DTO completo y permite 304 después de gzip',async t=>{
 const s=await setup(t);s.db.root.sisventas.ventas.one.factura={comprobante:{data:'data:application/pdf;base64,'+'UERGREVNTw=='.repeat(2000)}};
 const plain=await s.request({'Accept-Encoding':'identity'}),br=await s.request({'Accept-Encoding':'br,gzip'}),gz=await s.request({'Accept-Encoding':'br;q=0,gzip'});
 assert.equal(br.headers['content-encoding'],'br');assert.equal(gz.headers['content-encoding'],'gzip');assert.deepEqual(brotliDecompressSync(br.body),plain.body);assert.deepEqual(gunzipSync(gz.body),plain.body);assert.equal(Number(br.headers['content-length']),br.body.length);
 const validated=await s.request({'Accept-Encoding':'br','If-None-Match':gz.headers.etag});assert.equal(validated.status,304);assert.equal(validated.body.length,0);
 const other=await s.request({'Accept-Encoding':'br','If-None-Match':br.headers.etag},'b');assert.equal(other.status,200);assert.deepEqual(Object.keys(JSON.parse(other.body).records),['other']);
});

test('CORS del servidor permite validadores solo a los orígenes existentes y conserva las cabeceras en 304',async()=>{
 for(const origin of ['https://ventas.sistemanixa.com','http://127.0.0.1:8766','https://otro-sitio.invalid']){
  const headers={},res={setHeader:(k,v)=>headers[k.toLowerCase()]=v,writeHead:status=>res.status=status,end:()=>{}};
  const req={headers:{origin}};corsContext.cors(req,res);
  assert.equal(headers['access-control-allow-origin'],origin.endsWith('.invalid')?undefined:origin);
  assert.match(headers['access-control-allow-headers'],/If-None-Match/);
  await sendCommercial(req,res,{ok:true,records:{demo:{total:123.45}}});
  req.headers['if-none-match']=headers.etag;await sendCommercial(req,res,{ok:true,records:{demo:{total:123.45}}});
  assert.equal(res.status,304);assert.equal(headers['access-control-expose-headers'],'ETag');
  assert.match(headers.vary,/Origin/);assert.equal(headers['cache-control'],'private, no-store');
 }
});
