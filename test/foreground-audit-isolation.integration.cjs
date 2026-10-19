'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {start}=require('../scripts/dev-foreground-audit.cjs');
test('prueba de primer plano permite sólo activos y respuestas ficticias en loopback',async()=>{
 const server=start(0);try{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  assert.equal(server.address().address,'127.0.0.1');const base='http://127.0.0.1:'+server.address().port;
  const page=await fetch(base+'/?hidden=1'),html=await page.text();assert.ok(html.includes('DATOS FICTICIOS'));assert.ok(page.headers.get('content-security-policy').includes("connect-src 'self'"));assert.ok(!html.includes('firebase-app.js'));
  for(const path of ['/AGENTS.md','/docs/CONTEXTO_ACTUAL.md','/.git/config','/js/core/firebase.js','/cotizador/server.js'])assert.equal((await fetch(base+path)).status,404);
  const wrapper=await(await fetch(base+'/auth-wrapper.js')).text();assert.ok(wrapper.includes('window.fbOnAuth'));assert.ok(!/import\s|initializeApp\(/.test(wrapper));
  for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await fetch(base+'/comerciales/ventas',{method})).status,405);
  const target=base+'/comerciales/ventas';assert.equal((await fetch(target)).status,401);
  const options={headers:{Authorization:'Bearer FICTICIO-SIN-VALIDEZ'}};const response=await fetch(target,options),data=await response.json();assert.equal(data.records.demo.responsableUid,'fixture');
  assert.equal((await fetch(target,{headers:{...options.headers,'If-None-Match':response.headers.get('etag')}})).status,304);
  assert.equal((await fetch(base+'/?sv_connection_probe=1')).status,401);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
