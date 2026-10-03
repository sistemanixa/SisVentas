const {test}=require('node:test');
const assert=require('node:assert/strict');
const {crearCache,claveConsulta}=require('../consulta-cache');
const {crearPool}=require('../navegador-compartido');
const pausa=ms=>new Promise(r=>setTimeout(r,ms));
test('bloqueo de seguridad espera dos minutos sin afectar otras URLs',async()=>{
 let reloj=0,n=0;const c=crearCache({ahora:()=>reloj});
 const bloquear=async()=>{n++;const e=Error('verificación');e.codigo='ML_VERIFICACION_SEGURIDAD';throw e;};
 for(let i=0;i<2;i++)await assert.rejects(c.consultar('bloqueada',bloquear));
 assert.equal(n,1);assert.equal((await c.consultar('otra',async()=>({ok:true,precio:4}))).precio,4);
 reloj=120001;await assert.rejects(c.consultar('bloqueada',bloquear));assert.equal(n,2);
});
test('consultas simultáneas comparten trabajo, conservan aislamiento y vencen',async()=>{
 let reloj=0,llamadas=0;const c=crearCache({ttl:60,ahora:()=>reloj});
 const trabajo=async()=>{llamadas++;await pausa(5);return {ok:true,precio:42};};
 const [a,b]=await Promise.all([c.consultar('a',trabajo),c.consultar('a',trabajo)]);
 a.precio=99;assert.equal(b.precio,42);assert.equal(llamadas,1);
 assert.equal((await c.consultar('a',trabajo)).precio,42);assert.equal(llamadas,1);
 reloj=61;await c.consultar('a',trabajo);assert.equal(llamadas,2);
});
test('errores y dudas no se guardan; credenciales y variante invalidan resultados',async()=>{
 const c=crearCache();let n=0;
 for(let i=0;i<2;i++)await assert.rejects(c.consultar('a',async()=>{n++;throw Error('bloqueo');}));
 assert.equal(n,2);
 for(let i=0;i<2;i++)await c.consultar('b',async()=>{n++;return {ok:false,requiereConfirmacionIdentidad:true};});
 assert.equal(n,4);
 assert.notEqual(claveConsulta({password:'a'},{url:'x#wid=1'}),claveConsulta({password:'b'},{url:'x#wid=1'}));
 assert.notEqual(claveConsulta({password:'a'},{url:'x#wid=1'}),claveConsulta({password:'a'},{url:'x#wid=2'}));
});
test('navegador compartido mantiene contextos separados y no cierra otra consulta',async()=>{
 let arranques=0,cierres=0,ctxCerrados=0;const estados=[];
 const b={isConnected:()=>true,close:async()=>{cierres++;},newContext:async opts=>{estados.push(opts);return {route:async()=>{},close:async()=>{ctxCerrados++;}};}};
 const p=crearPool({launch:async()=>{arranques++;await pausa(3);return b;}},{idleMs:10,contextMs:1000});
 const [a,c]=await Promise.all([p.adquirir(),p.adquirir()]);
 await a.newContext({storageState:'A'});await c.newContext({storageState:'B'});
 await a.close();await pausa(15);assert.equal(cierres,0);assert.equal(ctxCerrados,1);
 await c.close();await c.close();await pausa(15);
 assert.equal(arranques,1);assert.equal(cierres,1);assert.equal(ctxCerrados,2);assert.deepEqual(estados,[{storageState:'A'},{storageState:'B'}]);
});
test('límite temporal cierra únicamente el contexto que venció',async()=>{
 let cerrado=0;const p=crearPool({launch:async()=>({isConnected:()=>true,newContext:async()=>({route:async()=>{},close:async()=>{cerrado++;}}),close:async()=>{}})},{contextMs:10,idleMs:1});
 const lease=await p.adquirir();await lease.newContext({});await pausa(20);assert.equal(cerrado,1);await lease.close();assert.equal(cerrado,1);
});
