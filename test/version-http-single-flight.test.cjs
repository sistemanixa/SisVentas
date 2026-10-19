'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const source=require('./helpers/active-app').readActiveApp().source,settle=()=>new Promise(setImmediate);
function setup({published='v3.13.3',fallback=published,failMarker=false,holdFallback=false,controller=true}={}){
 const document=new EventTarget(),browser=new EventTarget(),calls=[],options=[],updates=[],callbacks=[],timers=new Map();document.visibilityState='visible';document.hidden=false;
 let release,releaseFallback,markerCalls=0,fallbackCalls=0,now=1700000000000,sequence=0,markerVersion=published;
 const gate=new Promise(resolve=>release=resolve),backupGate=new Promise(resolve=>releaseFallback=resolve),c={document,window:{addEventListener:browser.addEventListener.bind(browser)},Date:{now:()=>now},APP_CONFIG:{VERSION:'v3.13.3-firebase'},_ultimoChequeoAppPublicada:0,isAuthenticated:true,iniciarChequeoPeriodicoVersion(){},_dispararActualizacion:v=>updates.push(v),
  setTimeout(fn,delay=0){const id=++sequence;timers.set(id,{fn,due:now+delay});return id;},clearTimeout:id=>timers.delete(id),
  fetch:async(url,init)=>{assert.ok(url.startsWith('./js/core/version.js?')||url.startsWith('./index.html?'));calls.push(url);options.push(init);if(url.startsWith('./js/core/')){const value=markerVersion;if(++markerCalls===1)await gate;if(failMarker)throw Error('Fallo ficticio');return {ok:true,text:async()=>"window.SISVENTAS_PWA_VERSION = '"+value+"';"};}if(++fallbackCalls===1&&holdFallback)await backupGate;return {ok:true,text:async()=>"<!-- VERSION: '"+fallback+"-firebase' -->"};}};
 if(controller)c.AbortController=AbortController;
 vm.createContext(c);
 const {functionSource}=require('./helpers/app-functions.cjs');
 // Obtener los parsers reales; la red y el reloj permanecen ficticios.
 for(const name of ['_versionMasNueva','_extraerVersionPublicada'])vm.runInContext(functionSource(name),c);
 const begin=source.indexOf('function _chequearAppPublicadaComoRespaldo('),end=source.indexOf('function _sesionVersionLista(',begin);vm.runInContext(source.slice(begin,end),c);
 const handlersStart=source.indexOf("document.addEventListener('visibilitychange'",source.indexOf('// Si el navegador suspendió la pestaña')),handlersEnd=source.indexOf('function actualizarAutomaticamente(',handlersStart);vm.runInContext(source.slice(handlersStart,handlersEnd),c);
 return {c,calls,options,updates,callbacks,timers,release,releaseFallback,marker:value=>{markerVersion=value;},
  elapse(ms){now+=ms;},
  advance(ms){const until=now+ms;for(;;){const next=[...timers].filter(([,task])=>task.due<=until).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;timers.delete(next[0]);now=next[1].due;next[1].fn();}now=until;},
  events(){document.dispatchEvent(new Event('visibilitychange'));browser.dispatchEvent(new Event('focus'));browser.dispatchEvent(new Event('online'));}};
}
test('visible, foco y red comparten una lectura de marcador y un respaldo del índice',async()=>{
 const f=setup();f.events();await settle();assert.equal(f.calls.length,1);f.release();await settle();await settle();assert.equal(f.calls.length,2);assert.deepEqual(f.updates,[]);
});
test('todos los interesados esperan la misma versión y un chequeo posterior vuelve a consultar',async()=>{
 const f=setup();for(let i=0;i<3;i++)f.c._chequearGitHub(v=>f.callbacks.push(v));await settle();assert.equal(f.calls.length,1);f.release();await settle();await settle();
 assert.deepEqual(f.callbacks,['v3.13.3-firebase','v3.13.3-firebase','v3.13.3-firebase']);assert.equal(f.calls.length,2);
 await f.c._chequearGitHub();assert.equal(f.calls.length,3,'Sólo se comparte trabajo en curso; no se cachea el resultado');
});
test('una versión nueva dispara una sola verificación de publicación sin descargar el respaldo',async()=>{
 const f=setup({published:'v3.13.4'});f.events();f.release();await settle();await settle();assert.equal(f.calls.length,1);assert.deepEqual(f.updates,['v3.13.4-firebase']);
});
test('el fallo del marcador conserva el respaldo compartido y permite reintentar por una acción posterior',async()=>{
 const f=setup({failMarker:true});f.events();f.release();await settle();await settle();assert.equal(f.calls.length,2);assert.deepEqual(f.updates,[]);
 await f.c._chequearGitHub();assert.equal(f.calls.length,3);
});
test('foco o red con pantalla oculta no inician lectura; ocultarse durante el marcador no inicia el respaldo',async()=>{
 const f=setup();f.c.document.visibilityState='hidden';f.events();await settle();assert.equal(f.calls.length,0);
 f.c.document.visibilityState='visible';const task=f.c._chequearGitHub();await settle();assert.equal(f.calls.length,1);
 f.c.document.visibilityState='hidden';f.release();await task;assert.equal(f.calls.length,1);assert.deepEqual(f.updates,[]);
 f.c.document.visibilityState='visible';await f.c._chequearGitHub();assert.equal(f.calls.length,3);
});

