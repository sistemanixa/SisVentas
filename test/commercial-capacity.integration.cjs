'use strict';
// HTTP local + código real de lotes/comercial; proveedor y base ficticios.
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),vm=require('node:vm');
const {fixture}=require('./helpers/commercial-ownership-fixtures.cjs'),{sendCommercial}=require('../cotizador/commercial-response');
const source=fs.readFileSync('cotizador/index.js','utf8'),batchCode=source.slice(source.indexOf('async function cotizarLote(reqBody)'),source.indexOf('\nasync function cotizar(reqBody,'));
test('cuatro lotes lentos no bloquean lecturas HTTP de Ventas y Presupuestos ni mezclan identidades',async t=>{
 const f=fixture(),before=JSON.stringify(f.db.root);let release,started=0,done=0;
 const gate=new Promise(r=>release=r),context={db:{ref:()=>({get:async()=>({val:()=>({nombre:'Proveedor ficticio',conexionAutomatica:{estado:'verificado',firma:'ok'}})})})},tipoProveedor:()=>'',esProveedorPublicoComprasParaguay:()=>false,firmaAcceso:()=>'ok',cotizar:async body=>{started++;await gate;return {ok:true,precioArs:123,url:body.url};}};
 vm.runInNewContext(batchCode,context);
 const server=http.createServer(async(req,res)=>{try{const domain=req.url==='/presupuestos'?'presupuestos':'ventas',actor=await f.api.authorize(req,domain);if(req.url==='/cotizar-lote'){const result=await context.cotizarLote({proveedorKey:'ficticio',items:[{url:'uno'},{url:'dos'},{url:'tres'},{url:'cuatro'}]});done++;res.end(JSON.stringify(result));}else await sendCommercial(req,res,{ok:true,...await f.api.list(actor)});}catch(e){res.writeHead(e.statusCode||500);res.end(JSON.stringify({ok:false}));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{release();await new Promise(r=>server.close(r));});
 const request=(path,uid='admin')=>new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:server.address().port,path,headers:{Authorization:'Bearer '+uid}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,data:JSON.parse(Buffer.concat(chunks))}));}).on('error',reject);});
 const batches=Array.from({length:4},()=>request('/cotizar-lote'));
 for(let i=0;i<100&&started<8;i++)await new Promise(r=>setTimeout(r,10));assert.equal(started,8);
 let timer;const reads=await Promise.race([Promise.all(Array.from({length:24},(_,i)=>request(i%2?'/presupuestos':'/ventas',i%3?'admin':'b'))),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Lecturas bloqueadas por cotización')),3000);})]).finally(()=>clearTimeout(timer));
 assert.equal(done,0);assert.ok(reads.every(r=>r.status===200&&r.data.ok));
 for(let i=0;i<reads.length;i++)if(i%3===0){assert.deepEqual(Object.keys(reads[i].data.records),i%2?[]:['other']);}
 assert.equal((await request('/ventas','tech')).status,403);
 release();const results=await Promise.all(batches);assert.ok(results.every(r=>r.status===200&&r.data.resultados.length===4));assert.equal(done,4);assert.equal(JSON.stringify(f.db.root),before);
});
