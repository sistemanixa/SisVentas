'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{PassThrough}=require('node:stream'),W=require('../scripts/lib/tecnoprices-local-readonly.cjs');
async function request(server,body,options={}){const req=new PassThrough();req.headers={origin:options.origin||W.ORIGIN,...(options.token===false?{}:{authorization:'Bearer fixture'})};req.url=options.path||W.ROUTE;req.method=options.method||'POST';return new Promise(resolve=>{const res={writeHead(status){this.status=status;},end(text){resolve({status:this.status,body:JSON.parse(text||'{}')});}};server.emit('request',req,res);req.end(JSON.stringify(body));});}
test('optional standard Chrome identity uses the installed browser version and rejects injected text',()=>{assert(W.standardChromeUserAgent('142.0.1.2').includes('Chrome/142.0.1.2'));assert.throws(()=>W.standardChromeUserAgent('142\r\nCookie:secret'));});
test('read-only local probe enforces session, role, supplier, exact URL and response allowlist',async()=>{
 const state={'sv_chat_roles/user':{activo:true,rol:'admin'},'sv_permisos/admin':{indiceVersion:2,indiceModulos:{productos:true}},'sisventas/proveedores/supplier':{nombre:'Tecnoprices',web:'https://www.tecnoprices.com',usuario:'fixture',password:'fixture'}};
 let calls=0;const reads=[];
 const server=W.createServer({verifyIdToken:async(_,revoked)=>{assert.equal(revoked,true);return{uid:'user'};},readServer:async p=>{reads.push(p);return state[p];},reader:async()=>{calls++;return{ok:true,url:W.PRODUCT_URL,precioArs:1234.56,disponibilidadProveedor:'sin_stock',password:'MUST_NOT_LEAK'};}});
 const body={url:W.PRODUCT_URL,proveedorKey:'supplier'};
 for(const options of [{origin:'https://foreign.invalid'},{token:false},{method:'GET'},{path:'/cotizar'}])assert((await request(server,body,options)).status>=400);
 assert.equal(calls,0);
 assert.equal((await request(server,{...body,url:'https://foreign.invalid'})).status,400);
 assert.equal((await request(server,{...body,proveedorKey:'../other'})).status,400);
 let result=await request(server,body);assert.equal(result.status,200);assert.equal(result.body.precioArs,1234.56);assert.equal(result.body.password,undefined);assert.equal(calls,1);
 state['sisventas/proveedores/supplier'].nombre='Other';assert.equal((await request(server,body)).status,400);state['sisventas/proveedores/supplier'].nombre='Tecnoprices';state['sisventas/proveedores/supplier'].web='https://foreign.invalid';assert.equal((await request(server,body)).status,400);
 state['sv_chat_roles/user'].rol='tecnico';assert.equal((await request(server,body)).status,403);assert.equal(calls,1);
 assert(reads.every(p=>['sv_access_resets/user','sv_chat_roles/user','sv_permisos/admin','sisventas/proveedores/supplier'].includes(p)));
});
test('local authentication infrastructure failures never tell an authenticated user to log in again',async()=>{
 const body={url:W.PRODUCT_URL,proveedorKey:'supplier'};
 for(const [code,status] of [['auth/id-token-revoked',401],['auth/insufficient-permission',503],['auth/invalid-credential',503]]){
  const server=W.createServer({verifyIdToken:async()=>{throw Object.assign(Error('private diagnostic must not escape'),{code});},readServer:async()=>assert.fail('No database read after failed verification'),reader:async()=>assert.fail('No supplier access after failed verification')});
  const result=await request(server,body);assert.equal(result.status,status);assert(!JSON.stringify(result.body).includes('private diagnostic'));if(status===503)assert(!result.body.mensaje.startsWith('Volvé'));
 }
});
test('normal batch route uses the same session authority and denies missing credentials before database or supplier reads',async()=>{
 const readServer=async()=>assert.fail('Unauthenticated batch must not read Firebase'),reader=async()=>assert.fail('Unauthenticated batch must not query supplier'),verifyIdToken=async()=>assert.fail('Missing token must not reach verifier');
 const authorize=W.createAuthorize({verifyIdToken,readServer}),batchHandler=require('../scripts/lib/tecnoprices-local-batch.cjs').createBatchHandler({readServer,reader,authorize});
 const server=W.createServer({readServer,reader,verifyIdToken,batchHandler});
 const result=await request(server,{proveedorKey:'supplier',items:[{sourceProductKey:'product',sourceSupplierIdx:0,codigo:'P-123',url:'https://www.tecnoprices.com/123/product'}]},{path:'/tecnoprices/lote',token:false});
 assert.equal(result.status,401);
});
