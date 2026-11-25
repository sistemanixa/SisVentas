'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{createHandler}=require('../cotizador/purchase-delete-server');
test('el servicio acotado exige sesión, origen y reglas; no expone escritura genérica ni datos en health',{timeout:30000},async()=>{
 let allowed=false,writes=0;
 const server=http.createServer(createHandler({allowedOrigins:new Set(['https://ventas.sistemanixa.com']),authorize:async req=>{if(req.headers.authorization!=='Bearer synthetic')throw Object.assign(Error('Sesión requerida'),{statusCode:401});return {uid:'u',claims:{uid:'u'}};},checkRules:async()=>{if(!allowed)throw Object.assign(Error('Reglas no verificadas'),{statusCode:503});},command:{capability:async()=>true,handle:async()=>{writes++;return{ok:true,committed:true,orderKey:'draft'};}},resolve:async()=>({ok:true,status:'confirmed'})}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const post=(p,headers={},body='{}')=>fetch(base+p,{method:'POST',headers:{Authorization:'Bearer synthetic',...headers},body});
 try{
  assert.deepEqual(await(await fetch(base+'/healthz')).json(),{ok:true,service:'purchase-delete'});
  assert.equal((await post('/laboral/guardar')).status,404);
  assert.equal((await post('/compras/ordenes/eliminar',{Origin:'https://unrelated.invalid'})).status,403);
  assert.equal((await post('/compras/ordenes/eliminar',{Authorization:'Bearer invalid'})).status,401);
  assert.equal((await post('/compras/ordenes/eliminar')).status,503);assert.equal(writes,0);
  allowed=true;const caps=await post('/laboral/capacidades',{Origin:'https://ventas.sistemanixa.com'});assert.equal(caps.headers.get('access-control-allow-origin'),'https://ventas.sistemanixa.com');assert.equal((await caps.json()).orderDelete.enabled,true);
  assert.equal((await post('/compras/ordenes/eliminar',{},'x'.repeat(16385))).status,413);assert.equal(writes,0);
  assert.equal((await post('/compras/ordenes/eliminar')).status,200);assert.equal(writes,1);
 }finally{await new Promise(r=>{server.close(r);server.closeIdleConnections();});}
});
