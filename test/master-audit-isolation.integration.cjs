'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {start}=require('../scripts/dev-master-audit.cjs');
test('auditoría maestra usa RAM, bloquea SDK real y no sirve fuentes privadas',async()=>{
 const a=await start(0);try{
 const home=await fetch(a.url);const html=await home.text();assert.match(home.headers.get('content-security-policy'),/connect-src 'self'/);assert.doesNotMatch(html,/<script[^>]+src=["'](?:https?:|[^"']*\/firebase\.js)/i);
 for(const p of ['/docs/CONTEXTO_ACTUAL.md','/.git/config','/cotizador/index.js','/js/core/firebase.js','/sw.js'])assert.equal((await fetch(a.url+p)).status,404,p);
 const r=await fetch(a.url+'/audit/sdk',{method:'POST',body:JSON.stringify({kind:'set',path:'sisventas/presupuestos/fixture',value:{id:'FICTICIO',total:1}})});assert.equal(r.status,200);assert.equal(a.backend.get('sisventas/presupuestos/fixture').total,1);
 assert.equal(a.backend.get('sisventas/sentinel').stock,20);assert.equal(a.backend.get('sisventas/sentinel').private,'Sin modificar');
 const cap=await(await fetch(a.url+'/laboral/capacidades')).json();assert.deepEqual(cap.payments,{enabled:true,version:1});assert.deepEqual(cap.adminExpense,{enabled:false,version:1});
 const denied=await fetch(a.url+'/cobranzas/operacion',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.notEqual(denied.status,200);
 assert(a.requests.some(x=>x.bytes>0));
 const authRequired=await fetch(a.url+'/usuarios/directorio');assert.equal(authRequired.status,401);
 const directory=await fetch(a.url+'/usuarios/directorio',{headers:{Authorization:'Bearer fixture-token'}});assert.equal(directory.status,200);
 await fetch(a.url+'/audit/sdk',{method:'POST',body:JSON.stringify({kind:'set',path:'sisventas/queryFixture',value:{c:{monto:3},a:{monto:1},b:{monto:2}}})});
 const query=encodeURIComponent(JSON.stringify([{kind:'key'},{kind:'start',value:'b'},{kind:'first',value:1}]));
 const filtered=await(await fetch(a.url+'/audit/db?path=sisventas/queryFixture&query='+query)).json();assert.deepEqual(filtered.value,{b:{monto:2}});
 }finally{await new Promise(r=>a.server.close(r));}
});