test('respaldo real retenido que termina oculto no anuncia versión ni inicia validación o recarga',async()=>{
 const f=setup({holdFallback:true,fallback:'v3.13.4'}),task=f.c._chequearGitHub();f.release();await settle();assert.equal(f.calls.length,2);
 f.c.document.visibilityState='hidden';f.c.document.hidden=true;f.releaseFallback();assert.equal(await task,'');assert.deepEqual(f.updates,[]);assert.equal(f.timers.size,0);
});

test('marcador colgado libera el intento a20s, aborta cuando puede y permite reintentar sin aceptar respuestas viejas',async()=>{
 for(const controller of [false,true]){
  const f=setup({controller}),first=f.c._chequearGitHub(v=>f.callbacks.push(v));await settle();f.advance(19999);assert.equal(f.calls.length,1);assert.notEqual(f.c._chequeoGitHubPendiente,null);
  f.advance(1);await settle();assert.equal(f.c._chequeoGitHubPendiente,null);assert.equal(await first,'');assert.deepEqual(f.callbacks,['']);assert.equal(f.timers.size,0);
  if(controller)assert.equal(f.options[0].signal.aborted,true);
  f.marker('v3.13.4');await f.c._chequearGitHub();assert.equal(f.calls.length,2);assert.deepEqual(f.updates,['v3.13.4-firebase']);
  f.release();await settle();assert.equal(f.calls.length,2);assert.deepEqual(f.updates,['v3.13.4-firebase']);
 }
});

test('el plazo de20s incluye marcador y respaldo, sin dejar el respaldo tardío iniciar una actualización',async()=>{
 const f=setup({holdFallback:true,fallback:'v3.13.4'}),first=f.c._chequearGitHub();f.advance(5000);f.release();await settle();assert.equal(f.calls.length,2);
 f.advance(14999);assert.notEqual(f.c._chequeoGitHubPendiente,null);f.advance(1);await settle();assert.equal(f.c._chequeoGitHubPendiente,null);assert.equal(await first,'');
 assert.equal(f.options[0].signal,f.options[1].signal);assert.equal(f.options[1].signal.aborted,true);assert.deepEqual(f.updates,[]);
 f.releaseFallback();await settle();assert.deepEqual(f.updates,[]);assert.equal(f.timers.size,0);
 f.marker('v3.13.4');await f.c._chequearGitHub();assert.equal(f.calls.length,3);assert.deepEqual(f.updates,['v3.13.4-firebase']);
});

test('se conserva el cooldown de15min del respaldo sin cachear nuevos chequeos del marcador',async()=>{
 const f=setup(),first=f.c._chequearGitHub();f.release();await first;assert.equal(f.calls.length,2);
 f.advance(15*60*1000-1);await f.c._chequearGitHub();assert.equal(f.calls.length,3);
 f.advance(1);await f.c._chequearGitHub();assert.equal(f.calls.length,5);assert.equal(f.timers.size,0);
});

