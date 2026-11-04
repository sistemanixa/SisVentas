'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {start}=require('./fixtures/commercial-full-app.cjs'),{memoryDb}=require('./helpers/dashboard-budget-activity-fixture.cjs');
const Notices=require('../cotizador/dashboard-budget-notice-candidates-proposal');
const fixtureText=fs.readFileSync(require.resolve('./dashboard-activity-host.test.cjs'),'utf8');
const build=new Function('require','__dirname',fixtureText.slice(0,fixtureText.indexOf('async function settled(')).replace('return {r,host,data,calls,','return {fetchImpl,r,host,data,calls,')+'\nreturn fixture;')(require,__dirname);
const opt={skip:process.env.SV_ACTIVITY_INTEGRATED_BROWSER_QA!=='1',timeout:60000},service='https://activity.fixture.invalid';
async function session(width,work){
 const f=await build({role:'vendedor'}),local=await start(),calls=[],errors=[];let browser,status=null,corrupt=false;
 const auth={verifyIdToken:async token=>{assert.equal(token,'fixture-token');return {uid:'u',svAccessVersion:1,iat:1700000000,auth_time:1700000000};}};
 const notices=Notices.create({enabled:true,auth,db:memoryDb(f.data)});
 try{
  browser=await require('playwright').chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=route.request().url();
   if(url.startsWith(service+'/')){
    const pathname=new URL(url).pathname;calls.push({path:pathname,method:route.request().method()});
    if(status)return route.fulfill({status,contentType:'application/json',body:'{}'});
    try{
     let value;if(pathname.endsWith('/avisos'))value=await notices.read({method:'GET',url:pathname,headers:{authorization:'Bearer fixture-token'}});
     else{const response=await f.fetchImpl(url,{method:'GET',cache:'no-store',redirect:'error'});value=await response.json();if(!response.ok)return route.fulfill({status:response.status,contentType:'application/json',body:JSON.stringify(value)});}
     if(corrupt&&pathname.includes('/ventas/'))value.coverage=null;
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
    }catch(e){return route.fulfill({status:e.statusCode||503,contentType:'application/json',body:JSON.stringify({error:e.message})});}
   }
   if(!url.startsWith(local.url))return route.abort();
   if(url===local.url+'/'){const response=await route.fetch(),headers={...response.headers()};headers['content-security-policy']="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' "+service+"; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'";return route.fulfill({response,headers});}
   return route.continue();
  });
  await page.goto(local.url);await page.waitForFunction(()=>document.querySelectorAll('#ventas-tbody tr').length===50);
  assert.equal(await page.evaluate(()=>!!window.SVDashboardActivityHost),false);assert.equal(calls.length,0);
  await page.evaluate(({permissions,service})=>{
   currentRole='vendedor';currentUserUid='u';currentUser='u';fbAuth.currentUser.uid='u';fbAuth.currentUser.getIdToken=async()=> 'fixture-token';aplicarPermisosRolesGuardados(permissions);
   // Unknown raw provenance deliberately selects the authorized server path.
   delete window._svDashboardRawBlockedPresence;
   window.permisoModulo=m=>m==='notificaciones'||PERMISOS_ROLES[currentRole]?.indiceModulos?.[m]===true;
   window.tienePermiso=a=>['dashboard.actividad','interfaz.dashboard_admin_only'].includes(a);
   window.fbOnline=true;window.SVConnectionMonitor={...window.SVConnectionMonitor,canSync:()=>true};window.SVForegroundSession={isVisible:()=>!document.hidden};window.SISVENTAS_FUNCTIONS.cotizadorProveedor=service;
   const previous=window.fetch;window.fetch=(url,init)=>String(url).startsWith(service)?realFetch(url,init):previous(url,init);
   window.SV_DASHBOARD_READS_LOCAL=true;window.SV_BUDGET_NOTICES_LOCAL=true;
  },{permissions:f.data.sv_permisos,service});
  const originals=structuredClone(local.backend.state.sisventas);
  await work({page,calls,errors,local,control:{status:v=>{status=v;},corrupt:v=>{corrupt=v;}}});
  assert.deepEqual(local.backend.state.sisventas,originals);assert(calls.every(c=>c.method==='GET'));
 }finally{f.host.dispose();await browser?.close();await new Promise(r=>local.server.close(r));}
}
async function demand(page){await page.evaluate(()=>{showPage('dashboard');svCargarInicioDashboardDemandado();});}
async function ready(page){await page.waitForFunction(()=>window.SVDashboardActivityHost?.peek().status==='ready');await page.waitForTimeout(300);}
const rows=page=>page.locator('#dash-actividad-lista > div[style*="padding:9px"]');
async function renderWithoutLegacy(page){await page.evaluate(()=>{
 const keys=['ventasList','_pagosListaActual','_historialPagosCompleto','otData','pptoData'],saved=new Map();
 try{for(const key of keys){const descriptor=Object.getOwnPropertyDescriptor(window,key);saved.set(key,descriptor);const trap=new Proxy({},{get(){throw Error('Forbidden legacy fallback '+key);}});
  if(descriptor?.configurable===false){if(!descriptor.writable)throw Error('Fixture cannot trap '+key);window[key]=trap;}
  else Object.defineProperty(window,key,{configurable:true,get(){throw Error('Forbidden legacy fallback '+key);}});
 }dashRenderActividadReciente();}finally{for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(window,key,descriptor);else delete window[key];}}
 });}
