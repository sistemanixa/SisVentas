const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function offlineRequest(mode, saved) {
  const events = {};
  const page = { html: true };
  vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), {
    self: { location: { origin: 'http://localhost' }, addEventListener: (name, fn) => events[name] = fn },
    URL, Request: class {}, Response,
    fetch: async () => { throw Error('Offline'); },
    caches: { match: async key => key === './index.html' ? page : saved },
  });
  let response;
  events.fetch({ request: { method: 'GET', mode, url: 'http://localhost/js/module.js' }, respondWith: value => response = value });
  return { response, page };
}

test('sin red un módulo ausente no recibe HTML como JavaScript', async () => {
  const { response } = offlineRequest('cors');
  assert.equal((await response).type, 'error');
});
test('sin red una navegación conserva la página de respaldo', async () => {
  const { response, page } = offlineRequest('navigate');
  assert.equal(await response, page);
});
test('sin red un módulo existente conserva su respaldo', async () => {
  const saved = { js: true };
  assert.equal(await offlineRequest('cors', saved).response, saved);
});

test('SDK versionado reutiliza caché exacta sin pedir red y guarda faltantes', async () => {
  const events = {}; let network = 0, puts = 0; const saved = new Response('sdk'); let hit = true;
  vm.runInNewContext(fs.readFileSync('sw.js','utf8'), {
    self:{location:{origin:'http://localhost'},addEventListener:(name,fn)=>events[name]=fn}, URL,Request,Response,
    caches:{open:async()=>({match:async()=>hit?saved:undefined,put:async()=>{puts++;}})},
    fetch:async()=>{network++;return new Response('sdk nuevo');}
  });
  let response;const request=new Request('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  events.fetch({request,respondWith:p=>response=p});assert.equal(await response,saved);assert.equal(network,0);
  hit=false;events.fetch({request,respondWith:p=>response=p});await response;assert.equal(network,1);assert.equal(puts,1);
});

for(const failure of ['open','match','put'])test('SDK online conserva respuesta válida si falla caché en '+failure,async()=>{
  const events={};let reads=0;
  vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{
    self:{location:{origin:'http://localhost'},addEventListener:(n,fn)=>events[n]=fn},URL,Request,Response,
    caches:{open:async()=>{if(failure==='open')throw Error('Storage blocked');return {
      match:async()=>{if(failure==='match')throw Error('Cache unavailable');},
      put:async()=>{if(failure==='put')throw Error('QuotaExceededError');}
    };}},fetch:async()=>{reads++;return new Response('SDK válido');}
  });
  let response;events.fetch({request:new Request('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js'),respondWith:p=>response=p});
  assert.equal(await (await response).text(),'SDK válido');assert.equal(reads,1);
});

test('un fallo de almacenamiento no impide activar la reparación del worker',async()=>{
  const events={};let skipped=0,claimed=0;
  vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{
    self:{addEventListener:(n,fn)=>events[n]=fn,skipWaiting:async()=>skipped++,clients:{claim:async()=>claimed++}},
    caches:{open:async()=>{throw Object.assign(Error('Storage full'),{name:'QuotaExceededError'});},keys:async()=>{throw Error('Storage blocked');}}
  });
  let work;events.install({waitUntil:p=>work=p});await work;assert.equal(skipped,1);
  events.activate({waitUntil:p=>work=p});await work;assert.equal(claimed,1);
});

test('sin red no instala una shell incompleta ni retira el respaldo anterior',async()=>{
 const events={};let skipped=0,work;
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self:{addEventListener:(n,fn)=>events[n]=fn,skipWaiting:()=>skipped++},caches:{open:async()=>({addAll:async()=>{throw TypeError('Failed to fetch');}})}});
 events.install({waitUntil:p=>work=p});await assert.rejects(work,/Failed to fetch/);assert.equal(skipped,0);
});

test('respaldo de módulos respeta la revisión pedida, aunque exista otra en caché',async()=>{
 const events={};let options;
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self:{location:{origin:'http://localhost'},addEventListener:(n,fn)=>events[n]=fn},URL,Request,Response,fetch:async()=>{throw Error('offline');},caches:{match:async(_request,o)=>{options=o;return o.ignoreSearch?new Response('versión anterior'):undefined;}}});
 let response;events.fetch({request:new Request('http://localhost/js/core/firebase.js?v=nueva'),respondWith:p=>response=p});assert.equal((await response).type,'error');assert.equal(options.ignoreSearch,false);
});

test('un fallo al guardar un activo no rechaza la respuesta online ni deja tareas sin capturar',async()=>{
 const events={};let work;
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self:{location:{origin:'http://localhost'},addEventListener:(n,fn)=>events[n]=fn},URL,Request,Response,fetch:async()=>new Response('aplicación válida'),caches:{open:async()=>({put:async()=>{throw Error('Storage full');}})}});
 let response;events.fetch({request:new Request('http://localhost/js/app.js'),respondWith:p=>response=p,waitUntil:p=>work=p});assert.equal(await (await response).text(),'aplicación válida');await work;
});

test('worker no intercepta datos autenticados ni finanzas privadas',()=>{
 const events={};let intercepted=0;
 vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self:{location:{origin:'http://localhost'},addEventListener:(n,fn)=>events[n]=fn},URL,Request,Response});
 for(const request of [new Request('http://localhost/privado/finanzas/documento'),new Request('http://localhost/datos',{headers:{Authorization:'Bearer ficticio'}})])events.fetch({request,respondWith:()=>intercepted++});
 assert.equal(intercepted,0);
});