test('validación completa no arranca oculta y una validación iniciada visible no recarga si termina oculta',async()=>{
 const f=setup(),validated=[],reloaded=[];let release;
 Object.assign(f.c,{location:{hostname:'fixture.invalid'},_actualizandoAhora:false,_verificacionVersionEnCurso:false,_reintentoVersionTimer:null,
  _limpiarControlIntentosActualizacion(){},_verificarVersionPublicadaCompleta:version=>{validated.push(version);return new Promise(resolve=>release=resolve);},actualizarAutomaticamente:(...args)=>reloaded.push(args)});
 f.c.document.querySelector=()=>null;f.c.document.getElementById=()=>null;
 vm.runInContext(require('./helpers/app-functions.cjs').functionSource('_dispararActualizacion'),f.c);
 f.c.document.visibilityState='hidden';f.c.document.hidden=true;f.c._dispararActualizacion('v3.13.4-firebase');assert.deepEqual(validated,[]);
 f.c.document.visibilityState='visible';f.c.document.hidden=false;f.c._dispararActualizacion('v3.13.4-firebase');assert.equal(validated.length,1);
 f.c.document.visibilityState='hidden';f.c.document.hidden=true;release(true);await settle();assert.deepEqual(reloaded,[]);assert.equal(f.c._verificacionVersionEnCurso,false);assert.equal(f.timers.size,0);
});

test('al volver visible después del timeout del respaldo, una acción nueva consulta y puede validar sin navegar previamente',async()=>{
 const f=setup({holdFallback:true,fallback:'v3.13.4'}),first=f.c._chequearGitHub();f.release();await settle();assert.equal(f.calls.length,2);
 f.c.document.visibilityState='hidden';f.c.document.hidden=true;f.advance(20000);await first;assert.equal(f.c._chequeoGitHubPendiente,null);assert.equal(f.timers.size,0);
 f.c.document.visibilityState='visible';f.c.document.hidden=false;f.marker('v3.13.4');const next=f.c._chequearGitHub();await next;assert.equal(f.calls.length,3);assert.deepEqual(f.updates,['v3.13.4-firebase']);
 f.releaseFallback();await settle();assert.deepEqual(f.updates,['v3.13.4-firebase']);assert.equal(f.timers.size,0);
});

test('el primer plano congelado también impide consultas y descarta un respaldo que llegó antes de restaurarse',async()=>{
 const f=setup({holdFallback:true,fallback:'v3.13.4'});let foreground=false;f.c.window.SVForegroundSession={isVisible:()=>foreground};
 assert.equal(await f.c._chequearGitHub(),'');assert.equal(f.calls.length,0);
 foreground=true;const task=f.c._chequearGitHub();f.release();await settle();assert.equal(f.calls.length,2);
 foreground=false;f.releaseFallback();assert.equal(await task,'');assert.deepEqual(f.updates,[]);assert.equal(f.timers.size,0);
});

function actualPublication(f,{critical=false,assetVersion='v3.13.4',holdIndex=false,holdAssets=false,onDeploy}={}){
 const originalFetch=f.c.fetch,deploy=[],deployOptions=[],reloaded=[],offered=[],notified=[],target='v3.13.4-firebase';let deployedAsset=assetVersion,releaseIndex,releaseAssets;
 const indexGate=new Promise(resolve=>releaseIndex=resolve),assetGate=new Promise(resolve=>releaseAssets=resolve);
 f.c.fetch=async(url,options)=>{
  if(!url.includes('_deploy='))return originalFetch(url,options);
  deploy.push(url);deployOptions.push(options);if(onDeploy)onDeploy(url,f);let text;
  if(holdIndex&&deploy.length===1)await indexGate;
  if(holdAssets&&deploy.length>1&&deploy.length<=4)await assetGate;
  if(url.startsWith('./index.html?'))text='<!-- VERSION: "'+target+'" --><script src="./js/app.v3.13.4.js"></script><script src="./js/core/version.v3.13.4.js"></script>';
  else if(url.startsWith('./js/app.v3.13.4.js?'))text='const APP_CONFIG = { VERSION: "'+deployedAsset+'-firebase" };';
  else if(url.startsWith('./js/core/version.v3.13.4.js?'))text="window.SISVENTAS_PWA_VERSION = 'v3.13.4';";
  else {assert.ok(url.startsWith('./sw.js?'));text="const CACHE = 'sisventas-v3.13.4';";}
  return {ok:true,text:async()=>text};
 };
 Object.assign(f.c,{location:{hostname:'fixture.invalid'},_actualizandoAhora:false,_verificacionVersionEnCurso:false,_reintentoVersionTimer:null,
  _limpiarControlIntentosActualizacion(){},actualizarAutomaticamente:(...args)=>reloaded.push(args),_mostrarBotonActualizacion:v=>offered.push(v),notify:text=>notified.push(text)});
 f.c.window._sisventasProcesoCriticoActivo=critical;f.c.document.querySelector=()=>null;f.c.document.getElementById=()=>null;
 const {functionSource}=require('./helpers/app-functions.cjs');
 for(const name of ['_versionCoincideObjetivo','_verificarVersionPublicadaCompleta','_dispararActualizacion'])vm.runInContext(functionSource(name),f.c);
 return {deploy,deployOptions,reloaded,offered,notified,target,releaseIndex,releaseAssets,asset:version=>deployedAsset=version};
}