const counts=calls=>Object.fromEntries([...new Set(calls.map(c=>c.path))].map(p=>[p,calls.filter(c=>c.path===p).length]));

for(const width of [1280,390])test('integrated index HTTP aggregate source and renderer '+width,opt,()=>session(width,async({page,calls,errors})=>{
 await demand(page);await ready(page);await renderWithoutLegacy(page);assert.equal(await rows(page).count(),5);
 const packet=await page.evaluate(()=>SVDashboardActivityHost.peek().data);
 assert.equal(packet.activity.complete,true);assert.equal(packet.originalCollectionComplete,false);assert.equal(packet.notificationCenterComplete,false);
 assert.deepEqual(Object.keys(packet.activity.sources).sort(),['ordenes_trabajo','pagos','presupuestos','ventas']);
 assert.equal(calls.length,8,JSON.stringify(counts(calls)));assert(!calls.some(c=>c.path.endsWith('/avisos')));
 const before=calls.length;await page.evaluate(()=>{for(let i=0;i<3;i++)dashRenderActividadReciente();});await page.waitForTimeout(250);assert.equal(calls.length,before);assert.deepEqual(errors,[]);
 fs.mkdirSync(path.resolve('tmp/qa-activity-5c4'),{recursive:true});await page.screenshot({path:path.resolve('tmp/qa-activity-5c4/activity-'+width+'.png'),fullPage:true});
 console.log(JSON.stringify({width,rows:5,initialRequests:counts(calls),grants:await page.evaluate(()=>SVDashboardActivityHost.peek().data.activity.sources)}));
}));

test('integrated navigation does not refresh activity off Dashboard and center is a separate demand',opt,()=>session(1280,async({page,calls})=>{
 await demand(page);await ready(page);const initial=calls.length;
 await page.evaluate(()=>showPage('venta'));await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>document.querySelector('.page.active').id),'page-venta');assert.equal(calls.length,initial);
 await page.evaluate(()=>{showPage('notificaciones');svCargarDatosDePaginaActual('notificaciones');});await page.waitForFunction(()=>window._svBudgetNoticeConsumerHost?.peek().complete===true);await page.waitForTimeout(300);
 assert.equal(calls.length,initial+1);assert(calls.at(-1).path.endsWith('/avisos'));
 const before=calls.length;await demand(page);await ready(page);assert.equal(calls.length-before,8,JSON.stringify(counts(calls.slice(before))));assert(!calls.slice(before).some(c=>c.path.endsWith('/avisos')));
 console.log(JSON.stringify({initial,venta:0,notificaciones:1,returnDashboard:calls.length-before,returnRequests:counts(calls.slice(before))}));
}));

test('integrated failures or missing coverage never render partial zero or legacy fallback',opt,()=>session(390,async({page,calls,control})=>{
 control.status(503);await demand(page);await page.waitForFunction(()=>window.SVDashboardActivityHost?.peek().status==='error');
 await renderWithoutLegacy(page);assert.equal(await rows(page).count(),0);assert.doesNotMatch(await page.locator('#dash-actividad-lista').innerText(),/Sin movimientos/i);
 control.status(null);control.corrupt(true);await page.evaluate(()=>SVDashboardActivityHost.refresh().catch(()=>false));
 await renderWithoutLegacy(page);assert.equal(await rows(page).count(),0);assert.doesNotMatch(await page.locator('#dash-actividad-lista').innerText(),/Sin movimientos/i);
 control.corrupt(false);await page.evaluate(()=>SVDashboardActivityHost.refresh());await ready(page);assert.equal(await rows(page).count(),5);
 control.status(503);const before=calls.length;await page.evaluate(()=>SVDashboardActivityHost.refresh().catch(()=>false));assert.equal(await rows(page).count(),5);assert.match(await page.locator('#dash-actividad-lista').innerText(),/No se pudo actualizar/i);
 await page.evaluate(()=>{for(let i=0;i<3;i++)dashRenderActividadReciente();});await page.waitForTimeout(250);assert.equal(calls.length,before+1);
 await page.evaluate(()=>{currentRole='distribuidora';document.dispatchEvent(new Event('sisventas:role-changed'));dashRenderActividadReciente();});
 assert.equal(await rows(page).count(),0);assert.doesNotMatch(await page.locator('#dash-actividad-lista').innerText(),/Sin movimientos/i);
 console.log(JSON.stringify({failureNoRows:true,missingCoverageNoRows:true,retainedAfter503:5,retiredAfterRole:true,requests:counts(calls)}));
}));
