const {test}=require('node:test'),assert=require('node:assert/strict');
const {start}=require('../scripts/dev-reconnection-audit.cjs');
test('fixture de reconexión expone solo lecturas ficticias, bloquea escrituras y no sirve archivos privados',async()=>{
 const server=start(0);try{
  if(!server.listening)await new Promise(resolve=>server.once('listening',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const page=await fetch(base+'/'),html=await page.text();assert.ok(html.includes('DATOS FICTICIOS'));assert.ok(page.headers.get('content-security-policy').includes("connect-src 'self'"));assert.ok(!html.includes('firebase-app.js'));
  for(const path of ['/AGENTS.md','/docs/CONTEXTO_ACTUAL.md','/.git/config','/js/core/firebase.js'])assert.equal((await fetch(base+path)).status,404);
  const target=base+'/comerciales/ventas';assert.equal((await fetch(target)).status,401);assert.equal((await fetch(target,{method:'POST'})).status,405);
  const options={headers:{Authorization:'Bearer FICTICIO'}};const data=await(await fetch(target,options)).json();assert.equal(data.records.demo.responsableUid,'fixture');
  await fetch(base+'/__fixture/network?state=offline');await assert.rejects(fetch(target,options));
  await fetch(base+'/__fixture/network?state=online');assert.equal((await fetch(target,options)).status,200);
  await fetch(base+'/__fixture/network?state=error');assert.equal((await fetch(target,options)).status,503);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
