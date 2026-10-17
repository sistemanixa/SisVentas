'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {start}=require('../scripts/dev-module-audit.cjs');
test('la auditoría solo sirve activos públicos y rechaza escrituras y archivos privados',async()=>{
 const server=start(0);await new Promise(r=>server.once('listening',r));
 try{const base='http://127.0.0.1:'+server.address().port;
 const home=await fetch(base);assert.match(home.headers.get('content-security-policy'),/connect-src 'self'/);assert.match(home.headers.get('content-security-policy'),/form-action 'none'/);
 for(const name of ['/docs/CONTEXTO_ACTUAL.md','/.git/config','/js/core/firebase.js','/cotizador/index.js'])assert.equal((await fetch(base+name)).status,404);
 assert.equal((await fetch(base+'/api',{method:'POST',body:'ficticio'})).status,405);
 assert.equal((await fetch(base+'/css/app.css')).status,200);
 }finally{await new Promise(r=>server.close(r));}
});