test('el respaldo visible conserva la validación real de índice, app inmutable, core y SW antes de recargar',async()=>{
 const f=setup({holdFallback:true,fallback:'v3.13.4'}),p=actualPublication(f),task=f.c._chequearGitHub();f.release();await settle();assert.equal(p.deploy.length,0);
 f.releaseFallback();assert.equal(await task,p.target);await settle();assert.equal(p.deploy.length,4);assert.deepEqual(p.reloaded,[['v3.13.3-firebase',p.target]]);assert.equal(f.timers.size,0);
});

test('la validación completa respeta la operación crítica y una publicación parcial conserva su reintento visible',async()=>{
 const f=setup({published:'v3.13.4'}),p=actualPublication(f,{critical:true,assetVersion:'v3.13.3'}),task=f.c._chequearGitHub();f.release();await task;await settle();
 assert.equal(p.deploy.length,4);assert.deepEqual(p.reloaded,[]);assert.deepEqual(p.offered,[]);assert.equal(f.timers.size,1);
 p.asset('v3.13.4');f.advance(30000);await settle();assert.equal(p.deploy.length,8);assert.deepEqual(p.reloaded,[]);assert.deepEqual(p.offered,[p.target]);assert.equal(p.notified.length,1);assert.equal(f.timers.size,0);
 f.c.window._sisventasProcesoCriticoActivo=false;await f.c._chequearGitHub();await settle();assert.equal(p.deploy.length,12);assert.deepEqual(p.reloaded,[['v3.13.3-firebase',p.target]]);
});

test('una publicación parcial que termina oculta no programa reintentos de fondo',async()=>{
 const f=setup();let release;Object.assign(f.c,{location:{hostname:'fixture.invalid'},_actualizandoAhora:false,_verificacionVersionEnCurso:false,_reintentoVersionTimer:null,
  _verificarVersionPublicadaCompleta:()=>new Promise(resolve=>release=resolve)});
 vm.runInContext(require('./helpers/app-functions.cjs').functionSource('_dispararActualizacion'),f.c);
 f.c._dispararActualizacion('v3.13.4-firebase');f.c.document.hidden=true;f.c.document.visibilityState='hidden';release(false);await settle();assert.equal(f.c._verificacionVersionEnCurso,false);assert.equal(f.timers.size,0);
});

test('el índice de validación que llega oculto o congelado no inicia los tres activos',async()=>{
 for(const frozen of [false,true]){
  const f=setup(),p=actualPublication(f,{holdIndex:true});f.c._dispararActualizacion(p.target);await settle();assert.equal(p.deploy.length,1);
  if(frozen)f.c.window.SVForegroundSession={isVisible:()=>false};else {f.c.document.hidden=true;f.c.document.visibilityState='hidden';}
  p.releaseIndex();await settle();assert.equal(p.deploy.length,1);assert.equal(f.c._verificacionVersionEnCurso,false);assert.deepEqual(p.reloaded,[]);assert.equal(f.timers.size,0);
 }
});

test('cada activo verifica primer plano antes de pedirlo aunque el anterior cambie la visibilidad',async()=>{
 const f=setup(),p=actualPublication(f,{onDeploy(url,f){if(url.startsWith('./js/app.'))f.c.document.hidden=true;}});
 f.c._dispararActualizacion(p.target);await settle();assert.equal(p.deploy.length,2);assert.equal(f.c._verificacionVersionEnCurso,false);assert.deepEqual(p.reloaded,[]);assert.equal(f.timers.size,0);
});

