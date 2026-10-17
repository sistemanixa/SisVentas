'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{brotliDecompressSync,gunzipSync}=require('node:zlib');
const {sendCommercial,preferredEncoding}=require('../cotizador/commercial-response');
function response(){return {headers:{},setHeader(key,value){this.headers[key]=value;},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers);},end(body){this.body=body;}};}
test('negociación respeta preferencias, exclusiones y navegadores sin Brotli',()=>{
 for(const [header,encoding]of [['br, gzip','br'],['gzip','gzip'],['gzip;q=1,br;q=.5','gzip'],['gzip;q=.5,br;q=1','br'],['br;q=0,gzip','gzip'],['br;q=0,gzip;q=0',''],['identity',''],['',''],['*;q=.8,gzip;q=0','br'],['br;q=2,gzip;q=.5','gzip'],['BR; q=1, gzip','br'],['br;q=invalid,gzip;q=0','']])assert.equal(preferredEncoding(header),encoding,header);
});
test('Brotli conserva bytes, documentos y centavos; gzip y cuerpo sin comprimir siguen disponibles',async()=>{
 const payload={ok:true,records:{demo:{total:1234.56,items:[{qty:2,punit:617.28,nombre:'Producto ficticio'}],factura:{comprobante:{data:'data:application/pdf;base64,'+'UERGREVNTw=='.repeat(1500)}},audit:[{accion:'Ejemplo ficticio'}]}}};
 const plain=response(),br=response(),gz=response();
 await sendCommercial({headers:{}},plain,payload);await sendCommercial({headers:{'accept-encoding':'br,gzip'}},br,payload);await sendCommercial({headers:{'accept-encoding':'gzip'}},gz,payload);
 assert.deepEqual(brotliDecompressSync(br.body),plain.body);assert.deepEqual(gunzipSync(gz.body),plain.body);
 assert.equal(br.headers['Content-Encoding'],'br');assert.equal(gz.headers['Content-Encoding'],'gzip');
 assert.equal(br.headers.ETag,plain.headers.ETag);assert.equal(gz.headers.ETag,plain.headers.ETag);assert.equal(br.headers['Content-Length'],br.body.length);
 assert.equal(br.headers['Cache-Control'],'private, no-store');assert.match(br.headers.Vary,/Authorization, Origin, Accept-Encoding/);
});
test('304 mantiene autorización previa y validador independiente de la codificación, sin generar cuerpo',async()=>{
 const payload={ok:true,records:{demo:{total:12.34,notes:'Ejemplo'.repeat(400)}}},first=response();await sendCommercial({headers:{'accept-encoding':'gzip'}},first,payload);
 const second=response();await sendCommercial({headers:{'accept-encoding':'br','if-none-match':first.headers.ETag}},second,payload);
 assert.equal(second.status,304);assert.equal(second.body,undefined);assert.equal(second.headers['Content-Encoding'],undefined);assert.equal(second.headers.ETag,first.headers.ETag);
});
test('respuestas pequeñas no se comprimen y un cambio real conserva la invalidación',async()=>{
 const first=response(),next=response();await sendCommercial({headers:{'accept-encoding':'br'}},first,{ok:true,records:{demo:{total:1}}});await sendCommercial({headers:{'accept-encoding':'br','if-none-match':first.headers.ETag}},next,{ok:true,records:{demo:{total:2}}});assert.equal(first.headers['Content-Encoding'],undefined);assert.equal(next.status,200);assert.notEqual(next.headers.ETag,first.headers.ETag);
});
