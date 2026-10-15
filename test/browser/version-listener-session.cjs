'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.SV_PLAYWRIGHT_MODULE||'playwright');
const current=require('../helpers/active-app').readActiveApp().source;
const previous=execFileSync('git',['show','c15e5663d928840f9823ddb3ee9c34b85d62d3e4:js/app.v3.11.5.js'],{encoding:'utf8',maxBuffer:16*1024*1024}).replace(/\r\n/g,'\n');
function extract(source,name){const start=source.indexOf('function '+name+'(');assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2);}
async function run(){
 const browser=await chromium.launch({headless:true});let checks=0;
 try{
  for(const viewport of [{width:1366,height:900},{width:390,height:844}])for(const baseline of [true,false]){
   const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<style>body{background:#0b1423;color:#dfe8f7;font:16px system-ui;padding:20px}section{max-width:650px;padding:20px;background:#18243b;border-radius:12px;line-height:1.7}h1{font-size:24px}</style><h1>Escucha de versiones</h1><p>Prueba aislada · sesión ficticia de Administrativo</p><section id="result"></section>');
   await page.addScriptTag({content:`
    var isAuthenticated=false,currentUserUid='',currentRole='administrativo',APP_CONFIG={VERSION:'v3.11.6-firebase'};
    var _listenerVersionActivo=false,_listenerVersionUnsubscribe=null,_listenerVersionUid='',_listenerVersionEpoch=0,_reintentoListenerVersionTimer=null,_watchdogVersionTimer=null,_chequeoVersionIniciado=false;
    var subscriptions=[],updates=[],denied=0,httpChecks=0,retries=new Map(),intervals=[],serial=1000;
    function paint(){document.getElementById('result').textContent='Sesión: '+(isAuthenticated?'confirmada':'cerrada')+' · Avisos recibidos: '+updates.length+' · Rechazos antes del acceso: '+denied+' · Comprobaciones web: '+httpChecks;}
    function rolActualNormalizado(){return currentRole;}
    function _chequearGitHub(){httpChecks++;paint();}
    function _dispararActualizacion(v){updates.push(v);paint();}
    const nativeTimeout=window.setTimeout.bind(window),nativeClear=window.clearTimeout.bind(window);
    window.setTimeout=(fn,ms)=>{if(ms!==30000)return nativeTimeout(fn,ms);const id=++serial;retries.set(id,()=>{retries.delete(id);fn();});return id;};
    window.clearTimeout=id=>{retries.delete(id);nativeClear(id);};
    window.setInterval=(fn,ms)=>{intervals.push({fn,ms});return intervals.length;};
    window.fbDB={};window.fbAuth={currentUser:null};window.fbRef=(_,path)=>path;
    window.fbOnValue=(path,next,error)=>{const s={path,next,error,closed:false};subscriptions.push(s);queueMicrotask(()=>{
      if(!isAuthenticated||!fbAuth.currentUser){s.closed=true;denied++;if(error)error({code:'PERMISSION_DENIED'});paint();}
      else next({val:()=> 'v3.11.7-firebase'});
    });return ()=>{s.closed=true;};};
    paint();
   `});
   const names=['_versionMasNueva','iniciarListenerVersion','iniciarWatchdogVersion','iniciarChequeoPeriodicoVersion'];
   if(!baseline)names.unshift('_sesionVersionLista','detenerListenerVersion');
   await page.addScriptTag({content:names.map(n=>extract(baseline?previous:current,n)).join('\n')});
   if(!baseline){const hook=current.match(/^document.addEventListener\('sisventas:session-ended', detenerListenerVersion\);$/m);assert.ok(hook);await page.addScriptTag({content:hook[0]});}
   await page.evaluate(()=>iniciarChequeoPeriodicoVersion());
   const initial=await page.evaluate(()=>({calls:subscriptions.length,denied,httpChecks}));
   assert.equal(initial.calls,baseline?1:0);assert.equal(initial.denied,baseline?1:0);assert.equal(initial.httpChecks,1);checks++;
   await page.evaluate(()=>{isAuthenticated=true;currentUserUid='fixture';fbAuth.currentUser={uid:'fixture'};iniciarChequeoPeriodicoVersion();});
   const after=await page.evaluate(()=>({updates:updates.length,calls:subscriptions.length}));
   assert.equal(after.updates,baseline?0:1);checks++;
   if(!baseline){
    await page.evaluate(()=>subscriptions[0].error({code:'PERMISSION_DENIED'}));
    assert.equal(await page.evaluate(()=>_listenerVersionActivo),false);assert.equal(await page.evaluate(()=>retries.size),1);
    await page.evaluate(()=>Array.from(retries.values())[0]());
    assert.equal(await page.evaluate(()=>updates.length),2);checks++;
    await page.evaluate(()=>{isAuthenticated=false;document.dispatchEvent(new Event('sisventas:session-ended'));subscriptions[0].next({val:()=> 'v9.9.9-firebase'});subscriptions[1].next({val:()=> 'v9.9.9-firebase'});intervals[0].fn();});
    const final=await page.evaluate(()=>({updates:updates.length,httpChecks,active:_listenerVersionActivo,retries:retries.size,closed:subscriptions.every(s=>s.closed),watchdogs:intervals.length}));
    assert.equal(final.updates,2);assert.equal(final.active,false);assert.equal(final.retries,0);assert.equal(final.closed,true);assert.equal(final.watchdogs,1);assert.equal(final.httpChecks,2);checks++;
    await page.screenshot({path:'tmp/validacion-v3116-version-'+viewport.width+'.png',fullPage:true});
   }
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log(JSON.stringify({checks,passed:true,scope:'Inicio sin Auth, login administrativo, rechazo, recuperación y salida; solo fixtures sin Firebase'},null,2));
 }finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