test('índice colgado vence a30s, libera validación y permite señal nueva sin aceptar el índice anterior',async()=>{
 for(const controller of [false,true]){
  const f=setup({controller}),p=actualPublication(f,{holdIndex:true});f.c._dispararActualizacion(p.target,0);await settle();assert.equal(p.deploy.length,1);
  f.advance(29999);await settle();assert.equal(f.c._verificacionVersionEnCurso,true);f.advance(1);await settle();assert.equal(f.c._verificacionVersionEnCurso,false);assert.equal(f.timers.size,0);
  if(controller)assert.equal(p.deployOptions[0].signal.aborted,true);
  f.c._dispararActualizacion(p.target,0);await settle();assert.equal(p.deploy.length,5);assert.equal(p.reloaded.length,1);
  p.releaseIndex();await settle();assert.equal(p.deploy.length,5);assert.equal(p.reloaded.length,1);assert.equal(f.timers.size,0);
 }
});

test('los30s totales incluyen índice y activos retenidos, con la misma señal y descarte tardío',async()=>{
 const f=setup(),p=actualPublication(f,{holdIndex:true,holdAssets:true});f.c._dispararActualizacion(p.target,0);await settle();f.advance(25000);p.releaseIndex();await settle();assert.equal(p.deploy.length,4);
 f.advance(4999);await settle();assert.equal(f.c._verificacionVersionEnCurso,true);f.advance(1);await settle();assert.equal(f.c._verificacionVersionEnCurso,false);assert.equal(f.timers.size,0);assert.deepEqual(p.reloaded,[]);
 assert.ok(p.deployOptions.every(options=>options.signal===p.deployOptions[0].signal));assert.equal(p.deployOptions[0].signal.aborted,true);
 p.releaseAssets();await settle();assert.deepEqual(p.reloaded,[]);assert.equal(f.timers.size,0);
});

test('publicación parcial agota tres reintentos automáticos y una señal explícita visible renueva el presupuesto',async()=>{
 const f=setup(),p=actualPublication(f,{assetVersion:'v3.13.3'});f.c._dispararActualizacion(p.target);await settle();assert.equal(p.deploy.length,4);
 for(let i=1;i<=3;i++){assert.equal(f.timers.size,1);f.advance(30000);await settle();assert.equal(p.deploy.length,4*(i+1));}
 assert.equal(f.timers.size,0);f.advance(24*60*60*1000);await settle();assert.equal(p.deploy.length,16);assert.deepEqual(p.reloaded,[]);
 f.c.document.hidden=true;f.c._dispararActualizacion(p.target);await settle();assert.equal(p.deploy.length,16);
 f.c.document.hidden=false;f.c._dispararActualizacion(p.target);await settle();assert.equal(p.deploy.length,20);assert.equal(f.timers.size,1);
 p.asset('v3.13.4');f.advance(30000);await settle();assert.equal(p.reloaded.length,1);assert.equal(f.timers.size,0);
});

test('presupuesto explícito cero no reintenta y una nueva señal reemplaza el reintento antiguo',async()=>{
 const f=setup(),p=actualPublication(f,{assetVersion:'v3.13.3'});f.c._dispararActualizacion(p.target,0);await settle();assert.equal(p.deploy.length,4);assert.equal(f.timers.size,0);
 f.c._dispararActualizacion(p.target);await settle();assert.equal(f.timers.size,1);p.asset('v3.13.4');f.c._dispararActualizacion(p.target);await settle();assert.equal(p.deploy.length,12);assert.equal(p.reloaded.length,1);assert.equal(f.timers.size,0);
});

test('la validación completa descarta el índice vencido aunque el navegador haya aplazado ejecutar el timer',async()=>{
 const f=setup(),p=actualPublication(f,{holdIndex:true});f.c._dispararActualizacion(p.target,0);await settle();f.elapse(30001);p.releaseIndex();await settle();
 assert.equal(f.c._verificacionVersionEnCurso,false);assert.equal(p.deploy.length,1);assert.deepEqual(p.reloaded,[]);assert.equal(p.deployOptions[0].signal.aborted,true);assert.equal(f.timers.size,0);
});

test('marcador y respaldo vencidos liberan el intento al responder aunque el timer siga suspendido',async()=>{
 for(const fallback of [false,true]){
  const f=setup({published:fallback?'v3.13.3':'v3.13.4',holdFallback:fallback,fallback:'v3.13.4'}),task=f.c._chequearGitHub();await settle();
  if(fallback){f.release();await settle();assert.equal(f.calls.length,2);}
  f.elapse(20001);if(fallback)f.releaseFallback();else f.release();assert.equal(await task,'');assert.equal(f.c._chequeoGitHubPendiente,null);assert.deepEqual(f.updates,[]);assert.equal(f.options[0].signal.aborted,true);assert.equal(f.timers.size,0);
 }
});
